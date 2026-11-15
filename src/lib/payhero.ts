import { getPayHeroConfig } from '@/lib/payhero-config';

export interface PayHeroResponse {
  statusCode: number;
  body: Record<string, any>;
}

/** Server-only PayHero API client. */
export async function callPayHeroApi(
  endpoint: string,
  method: string = 'GET',
  data: unknown = null
): Promise<PayHeroResponse> {
  const { username, password } = await getPayHeroConfig();
  if (!username || !password) throw new Error('PayHero API username and password are not configured');

  const cleanPath = endpoint.startsWith('/') ? endpoint : `/api/v2/${endpoint}`;
  const response = await fetch(`https://backend.payhero.co.ke${cleanPath}`, {
    method,
    headers: {
      Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
      ...(data !== null ? { 'Content-Type': 'application/json' } : {})
    },
    ...(data !== null ? { body: JSON.stringify(data) } : {}),
    signal: AbortSignal.timeout(15_000),
    cache: 'no-store'
  });
  const raw = await response.text();
  let body: Record<string, any>;
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    body = { message: raw || 'PayHero returned an unreadable response' };
  }
  return { statusCode: response.status, body };
}
