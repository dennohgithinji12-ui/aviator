import https from 'https';

export interface PayHeroResponse {
  statusCode: number;
  body: any;
}

export function callPayHeroApi(
  endpoint: string,
  method: string = 'GET',
  data: any = null
): Promise<PayHeroResponse> {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.PAYHERO_API_KEY;
    const apiSecret = process.env.PAYHERO_API_SECRET;

    if (!apiKey || !apiSecret) {
      return reject(new Error('PayHero credentials not configured'));
    }

    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/api/v2/${endpoint}`;
    const url = `https://backend.payhero.co.ke${cleanPath}`;
    const postData = data ? JSON.stringify(data) : null;

    const req = https.request(url, {
      method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) || 0 } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body || '{}');
          resolve({ statusCode: res.statusCode || 200, body: json });
        } catch (e) {
          resolve({ statusCode: res.statusCode || 200, body: { raw: body } });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}
