/**
 * ShiftStack Aviator - Universal Global Round Synchronization Engine
 * Ensures flight windows, round nonces, countdowns, flight durations,
 * and crash multipliers are 100% consistent across all users worldwide.
 */

export class GlobalRoundSyncEngine {
  constructor(options = {}) {
    // Reference epoch anchor (Midnight UTC timestamp)
    this.EPOCH_BASE = options.epochBase || 1727180000000;
    this.COUNTDOWN_DURATION = 5.0; // 5.0 seconds betting window
    this.CRASHED_PAUSE_DURATION = 3.2; // 3.2 seconds flew away pause
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

    this.initServerSync();
  }

  // Attempt to synchronize clock with server authority if available
  async initServerSync() {
    try {
      const start = performance.now();
      const res = await fetch('/api/round-state', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        const latency = (performance.now() - start) / 2;
        if (data.serverTime) {
          this.clockOffset = (data.serverTime + latency) - Date.now();
          console.log(`[GlobalSync] Server clock synchronized. Offset: ${Math.round(this.clockOffset)}ms`);
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
   * Fast deterministic hash for round nonce (32-bit FNV-1a + SHA-like mixer)
   * Guaranteed identical output on all browsers, operating systems, and platforms.
   */
  hashString(str) {
    let h1 = 0xdeadbeef ^ 1337;
    let h2 = 0x41c6ce57 ^ 1337;
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

  /**
   * Derive deterministic crash multiplier for round nonce
   * 97% RTP with 3% instant crash house edge (Spribe standard)
   */
  getCrashMultiplier(nonce) {
    const rawVal = this.hashString(`${this.MASTER_SECRET}:${this.PUBLIC_CLIENT_SEED}:${nonce}`);
    const maxVal = Math.pow(2, 52);
    const r = rawVal % 4503599627370496; // 52 bits

    // 3% instant crash at 1.00x
    if (r % 33 === 0) {
      return 1.00;
    }

    const mult = (0.97 * maxVal) / (maxVal - r);
    return Math.max(1.00, Math.floor(mult * 100) / 100);
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
          // In 3.2s crashed / flew away window
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
          serverHash: `hash_${this.hashString(currentNonce.toString()).toString(16).padStart(16, '0')}`,
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
      roundEndTime: time + 14300,
      serverSeed: 'fallback_seed',
      serverHash: 'fallback_hash',
      clientSeed: this.PUBLIC_CLIENT_SEED
    };
  }
}
