import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { persistRoundSnapshot } from '@/lib/db/round-settlement';

// Game Constants (Preserved from server.js)
const MASTER_SECRET = 'shiftstack_aviator_provably_fair_master_chain_2026';
const PUBLIC_CLIENT_SEED = 'global_aviator_network_shared_seed_100x';
const EPOCH_BASE = 1727180000000;
const COUNTDOWN_DURATION = 5.0;
const CRASHED_PAUSE_DURATION = 3.0;

interface RoundState {
  serverTime: number;
  nonce: number;
  phase: 'WAITING' | 'FLYING' | 'CRASHED';
  crashMultiplier: number;
  flightDuration: number;
  currentMultiplier: number;
  remainingSeconds: number;
  elapsedFlightSeconds: number;
  roundStartTime: number;
  roundEndTime: number;
  serverHash: string;
  serverSeed: string;
  clientSeed: string;
}

function getCrashMultiplier(nonce: number): number {
  const hmac = crypto.createHmac('sha256', MASTER_SECRET);
  hmac.update(`${PUBLIC_CLIENT_SEED}:${nonce}`);
  const hexHash = hmac.digest('hex');

  const subHash = hexHash.substring(0, 13);
  const h = parseInt(subHash, 16);
  const e = Math.pow(2, 52);

  if (h % 33 === 0) {
    return 1.00;
  }

  const multiplier = Math.floor((100 * e - h) / (e - h)) / 100;
  return Math.max(1.00, multiplier);
}

function getFlightDuration(targetMultiplier: number): number {
  if (targetMultiplier <= 1.00) return 0;
  let low = 0, high = 160;
  for (let i = 0; i < 26; i++) {
    const mid = (low + high) / 2;
    const m = Math.pow(Math.E, 0.072 * mid) + (0.012 * mid * mid);
    if (m < targetMultiplier) low = mid; else high = mid;
  }
  return (low + high) / 2;
}

function computeMultiplierFromTime(t: number): number {
  if (t <= 0) return 1.00;
  const val = Math.pow(Math.E, 0.072 * t) + (0.012 * t * t);
  return Math.max(1.00, Math.floor(val * 100) / 100);
}

interface ServerRound {
  nonce: number;
  serverSeed: string;
  crashMultiplier: number;
  flightDuration: number;
  roundStartTime: number;
  roundEndTime: number;
  serverHash: string;
}

let cachedServerRound: ServerRound | null = null;
let lastPersistedSnapshotKey: string | null = null;
let lastPersistenceAttemptKey: string | null = null;

function computeServerPhaseForRound(round: ServerRound, time: number): RoundState {
  const elapsedInRoundMs = time - round.roundStartTime;
  const countdownDurationMs = COUNTDOWN_DURATION * 1000;
  const flightDurationMs = round.flightDuration * 1000;

  let phase: 'WAITING' | 'FLYING' | 'CRASHED' = 'WAITING';
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
    currentMultiplier = Math.min(round.crashMultiplier, computeMultiplierFromTime(elapsedFlightSeconds));
  } else {
    phase = 'CRASHED';
    currentMultiplier = round.crashMultiplier;
    remainingSeconds = 0;
  }

  return {
    serverTime: time,
    nonce: round.nonce,
    phase,
    crashMultiplier: round.crashMultiplier,
    flightDuration: round.flightDuration,
    currentMultiplier,
    remainingSeconds: Math.max(0, remainingSeconds),
    elapsedFlightSeconds: Math.max(0, elapsedFlightSeconds),
    roundStartTime: round.roundStartTime,
    roundEndTime: round.roundEndTime,
    serverHash: round.serverHash,
    serverSeed: phase === 'CRASHED' ? round.serverSeed : '',
    clientSeed: PUBLIC_CLIENT_SEED
  };
}

export async function getLiveRoundState(time: number = Date.now()): Promise<RoundState> {
  const normalizedTime = Math.floor(time);
  if (cachedServerRound && normalizedTime >= cachedServerRound.roundStartTime && normalizedTime < cachedServerRound.roundEndTime) {
    return computeServerPhaseForRound(cachedServerRound, normalizedTime);
  }

  const HOUR_MS = 3600000;
  const hourBlockIndex = Math.floor((normalizedTime - EPOCH_BASE) / HOUR_MS);
  const hourStartTime = EPOCH_BASE + hourBlockIndex * HOUR_MS;
  let currentNonce: number;
  let roundStart: number;

  if (cachedServerRound && cachedServerRound.roundEndTime > hourStartTime && cachedServerRound.roundEndTime <= normalizedTime) {
    currentNonce = cachedServerRound.nonce + 1;
    roundStart = cachedServerRound.roundEndTime;
  } else {
    currentNonce = hourBlockIndex * 250;
    roundStart = hourStartTime;
  }

  let roundsExamined = 0;
  while (roundsExamined < 100_000) {
    roundsExamined += 1;
    const crashMultiplier = getCrashMultiplier(currentNonce);
    const serverSeed = '';
    const flightDuration = getFlightDuration(crashMultiplier);
    const totalDuration = COUNTDOWN_DURATION + flightDuration + CRASHED_PAUSE_DURATION;
    const roundEnd = Math.floor(roundStart + totalDuration * 1000);

    if (normalizedTime >= roundStart && normalizedTime < roundEnd) {
      cachedServerRound = {
        nonce: currentNonce,
        serverSeed,
        crashMultiplier,
        flightDuration,
        roundStartTime: roundStart,
        roundEndTime: roundEnd,
        serverHash: crypto.createHash('sha256').update(`${MASTER_SECRET}:${currentNonce}`).digest('hex')
      };
      return computeServerPhaseForRound(cachedServerRound, normalizedTime);
    }

    roundStart = roundEnd;
    currentNonce++;
  }
  throw new Error('Unable to resolve the shared game round schedule');
}

export async function GET() {
  let state: RoundState;
  try {
    state = await getLiveRoundState();
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Round service unavailable' }, { status: 503 });
  }
  let persistenceAvailable = true;
  const snapshotKey = `${state.nonce}:${state.phase}`;
  // Keep the frequently-polled countdown and flight response independent of
  // database writes. The crashed snapshot creates/updates the history row and
  // settles losing bets, so there is no need to persist WAITING or FLYING here.
  if (state.phase === 'CRASHED' && lastPersistedSnapshotKey !== snapshotKey && lastPersistenceAttemptKey !== snapshotKey) {
    lastPersistenceAttemptKey = snapshotKey;
    try {
      await persistRoundSnapshot({
        nonce: state.nonce,
        phase: state.phase,
        commitment: state.serverHash,
        serverSeed: state.serverSeed,
        clientSeed: state.clientSeed,
        crashMultiplier: state.crashMultiplier,
        roundStartTime: state.roundStartTime,
        roundEndTime: state.roundEndTime
      });
      lastPersistedSnapshotKey = snapshotKey;
    }
    catch {
      persistenceAvailable = false;
    }
  }
  // Publish only values required to animate the active round. The outcome is
  // disclosed after the crash, never while bets can still be placed.
  return NextResponse.json({
    ...state,
    persistenceAvailable,
    crashMultiplier: state.phase === 'CRASHED' ? state.crashMultiplier : 0,
    flightDuration: state.phase === 'CRASHED' ? state.flightDuration : 0,
    roundEndTime: state.phase === 'CRASHED' ? state.roundEndTime : 0
  }, { headers: { 'Cache-Control': 'no-store' } });
}
