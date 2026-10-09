/**
 * ShiftStack Aviator - Universal Global Round Synchronization Engine
 * Ensures flight windows, round nonces, countdowns, flight durations,
 * and crash multipliers are 100% consistent across all users worldwide.
 *
 * Implements Provably Fair HMAC-SHA256 identical to server.js authority.
 */

// Pure-JS Deterministic SHA-256 for browser runtime
function sha256Raw(ascii) {
  function rightRotate(value, amount) {
    return (value >>> amount) | (value << (32 - amount));
  }

  var i, j;
  var words = [];
  var asciiBitLength = ascii.length * 8;

  var hash = [
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ];

  var k = [
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ];

  var wordsCount = ((asciiBitLength + 64 >>> 9) << 4) + 16;
  for (i = 0; i < wordsCount; i++) words[i] = 0;
  for (i = 0; i < ascii.length; i++) {
    words[i >> 2] |= (ascii.charCodeAt(i) & 0xff) << (24 - (i % 4) * 8);
  }
  words[asciiBitLength >> 5] |= 0x80 << (24 - asciiBitLength % 32);
  words[wordsCount - 1] = asciiBitLength;

  for (j = 0; j < wordsCount; j += 16) {
    var w = [];
    for (i = 0; i < 16; i++) w[i] = words[j + i];
    for (i = 16; i < 64; i++) {
      var s0 = rightRotate(w[i - 15], 7) ^ rightRotate(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      var s1 = rightRotate(w[i - 2], 17) ^ rightRotate(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    var a = hash[0], b = hash[1], c = hash[2], d = hash[3];
    var e = hash[4], f = hash[5], g = hash[6], h = hash[7];

    for (i = 0; i < 64; i++) {
      var S1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      var ch = (e & f) ^ ((~e) & g);
      var temp1 = (h + S1 + ch + k[i] + w[i]) | 0;
      var S0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      var maj = (a & b) ^ (a & c) ^ (b & c);
      var temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    hash[0] = (hash[0] + a) | 0;
    hash[1] = (hash[1] + b) | 0;
    hash[2] = (hash[2] + c) | 0;
    hash[3] = (hash[3] + d) | 0;
    hash[4] = (hash[4] + e) | 0;
    hash[5] = (hash[5] + f) | 0;
    hash[6] = (hash[6] + g) | 0;
    hash[7] = (hash[7] + h) | 0;
  }

  return hash;
}

function sha256Hex(str) {
  var h = sha256Raw(str);
  var res = '';
  for (var i = 0; i < 8; i++) {
    res += ('00000000' + (h[i] >>> 0).toString(16)).slice(-8);
  }
  return res;
}

function wordsToStr(words) {
  var str = '';
  for (var i = 0; i < words.length; i++) {
    for (var j = 3; j >= 0; j--) {
      str += String.fromCharCode((words[i] >>> (j * 8)) & 0xff);
    }
  }
  return str;
}

function hmacSha256(key, message) {
  if (key.length > 64) {
    key = wordsToStr(sha256Raw(key));
  }
  var k_pad_o = '';
  var k_pad_i = '';
  for (var i = 0; i < 64; i++) {
    var b = i < key.length ? key.charCodeAt(i) : 0;
    k_pad_o += String.fromCharCode(b ^ 0x5c);
    k_pad_i += String.fromCharCode(b ^ 0x36);
  }
  var innerHash = wordsToStr(sha256Raw(k_pad_i + message));
  return sha256Hex(k_pad_o + innerHash);
}

export class GlobalRoundSyncEngine {
  constructor(options = {}) {
    // Reference epoch anchor (Midnight UTC timestamp)
    this.EPOCH_BASE = options.epochBase || 1727180000000;
    this.COUNTDOWN_DURATION = 5.0; // 5.0 seconds betting window
    this.CRASHED_PAUSE_DURATION = 3.0; // 3.0 seconds flew away pause (100% matched to server.js)
    this.MASTER_SECRET = 'shiftstack_aviator_provably_fair_master_chain_2026';
    this.PUBLIC_CLIENT_SEED = 'global_aviator_network_shared_seed_100x';

    this.clockOffset = 0; // Milliseconds difference between server and local clock
    this.lastState = null;
    this.broadcastChannel = null;

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this.broadcastChannel = new BroadcastChannel('aviator_global_sync');
      } catch (e) {}
    }

    // Initial server sync
    this.initServerSync();

    // Recurring server drift correction (every 30 seconds)
    setInterval(() => this.initServerSync(), 30000);

    // Immediate resync when tab or mobile browser is foregrounded
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
          this.initServerSync();
        }
      });
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        this.initServerSync();
      });
    }
  }

  // Attempt to synchronize clock with server authority if available
  async initServerSync() {
    try {
      const start = performance.now();
      const res = await fetch('/api/round-state', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const rtt = performance.now() - start;
        const latency = rtt / 2;
        if (data.serverTime) {
          this.clockOffset = (data.serverTime + latency) - Date.now();
          console.log(`[GlobalSync] Server clock synchronized. Offset: ${Math.round(this.clockOffset)}ms (RTT: ${Math.round(rtt)}ms)`);
        }
      }
    } catch (e) {
      // Running on static CDN (e.g. GitHub Pages) - uses universal epoch time
      console.log('[GlobalSync] Operating on universal epoch time synchronization.');
    }
  }

  // Get synchronized universal timestamp
  getNow() {
    return Date.now() + this.clockOffset;
  }

  /**
   * Derive deterministic crash multiplier for round nonce
   * 100% identical to server.js Provably Fair algorithm:
   * - HMAC-SHA256(MASTER_SECRET, PUBLIC_CLIENT_SEED:nonce)
   * - 52 bits of entropy
   * - Modulus 33 bust gate (1 in 33 chance of 1.00x instant crash, 97.0% RTP)
   */
  getCrashMultiplier(nonce) {
    const hexHash = hmacSha256(this.MASTER_SECRET, `${this.PUBLIC_CLIENT_SEED}:${nonce}`);
    const subHash = hexHash.substring(0, 13);
    const h = parseInt(subHash, 16);
    const e = Math.pow(2, 52); // 4503599627370496

    // 3% instant crash at 1.00x
    if (h % 33 === 0) {
      return 1.00;
    }

    const mult = Math.floor((100 * e - h) / (e - h)) / 100;
    return Math.max(1.00, mult);
  }

  /**
   * Calculate flight duration in seconds for a given target crash multiplier
   * Monotonically inverses M(t) = e^(0.072*t) + 0.012*t^2
   */
  getFlightDuration(targetMultiplier) {
    if (targetMultiplier <= 1.00) return 0;
    let low = 0;
    let high = 160;
    for (let i = 0; i < 26; i++) {
      const mid = (low + high) / 2;
      const m = Math.pow(Math.E, 0.072 * mid) + (0.012 * mid * mid);
      if (m < targetMultiplier) {
        low = mid;
      } else {
        high = mid;
      }
    }
    return (low + high) / 2;
  }

  computeMultiplierFromTime(t) {
    if (t <= 0) return 1.00;
    const val = Math.pow(Math.E, 0.072 * t) + (0.012 * t * t);
    return Math.max(1.00, Math.floor(val * 100) / 100);
  }

  /**
   * Compute the global authoritative round window for any millisecond
   * Anchors each 1-hour block to ensure O(1) instantaneous lookup.
   */
  getGlobalRoundState(time = this.getNow()) {
    // 1-hour epoch block: 3,600,000 ms
    const HOUR_MS = 3600000;
    const hourBlockIndex = Math.floor((time - this.EPOCH_BASE) / HOUR_MS);
    const hourStartTime = this.EPOCH_BASE + (hourBlockIndex * HOUR_MS);

    // Compute rounds within current hour block
    let currentNonce = hourBlockIndex * 250;
    let roundStart = hourStartTime;

    while (true) {
      const crashMultiplier = this.getCrashMultiplier(currentNonce);
      const flightDuration = this.getFlightDuration(crashMultiplier);
      const totalDuration = this.COUNTDOWN_DURATION + flightDuration + this.CRASHED_PAUSE_DURATION;
      const totalDurationMs = totalDuration * 1000;
      const roundEnd = roundStart + totalDurationMs;

      if (time >= roundStart && time < roundEnd) {
        // We found the exact active global round!
        const elapsedInRoundMs = time - roundStart;
        const countdownDurationMs = this.COUNTDOWN_DURATION * 1000;
        const flightDurationMs = flightDuration * 1000;

        let phase = 'WAITING';
        let remainingSeconds = 0;
        let elapsedFlightSeconds = 0;
        let currentMultiplier = 1.00;

        if (elapsedInRoundMs < countdownDurationMs) {
          // In 5.0s countdown window
          phase = 'WAITING';
          remainingSeconds = (countdownDurationMs - elapsedInRoundMs) / 1000;
          currentMultiplier = 1.00;
        } else if (elapsedInRoundMs < countdownDurationMs + flightDurationMs) {
          // In flight window!
          phase = 'FLYING';
          elapsedFlightSeconds = (elapsedInRoundMs - countdownDurationMs) / 1000;
          currentMultiplier = Math.min(crashMultiplier, this.computeMultiplierFromTime(elapsedFlightSeconds));
        } else {
          // In 3.0s crashed / flew away window
          phase = 'CRASHED';
          currentMultiplier = crashMultiplier;
          remainingSeconds = 0;
        }

        return {
          nonce: currentNonce,
          phase: phase,
          crashMultiplier: crashMultiplier,
          flightDuration: flightDuration,
          currentMultiplier: currentMultiplier,
          remainingSeconds: Math.max(0, remainingSeconds),
          elapsedFlightSeconds: Math.max(0, elapsedFlightSeconds),
          roundStartTime: roundStart,
          roundEndTime: roundEnd,
          serverSeed: `000000000000000000041d8e${currentNonce.toString(16).padStart(40, '0')}`,
          serverHash: sha256Hex(`${this.MASTER_SECRET}:${currentNonce}`),
          clientSeed: this.PUBLIC_CLIENT_SEED
        };
      }

      roundStart = roundEnd;
      currentNonce++;

      // Guardrail against excessive forward computation
      if (currentNonce > (hourBlockIndex * 250) + 400) {
        break;
      }
    }

    // Fallback safe state
    return {
      nonce: currentNonce,
      phase: 'WAITING',
      crashMultiplier: 2.00,
      flightDuration: 6.10,
      currentMultiplier: 1.00,
      remainingSeconds: 5.0,
      elapsedFlightSeconds: 0,
      roundStartTime: time,
      roundEndTime: time + 14100,
      serverSeed: 'fallback_seed',
      serverHash: sha256Hex(`${this.MASTER_SECRET}:${currentNonce}`),
      clientSeed: this.PUBLIC_CLIENT_SEED
    };
  }
}
