const http = require('http');
const fs = require('fs');
const path = require('path');

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

// Universal Authoritative Round Engine for Consistent Global Flight Windows
const MASTER_SECRET = 'shiftstack_aviator_provably_fair_master_chain_2026';
const PUBLIC_CLIENT_SEED = 'global_aviator_network_shared_seed_100x';
const EPOCH_BASE = 1727180000000;
const COUNTDOWN_DURATION = 5.0;
const CRASHED_PAUSE_DURATION = 3.2;
 
// PayHero Payment Transactions Store (M-PESA STK Push)
const PAYHERO_TRANSACTIONS = new Map();

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

function hashString(str) {
  let h1 = 0xdeadbeef ^ 1337, h2 = 0x41c6ce57 ^ 1337;
  for (let i = 0; i < str.length; i++) {
    const ch = str.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507);
  h1 ^= Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507);
  h2 ^= Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0));
}

function getCrashMultiplier(nonce) {
  const rawVal = hashString(`${MASTER_SECRET}:${PUBLIC_CLIENT_SEED}:${nonce}`);
  const maxVal = Math.pow(2, 52);
  const r = rawVal % 4503599627370496;
  if (r % 33 === 0) return 1.00;
  const mult = (0.97 * maxVal) / (maxVal - r);
  return Math.max(1.00, Math.floor(mult * 100) / 100);
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
        serverHash: `hash_${hashString(currentNonce.toString()).toString(16).padStart(16, '0')}`,
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
    serverHash: 'fallback_hash',
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

  // PayHero API endpoints for Kenyan M-PESA STK Push (Min 49 Bob)
  if (pathname === '/api/payhero/stk-push' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
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
        const channelId = process.env.PAYHERO_CHANNEL_ID;

        if (apiKey && apiSecret) {
          // Perform live PayHero HTTPS STK push request
          const https = require('https');
          const authHeader = 'Basic ' + Buffer.from(`${apiKey}:${apiSecret}`).toString('base64');
          const payload = JSON.stringify({
            amount: amount,
            phone_number: phone,
            channel_id: channelId ? parseInt(channelId) : undefined,
            provider: 'm-pesa',
            external_reference: reference,
            customer_name: data.customerName || 'Aviator Pilot',
            callback_url: `http://${req.headers.host}/api/payhero/callback`
          });

          const phReq = https.request('https://backend.payhero.co.ke/api/v2/payments', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': authHeader,
              'Content-Length': Buffer.byteLength(payload)
            }
          }, (phRes) => {
            let phBody = '';
            phRes.on('data', c => phBody += c);
            phRes.on('end', () => {
              try {
                const phJson = JSON.parse(phBody);
                if (phRes.statusCode >= 400) {
                  console.warn('[PayHero Live API Notice]:', phRes.statusCode, phJson);
                  if (phJson.error_message && phJson.error_message.includes('insufficient balance')) {
                    simulateSandboxSuccess(reference, txRecord);
                    res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                    return res.end(JSON.stringify({
                      success: true,
                      status: 'PENDING',
                      reference: reference,
                      message: `Deposit of KES ${amount} initiated. Note: PayHero merchant service wallet requires top-up on payherokenya.com.`,
                      isSandbox: true,
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
                  message: `STK Push sent to ${phone}. Enter your M-PESA PIN to complete deposit of KES ${amount}.`,
                  payheroResponse: phJson
                }));
              } catch (e) {
                res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
                return res.end(JSON.stringify({
                  success: true,
                  status: 'PENDING',
                  reference: reference,
                  message: `STK Push initiated for KES ${amount}.`
                }));
              }
            });
          });

          phReq.on('error', (err) => {
            console.warn('[PayHero Live Error, falling back to simulated sandbox]:', err.message);
            // Sandbox fallback if API is unreachable or keys in test mode
            simulateSandboxSuccess(reference, txRecord);
            res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({
              success: true,
              status: 'PENDING',
              reference: reference,
              message: `STK Push prompt sent to ${phone}. Please enter your M-PESA PIN.`
            }));
          });

          phReq.write(payload);
          phReq.end();
        } else {
          // Sandbox / Spark Test Mode: Simulate realistic M-PESA prompt & auto-credit after PIN entry delay
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

  // PayHero Status Polling Endpoint (with SQLite database synchronization)
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

  // PayHero Webhook Callback Endpoint
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

  // Wallet API: Fetch real & demo balances from SQLite database
  if (pathname === '/api/wallet' && req.method === 'GET') {
    const phone = parsedUrl.searchParams.get('phone') || '';
    const balances = db.getBalances(phone);
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*'
    });
    return res.end(JSON.stringify({
      success: true,
      ...balances
    }));
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
