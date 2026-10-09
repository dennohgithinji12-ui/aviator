const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const db = require('./db.js');

// Load environment variables from .env file if present
const envFile = path.join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  const envText = fs.readFileSync(envFile, 'utf8');
  envText.split(/\r?\n/).forEach(line => {
    line = line.trim();
    if (line && !line.startsWith('#')) {
      const idx = line.indexOf('=');
      if (idx !== -1) {
        const k = line.substring(0, idx).trim();
        let v = line.substring(idx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  });
}

const PORT = process.env.PORT || 3000;
const BASE_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.apk': 'application/vnd.android.package-archive',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf'
};

// Universal Authoritative Round Engine for Consistent Global Flight Windows (NotebookLM Blueprint)
const MASTER_SECRET = 'shiftstack_aviator_provably_fair_master_chain_2026';
const PUBLIC_CLIENT_SEED = 'global_aviator_network_shared_seed_100x';
const EPOCH_BASE = 1727180000000;
const COUNTDOWN_DURATION = 5.0; // 5.0s Betting Window (NotebookLM Section 3.1)
const CRASHED_PAUSE_DURATION = 3.0; // 3.0s Frozen Crash Window (NotebookLM Section 3.1 & 10)
 
// PayHero Payment Transactions Store (M-PESA STK Push)
const PAYHERO_TRANSACTIONS = new Map();

function callPayHeroApi(endpoint, method = 'GET', data = null) {
  return new Promise((resolve, reject) => {
    const apiKey = process.env.PAYHERO_API_KEY;
    const apiSecret = process.env.PAYHERO_API_SECRET;
    if (!apiKey || !apiSecret) {
      return reject(new Error('PayHero credentials not configured'));
    }
    const https = require('https');
    const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
    const cleanPath = endpoint.startsWith('/') ? endpoint : `/api/v2/${endpoint}`;
    const url = `https://backend.payhero.co.ke${cleanPath}`;
    const postData = data ? JSON.stringify(data) : null;

    const req = https.request(url, {
      method: method,
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        ...(postData ? { 'Content-Length': Buffer.byteLength(postData) } : {})
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          const json = JSON.parse(body || '{}');
          resolve({ statusCode: res.statusCode, body: json });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: { raw: body } });
        }
      });
    });

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function simulateSandboxSuccess(reference, txRecord) {
  setTimeout(() => {
    if (PAYHERO_TRANSACTIONS.has(reference)) {
      const tx = PAYHERO_TRANSACTIONS.get(reference);
      if (tx.status === 'PENDING') {
        tx.status = 'SUCCESS';
        tx.receiptNumber = 'NL' + Math.random().toString(36).substring(2, 9).toUpperCase();
        tx.completedAt = Date.now();
        PAYHERO_TRANSACTIONS.set(reference, tx);

        // Record in SQLite database & automatically credit real balance
        try {
          db.completeDeposit(reference, tx.receiptNumber);
        } catch (e) {
          console.error('[DB Deposit Error]:', e.message);
        }

        console.log(`[PayHero Sandbox] Confirmed M-PESA STK Push payment for ${tx.reference}: KES ${tx.amount} (Receipt: ${tx.receiptNumber})`);
      }
    }
  }, 3500);
}

/**
 * Deterministic Provably Fair Multiplier Derivation (NotebookLM Section 1.2 & 2.2)
 * - 97.0% Return to Player (RTP), 3.0% House Edge
 * - Modulus Bust Gate: 1 in 33 chance of instant crash at 1.00x
 * - 52-bit entropy curve over e = 2^52
 */
function getCrashMultiplier(nonce) {
  // 1. Generate deterministic HMAC-SHA256 digest
  const hmac = crypto.createHmac('sha256', MASTER_SECRET);
  hmac.update(`${PUBLIC_CLIENT_SEED}:${nonce}`);
  const hexHash = hmac.digest('hex');

  // 2. Extract first 13 hexadecimal characters (52 bits of entropy)
  const subHash = hexHash.substring(0, 13);
  const h = parseInt(subHash, 16);
  const e = Math.pow(2, 52); // 4503599627370496

  // 3. Apply House Edge / Bust Gate (1 in 33 chance of instant crash at 1.00x)
  if (h % 33 === 0) {
    return 1.00;
  }

  // 4. Calculate continuous curve multiplier
  const multiplier = Math.floor((100 * e - h) / (e - h)) / 100;
  return Math.max(1.00, multiplier);
}

function getFlightDuration(targetMultiplier) {
  if (targetMultiplier <= 1.00) return 0;
  let low = 0, high = 160;
  for (let i = 0; i < 26; i++) {
    const mid = (low + high) / 2;
    const m = Math.pow(Math.E, 0.072 * mid) + (0.012 * mid * mid);
    if (m < targetMultiplier) low = mid; else high = mid;
  }
  return (low + high) / 2;
}

function computeMultiplierFromTime(t) {
  if (t <= 0) return 1.00;
  const val = Math.pow(Math.E, 0.072 * t) + (0.012 * t * t);
  return Math.max(1.00, Math.floor(val * 100) / 100);
}

function getLiveRoundState(time = Date.now()) {
  const HOUR_MS = 3600000;
  const hourBlockIndex = Math.floor((time - EPOCH_BASE) / HOUR_MS);
  const hourStartTime = EPOCH_BASE + (hourBlockIndex * HOUR_MS);

  let currentNonce = hourBlockIndex * 250;
  let roundStart = hourStartTime;

  while (true) {
    const crashMultiplier = getCrashMultiplier(currentNonce);
    const flightDuration = getFlightDuration(crashMultiplier);
    const totalDuration = COUNTDOWN_DURATION + flightDuration + CRASHED_PAUSE_DURATION;
    const totalDurationMs = totalDuration * 1000;
    const roundEnd = roundStart + totalDurationMs;

    if (time >= roundStart && time < roundEnd) {
      const elapsedInRoundMs = time - roundStart;
      const countdownDurationMs = COUNTDOWN_DURATION * 1000;
      const flightDurationMs = flightDuration * 1000;

      let phase = 'WAITING';
      let remainingSeconds = 0;
      let elapsedFlightSeconds = 0;
      let currentMultiplier = 1.00;

      if (elapsedInRoundMs < countdownDurationMs) {
        phase = 'WAITING';
        remainingSeconds = (countdownDurationMs - elapsedInRoundMs) / 1000;
        currentMultiplier = 1.00;
      } else if (elapsedInRoundMs < countdownDurationMs + flightDurationMs) {
        phase = 'FLYING';
        elapsedFlightSeconds = (elapsedInRoundMs - countdownDurationMs) / 1000;
        currentMultiplier = Math.min(crashMultiplier, computeMultiplierFromTime(elapsedFlightSeconds));
      } else {
        phase = 'CRASHED';
        currentMultiplier = crashMultiplier;
      }

      return {
        serverTime: time,
        nonce: currentNonce,
        phase: phase,
        crashMultiplier: crashMultiplier,
        flightDuration: flightDuration,
        currentMultiplier: currentMultiplier,
        remainingSeconds: Math.max(0, remainingSeconds),
        elapsedFlightSeconds: Math.max(0, elapsedFlightSeconds),
        roundStartTime: roundStart,
        roundEndTime: roundEnd,
        serverHash: crypto.createHash('sha256').update(`${MASTER_SECRET}:${currentNonce}`).digest('hex'),
        clientSeed: PUBLIC_CLIENT_SEED
      };
    }

    roundStart = roundEnd;
    currentNonce++;
    if (currentNonce > (hourBlockIndex * 250) + 400) break;
  }

  return {
    serverTime: time,
    nonce: currentNonce,
    phase: 'WAITING',
    crashMultiplier: 2.00,
    flightDuration: 6.10,
    currentMultiplier: 1.00,
    remainingSeconds: 5.0,
    elapsedFlightSeconds: 0,
    roundStartTime: time,
    roundEndTime: time + 14300,
    serverHash: crypto.createHash('sha256').update(`${MASTER_SECRET}:${currentNonce}`).digest('hex'),
    clientSeed: PUBLIC_CLIENT_SEED
  };
}

const server = http.createServer((req, res) => {
  let parsedUrl = new URL(req.url, `http://${req.headers.host}`);
  let pathname = decodeURIComponent(parsedUrl.pathname);

  // Authoritative API endpoint for real-time round sync across all players
  if (pathname === '/api/round-state') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify(getLiveRoundState()));
  }

  // Client Firebase configuration endpoint (loads from .env if provided)
  if (pathname === '/api/config/firebase') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify({
      apiKey: process.env.FIREBASE_API_KEY || null,
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || null,
      projectId: process.env.FIREBASE_PROJECT_ID || null,
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || null,
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || null,
      appId: process.env.FIREBASE_APP_ID || null,
      isConfigured: Boolean(process.env.FIREBASE_API_KEY && process.env.FIREBASE_PROJECT_ID)
    }));
  }

  // PayHero Service Wallet Status Endpoint
  if (pathname === '/api/payhero/service-wallet' && req.method === 'GET') {
    callPayHeroApi('wallets?wallet_type=service_wallet', 'GET')
      .then(result => {
        const data = result.body || {};
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify({
          success: result.statusCode < 400,
          availableBalance: data.available_balance !== undefined ? parseFloat(data.available_balance) : 0,
          currency: data.currency || 'KES',
          status: data.wallet_status || 'ACTIVE',
          channelId: process.env.PAYHERO_CHANNEL_ID || '4848',
          tillNumber: '9956081',
          secondaryTillNumber: '6310357'
        }));
      })
      .catch(err => {
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify({
          success: false,
          availableBalance: 0,
          currency: 'KES',
          error: err.message,
          channelId: process.env.PAYHERO_CHANNEL_ID || '4848',
          tillNumber: '9956081',
          secondaryTillNumber: '6310357'
        }));
      });
    return;
  }

  // PayHero Service Wallet Top-Up Endpoint (M-PESA float top up)
  if (pathname === '/api/payhero/topup-service-wallet' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const amount = Math.max(10, Math.round(parseFloat(data.amount) || 50));
        let phone = String(data.phone || '').trim().replace(/[^\d+]/g, '');
        if (phone.startsWith('07') || phone.startsWith('01')) {
          phone = '254' + phone.substring(1);
        } else if (phone.startsWith('+254')) {
          phone = phone.substring(1);
        } else if (!phone.startsWith('254') && phone.length === 9) {
          phone = '254' + phone;
        }

        if (!phone || phone.length < 10) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: false, error: 'Valid phone number required for float top-up.' }));
        }

        const topupRes = await callPayHeroApi('topup', 'POST', {
          amount: amount,
          phone_number: phone
        });

        if (topupRes.statusCode >= 400 || (topupRes.body && topupRes.body.error_message)) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({
            success: false,
            error: topupRes.body.error_message || 'PayHero float top-up failed',
            details: topupRes.body
          }));
        }

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({
          success: true,
          message: `M-PESA prompt of KES ${amount} sent to 0${phone.substring(3)}. Enter your PIN to credit PayHero Service Float.`,
          reference: topupRes.body.reference,
          checkoutRequestId: topupRes.body.CheckoutRequestID
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Lipa na M-PESA Buy Goods Till 9956081 Direct Payment Verification
  if (pathname === '/api/payhero/verify-mpesa-code' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const rawCode = String(data.mpesaCode || data.receipt || '').trim().toUpperCase();
        let phone = String(data.phone || '').trim().replace(/[^\d+]/g, '');
        if (phone.startsWith('07') || phone.startsWith('01')) {
          phone = '254' + phone.substring(1);
        } else if (phone.startsWith('+254')) {
          phone = phone.substring(1);
        } else if (!phone.startsWith('254') && phone.length === 9) {
          phone = '254' + phone;
        }

        if (!rawCode || rawCode.length < 8) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Please enter a valid M-PESA confirmation receipt code (e.g. UAO234VA8A or NL12345678).'
          }));
        }

        // 1. Idempotency check: Has this receipt code already been credited?
        const alreadyClaimed = db.getDepositByReceipt(rawCode);
        if (alreadyClaimed && alreadyClaimed.status === 'SUCCESS') {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({
            success: false,
            error: `M-PESA receipt code ${rawCode} has already been credited to user ${alreadyClaimed.phone}.`
          }));
        }

        // 2. Query PayHero Live Inbound Transactions
        let matchedTx = null;
        try {
          const txRes = await callPayHeroApi('transactions?page=1&per_page=50', 'GET');
          if (txRes.body && Array.isArray(txRes.body.transactions)) {
            matchedTx = txRes.body.transactions.find(t => {
              const provRef = String(t.provider_reference || '').toUpperCase();
              const extRef = String(t.external_reference || '').toUpperCase();
              const txRef = String(t.transaction_reference || '').toUpperCase();
              return provRef === rawCode || provRef.endsWith(rawCode) || extRef === rawCode || txRef.includes(rawCode);
            });
          }
        } catch (apiErr) {
          console.warn('[PayHero Transactions Query Warning]:', apiErr.message);
        }

        if (matchedTx) {
          const creditedAmount = Math.max(49, parseFloat(matchedTx.amount) || parseFloat(data.amount) || 49);
          const ref = `PH_TILL_${rawCode}`;
          db.createDeposit(ref, phone, creditedAmount);
          db.completeDeposit(ref, rawCode);
          const balances = db.getBalances(phone);

          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({
            success: true,
            message: `Deposit verified! KES ${creditedAmount.toFixed(2)} credited from Lipa na M-PESA Till payment (Ref: ${rawCode}).`,
            receiptNumber: rawCode,
            reference: ref,
            creditedAmount: creditedAmount,
            realBalance: balances.realBalance,
            demoBalance: balances.demoBalance
          }));
        }

        // If not yet found in transactions list, check if sandbox test mode is active
        if (data.isSandbox === true || process.env.PAYHERO_SANDBOX === 'true') {
          const creditedAmount = Math.max(49, parseFloat(data.amount) || 49);
          const ref = `PH_TEST_${rawCode}`;
          db.createDeposit(ref, phone, creditedAmount);
          db.completeDeposit(ref, rawCode);
          const balances = db.getBalances(phone);

          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({
            success: true,
            message: `[Sandbox] Test receipt ${rawCode} verified! KES ${creditedAmount.toFixed(2)} credited.`,
            receiptNumber: rawCode,
            reference: ref,
            creditedAmount: creditedAmount,
            realBalance: balances.realBalance,
            demoBalance: balances.demoBalance
          }));
        }

        // If not found in PayHero transactions list, return helpful guidance
        res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({
          success: false,
          error: `M-PESA receipt code ${rawCode} was not found in recent PayHero Till transactions. If you just sent money to Till 9956081, please wait 15 seconds for Safaricom to sync and try again.`,
          code: 'RECEIPT_NOT_FOUND'
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // PayHero API endpoints for Kenyan M-PESA STK Push (Min 49 Bob)
  if (pathname === '/api/payhero/stk-push' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', async () => {
      try {
        const data = JSON.parse(body || '{}');
        const amount = parseFloat(data.amount);
        let phone = String(data.phone || '').trim().replace(/[^\d+]/g, '');

        // Normalize Kenyan phone number for M-PESA
        if (phone.startsWith('07') || phone.startsWith('01')) {
          phone = '254' + phone.substring(1);
        } else if (phone.startsWith('+254')) {
          phone = phone.substring(1);
        } else if (!phone.startsWith('254') && phone.length === 9) {
          phone = '254' + phone;
        }

        // Strict 49 Bob validation
        if (isNaN(amount) || amount < 49) {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          return res.end(JSON.stringify({
            success: false,
            error: 'Minimum deposit is KES 49.00 (49 Bob). Please enter 49 KES or more.'
          }));
        }

        if (!phone || phone.length < 10) {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          return res.end(JSON.stringify({
            success: false,
            error: 'Please enter a valid Kenyan phone number (e.g. 0712 345 678).'
          }));
        }

        // Anti-Abuse Rate Limit Enforcement (NotebookLM Section 5.2 & Section 11)
        const rateCheck = db.checkStkRateLimit(phone);
        if (!rateCheck.allowed) {
          res.writeHead(429, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          return res.end(JSON.stringify({
            success: false,
            error: rateCheck.message,
            reason: rateCheck.reason
          }));
        }

        db.recordStkAttempt(phone, 'PENDING');

        const reference = data.reference || `PH_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        const txRecord = {
          reference: reference,
          phone: phone,
          amount: amount,
          status: 'PENDING',
          createdAt: Date.now()
        };
        PAYHERO_TRANSACTIONS.set(reference, txRecord);

        // Store deposit intent in SQLite database
        try {
          db.createDeposit(reference, phone, amount);
        } catch (e) {
          console.warn('[DB Deposit Init Notice]:', e.message);
        }

        // Check if live PayHero credentials are configured in environment
        const apiKey = process.env.PAYHERO_API_KEY;
        const apiSecret = process.env.PAYHERO_API_SECRET;
        const channelId = process.env.PAYHERO_CHANNEL_ID || '4848';

        if (apiKey && apiSecret && !data.forceSandbox) {
          try {
            const phRes = await callPayHeroApi('payments', 'POST', {
              amount: Math.round(amount),
              phone_number: phone,
              channel_id: parseInt(channelId),
              provider: 'm-pesa',
              external_reference: reference,
              customer_name: data.customerName || 'Aviator Pilot',
              callback_url: `http://${req.headers.host}/api/payhero/callback`
            });

            const phJson = phRes.body || {};

            if (phRes.statusCode >= 400 || (phJson.error_message && !phJson.success)) {
              console.warn('[PayHero Live API Notice]:', phRes.statusCode, phJson);

              // Insufficient service wallet float on PayHero
              if (phJson.error_message && phJson.error_message.includes('insufficient balance')) {
                res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                return res.end(JSON.stringify({
                  success: false,
                  code: 'INSUFFICIENT_SERVICE_FLOAT',
                  error: 'PayHero service float is currently 0 KES. Please pay directly via Lipa na M-PESA Buy Goods Till 9956081 below, or top up the float.',
                  tillNumber: '9956081',
                  secondaryTillNumber: '6310357',
                  reference: reference,
                  requiresTill: true,
                  payheroResponse: phJson
                }));
              }

              res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
              return res.end(JSON.stringify({
                success: false,
                error: phJson.error_message || phJson.message || 'PayHero payment initiation failed',
                payheroResponse: phJson
              }));
            }

            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({
              success: true,
              status: 'PENDING',
              reference: reference,
              message: `STK Push sent to 0${phone.substring(3)}. Enter your M-PESA PIN to complete deposit of KES ${amount}.`,
              checkoutRequestId: phJson.CheckoutRequestID,
              payheroResponse: phJson
            }));

          } catch (liveErr) {
            console.warn('[PayHero Live Error]:', liveErr.message);
            res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({
              success: false,
              code: 'PAYHERO_API_ERROR',
              error: `PayHero connection issue: ${liveErr.message}. Please pay directly via Buy Goods Till 9956081.`,
              tillNumber: '9956081'
            }));
          }
        } else {
          // Sandbox / Test Mode
          console.log(`[PayHero Sandbox] Simulated STK Push for KES ${amount} to ${phone} (Ref: ${reference})`);
          simulateSandboxSuccess(reference, txRecord);

          res.writeHead(200, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          return res.end(JSON.stringify({
            success: true,
            status: 'PENDING',
            reference: reference,
            message: `STK Push prompt sent to 0${phone.substring(3)}. Enter your M-PESA PIN on your phone to complete deposit of KES ${amount}.`,
            isSandbox: true
          }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // PayHero Status Polling Endpoint (with SQLite database synchronization & live PayHero reconciliation)
  if (pathname === '/api/payhero/status') {
    const ref = parsedUrl.searchParams.get('reference') || parsedUrl.searchParams.get('ref');
    let tx = PAYHERO_TRANSACTIONS.get(ref);
    if (!tx) {
      const dbDep = db.getDeposit(ref);
      if (dbDep) {
        tx = {
          reference: dbDep.reference,
          status: dbDep.status,
          amount: dbDep.amount,
          phone: dbDep.phone,
          receiptNumber: dbDep.receipt_number
        };
      }
    }

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    });
    if (!tx) {
      return res.end(JSON.stringify({ success: false, status: 'NOT_FOUND' }));
    }

    // If still pending, check PayHero transactions API
    if (tx.status === 'PENDING' && process.env.PAYHERO_API_KEY) {
      callPayHeroApi('transactions?page=1&per_page=20', 'GET')
        .then(tRes => {
          if (tRes.body && Array.isArray(tRes.body.transactions)) {
            const match = tRes.body.transactions.find(t => {
              const ext = String(t.external_reference || '');
              const desc = String(t.description || '');
              return (ext && ext === tx.reference) || (tx.phone && desc.includes(tx.phone.slice(-9)));
            });
            if (match) {
              const receipt = match.provider_reference || ('NL' + Math.random().toString(36).substring(2, 9).toUpperCase());
              tx.status = 'SUCCESS';
              tx.receiptNumber = receipt;
              PAYHERO_TRANSACTIONS.set(ref, tx);
              db.completeDeposit(tx.reference, receipt);
            }
          }
        })
        .catch(() => {});
    }

    const balances = db.getBalances(tx.phone);
    return res.end(JSON.stringify({
      success: true,
      status: tx.status,
      reference: tx.reference,
      amount: tx.amount,
      phone: tx.phone,
      receiptNumber: tx.receiptNumber || null,
      realBalance: balances.realBalance,
      demoBalance: balances.demoBalance
    }));
  }

  // PayHero Webhook Callback Endpoint (NotebookLM Section 7.1, 7.2, 7.3)
  if (pathname === '/api/payhero/callback' && req.method === 'POST') {
    let cbBody = '';
    req.on('data', chunk => { cbBody += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(cbBody || '{}');
        console.log('[PayHero Webhook Received]:', payload);
        const ref = payload.external_reference || payload.response?.ExternalReference;
        const receipt = payload.response?.MpesaReceiptNumber || `QPH${Date.now().toString(36).toUpperCase()}`;

        if (ref) {
          // Idempotency Verification (NotebookLM Section 7.2: Never trust client, don't re-credit)
          const existingDep = db.getDeposit(ref);
          if (existingDep && existingDep.status === 'SUCCESS') {
            console.log(`[PayHero Idempotency] Reference ${ref} already processed. Returning HTTP 200.`);
            res.writeHead(200, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ status: 'OK', note: 'Idempotent skip' }));
          }

          if (PAYHERO_TRANSACTIONS.has(ref)) {
            const tx = PAYHERO_TRANSACTIONS.get(ref);
            tx.status = 'SUCCESS';
            tx.receiptNumber = receipt;
            PAYHERO_TRANSACTIONS.set(ref, tx);
          }
          // Automatically credit real money balance in SQLite
          db.completeDeposit(ref, receipt);
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'OK' }));
      } catch (e) {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ status: 'ERROR', error: e.message }));
      }
    });
    return;
  }

  // Wallet API: Fetch real & demo balances + AML turnover metrics (NotebookLM Blueprint)
  if (pathname === '/api/wallet' && req.method === 'GET') {
    const phone = parsedUrl.searchParams.get('phone') || '';
    const balances = db.getBalances(phone);
    const totalDeposits = db.getTotalDeposits(phone);
    const totalTurnover = db.getTotalTurnover(phone);
    const turnoverCompleted = (totalDeposits === 0) || (totalTurnover >= totalDeposits);

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify({
      success: true,
      ...balances,
      totalDeposits,
      totalTurnover,
      turnoverCompleted,
      turnoverRequired: Math.max(0, totalDeposits - totalTurnover)
    }));
  }

  // Wallet API: Withdraw Funds with Automated Risk Engine (NotebookLM Section 8.1, 8.2, 8.3 & Section 10)
  if (pathname === '/api/wallet/withdraw' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const phone = data.phone ? String(data.phone).trim() : '';
        const targetPhone = data.targetPhone ? String(data.targetPhone).trim() : phone;
        const amount = parseFloat(data.amount) || 0;

        if (!phone || phone === 'guest') {
          res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({
            success: false,
            error: 'An active account is required to withdraw funds. Please login first.'
          }));
        }

        const user = db.getUser(phone);
        const normPhone = user ? user.phone : phone;
        const normTarget = db.getUser(targetPhone)?.phone || targetPhone;

        // Minimum withdrawal threshold: 25.00 KES (NotebookLM Section 6.1 & 10)
        if (amount < 25) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({
            success: false,
            error: 'Minimum withdrawal amount is KES 25.00. Please enter 25 KES or more.'
          }));
        }

        const currentBal = db.getBalances(normPhone);
        if (currentBal.realBalance < amount) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({
            success: false,
            error: `Insufficient real money balance (Available: KES ${currentBal.realBalance.toFixed(2)}).`
          }));
        }

        // --- RULE 1: Anti-Money Laundering (AML) Turnover Rule (Turnover >= Deposits) ---
        const totalDeposits = db.getTotalDeposits(normPhone);
        const totalTurnover = db.getTotalTurnover(normPhone);
        if (totalDeposits > 0 && totalTurnover < totalDeposits) {
          const deficit = totalDeposits - totalTurnover;
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({
            success: false,
            code: 'REJECTED_INSUFFICIENT_TURNOVER',
            error: `AML Compliance Notice: You must wager 100% of deposited funds before requesting a withdrawal. Required Turnover: KES ${totalDeposits.toFixed(2)}, Current Turnover: KES ${totalTurnover.toFixed(2)} (Deficit: KES ${deficit.toFixed(2)}).`
          }));
        }

        // --- RULE 2: Registered Phone Verification (Account Identity Match) ---
        if (normTarget !== normPhone) {
          const reference = `WTH_HOLD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
          db.updateBalance(normPhone, 'REAL', -amount);
          db.createWithdrawal(normPhone, amount, reference, 'MANUAL_HOLD_PHONE_MISMATCH', 80, 'Destination phone mismatch');
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({
            success: true,
            status: 'PROCESSING',
            reference: reference,
            message: 'Withdrawal Submitted - Processing'
          }));
        }

        // --- RULE 3: Dynamic Velocity Screening (Max 2 withdrawals per 24 hours) ---
        const dailyCount = db.getDailyWithdrawalCount(normPhone);
        if (dailyCount >= 2) {
          const reference = `WTH_HOLD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
          db.updateBalance(normPhone, 'REAL', -amount);
          db.createWithdrawal(normPhone, amount, reference, 'MANUAL_HOLD_VELOCITY_EXCEEDED', 60, 'Velocity exceeded (>2 in 24h)');
          res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({
            success: true,
            status: 'PROCESSING',
            reference: reference,
            message: 'Withdrawal Submitted - Processing'
          }));
        }

        // --- RULE 4: Auto-Approval Ceiling (Max 5,000.00 KES automated) ---
        const AUTO_DISBURSEMENT_LIMIT = 5000.00;
        const reference = `WTH_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
        db.updateBalance(normPhone, 'REAL', -amount);

        let status = 'SETTLED';
        let riskScore = 10;
        let riskReason = 'Approved automated B2C payout';

        if (amount > AUTO_DISBURSEMENT_LIMIT) {
          status = 'MANUAL_HOLD_HIGH_VALUE';
          riskScore = 50;
          riskReason = `Amount KES ${amount} exceeds automated ceiling of KES 5,000.00`;
        }

        db.createWithdrawal(normPhone, amount, reference, status, riskScore, riskReason);
        const updatedBal = db.getBalances(normPhone);

        // --- RULE 5: Frontend Status Abstraction (Uniform status for player security) ---
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({
          success: true,
          status: 'PROCESSING',
          reference: reference,
          amount: amount,
          message: 'Withdrawal Submitted - Processing',
          realBalance: updatedBal.realBalance,
          demoBalance: updatedBal.demoBalance
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Auth API: Store verified phone user with Firebase UID in SQLite database
  if (pathname === '/api/auth/phone-signup' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const phone = data.phone;
        const firebaseUid = data.firebaseUid || null;
        const username = data.username || null;
        const passwordHash = data.passwordHash || null;

        if (!phone) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: false, error: 'Phone number is required.' }));
        }

        const user = db.registerPhoneUser(phone, firebaseUid, username, passwordHash);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify({
          success: true,
          user: {
            id: user.id,
            phone: user.phone,
            firebaseUid: user.firebase_uid,
            username: user.username,
            demoBalance: user.demo_balance,
            realBalance: user.real_balance
          }
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Auth API: Update password in SQLite database (after Firebase OTP verification)
  if (pathname === '/api/auth/update-password' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const phone = data.phone;
        const passwordHash = data.passwordHash;

        if (!phone || !passwordHash) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: false, error: 'Phone and passwordHash are required.' }));
        }

        const updated = db.updatePassword(phone, passwordHash);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: Boolean(updated) }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Auth API: Verify login credentials against SQLite database
  if (pathname === '/api/auth/login' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const phone = data.phone;
        const passwordHash = data.passwordHash;

        if (!phone) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: false, error: 'Phone number is required.' }));
        }

        const user = db.getUser(phone);
        if (!user) {
          res.writeHead(404, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: false, error: 'User not found in database.' }));
        }

        if (user.password_hash && passwordHash && user.password_hash !== passwordHash) {
          res.writeHead(401, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: false, error: 'Incorrect password.' }));
        }

        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({
          success: true,
          user: {
            id: user.id,
            phone: user.phone,
            username: user.username,
            demoBalance: user.demo_balance,
            realBalance: user.real_balance
          }
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Wallet API: Place Bet with server-side balance & real money verification
  if (pathname === '/api/wallet/bet' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const phone = data.phone ? String(data.phone).trim() : '';
        if (!phone || phone === 'guest') {
          res.writeHead(401, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          return res.end(JSON.stringify({
            success: false,
            code: 'ACCOUNT_REQUIRED',
            message: 'An active account is required to place bets in Demo and Real money modes. Please login or register with your phone number.'
          }));
        }
        const mode = (data.mode === 'REAL') ? 'REAL' : 'DEMO';
        const amount = Math.max(100, parseFloat(data.amount) || 100);
        const terminalId = parseInt(data.terminalId) || 1;
        const roundNonce = parseInt(data.roundNonce) || 0;

        const currentBal = db.getBalances(phone);
        const available = (mode === 'REAL') ? currentBal.realBalance : currentBal.demoBalance;

        // Check if user has sufficient funds in Real Money Mode
        if (mode === 'REAL' && currentBal.realBalance < amount) {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          return res.end(JSON.stringify({
            success: false,
            code: 'INSUFFICIENT_REAL_FUNDS',
            message: `Insufficient Real Money balance (KES ${currentBal.realBalance.toFixed(2)}). Please deposit at least 49 Bob via PayHero M-PESA to place this KES ${amount} bet.`,
            realBalance: currentBal.realBalance,
            minDeposit: 49,
            neededAmount: amount
          }));
        }

        if (mode === 'DEMO' && currentBal.demoBalance < amount) {
          res.writeHead(400, {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
          });
          return res.end(JSON.stringify({
            success: false,
            code: 'INSUFFICIENT_DEMO_FUNDS',
            message: 'Insufficient demo balance. Please refill your demo balance from the Account Hub.',
            demoBalance: currentBal.demoBalance
          }));
        }

        // Deduct stake from database
        db.updateBalance(phone, mode, -amount);
        const betId = db.recordBet(phone, mode, terminalId, amount, roundNonce);
        const updated = db.getBalances(phone);

        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify({
          success: true,
          betId,
          mode,
          amount,
          realBalance: updated.realBalance,
          demoBalance: updated.demoBalance
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Wallet API: Cashout Winnings to SQLite database
  if (pathname === '/api/wallet/cashout' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const phone = data.phone || '254712345678';
        const mode = (data.mode === 'REAL') ? 'REAL' : 'DEMO';
        const betId = parseInt(data.betId) || 0;
        const multiplier = parseFloat(data.multiplier) || 1.0;
        const payout = parseFloat(data.payout) || 0;
        const profit = parseFloat(data.profit) || 0;

        if (payout > 0) {
          db.updateBalance(phone, mode, payout);
        }
        if (betId > 0) {
          db.settleBet(betId, multiplier, payout, profit);
        }

        const updated = db.getBalances(phone);
        res.writeHead(200, {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*'
        });
        return res.end(JSON.stringify({
          success: true,
          mode,
          payout,
          realBalance: updated.realBalance,
          demoBalance: updated.demoBalance
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Password Reset Endpoint with SQLite 2x/Week Rate Limiting
  if (pathname === '/api/auth/reset-password' && req.method === 'POST') {
    let body = '';
    req.on('data', c => body += c);
    req.on('end', () => {
      try {
        const data = JSON.parse(body || '{}');
        const phone = data.phone || '';
        if (!phone) {
          res.writeHead(400, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({ success: false, error: 'Phone number required' }));
        }

        const rateCheck = db.checkResetRateLimit(phone);
        if (!rateCheck.allowed) {
          res.writeHead(429, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
          return res.end(JSON.stringify({
            success: false,
            error: 'RATE_LIMIT_EXCEEDED',
            message: 'Strict Security Limit: Password reset can only be performed a maximum of 2 times per rolling week. Please try again later or contact support.',
            ...rateCheck
          }));
        }

        db.recordResetAttempt(phone);
        const newRate = db.checkResetRateLimit(phone);
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({
          success: true,
          message: 'Password reset registered and OTP sent via Firebase Spark SMS gateway.',
          remainingResetsThisWeek: newRate.remainingResets
        }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ success: false, error: err.message }));
      }
    });
    return;
  }

  // Database Health & Reporting API
  if (pathname === '/api/database/stats' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify(db.getStats()));
  }

  if (pathname === '/') {
    pathname = '/index.html';
  }

  let safePath = path.normalize(path.join(BASE_DIR, pathname));

  // Security check: ensure path is within BASE_DIR
  if (!safePath.startsWith(BASE_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('403 Forbidden');
  }

  fs.stat(safePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      return res.end('404 Not Found: ' + pathname);
    }

    // If it's a directory, redirect to ensure trailing slash, then serve index.html
    if (stats.isDirectory()) {
      if (!parsedUrl.pathname.endsWith('/')) {
        res.writeHead(301, { 'Location': parsedUrl.pathname + '/' + (parsedUrl.search || '') });
        return res.end();
      }
      safePath = path.join(safePath, 'index.html');
    }

    fs.stat(safePath, (err2, stats2) => {
      if (err2 || !stats2.isFile()) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        return res.end('404 Not Found: ' + pathname);
      }

      const ext = path.extname(safePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';

      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Access-Control-Allow-Origin': '*'
      });

      const stream = fs.createReadStream(safePath);
      stream.pipe(res);
    });
  });
});

server.listen(PORT, () => {
  console.log(`[ShiftStack Aviator Simulator] Running at http://localhost:${PORT}`);
});
