import { NextResponse } from 'next/server';
import { getLiveRoundState } from '@/app/api/round-state/route';

export const dynamic = 'force-dynamic';

export async function GET() {
  const round = getLiveRoundState();
  return NextResponse.json({
    round: {
      nonce: round.nonce,
      phase: round.phase,
      currentMultiplier: round.currentMultiplier,
      remainingSeconds: round.remainingSeconds,
      crashMultiplier: round.phase === 'CRASHED' ? round.crashMultiplier : null,
      commitment: round.serverHash,
      revealedSeed: round.phase === 'CRASHED' ? round.serverSeed : null
    },
    forecast: null,
    message: 'Crash outcomes are randomized. This app does not have a reliable way to forecast the next result.'
  }, { headers: { 'Cache-Control': 'no-store' } });
}
