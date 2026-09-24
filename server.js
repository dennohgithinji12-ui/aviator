const http = require('http');
const fs = require('fs');
const path = require('path');

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
