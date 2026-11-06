import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getLiveRoundState } from '@/app/api/round-state/route';
import { persistRoundSnapshot } from '@/lib/db/round-settlement';

export const dynamic = 'force-dynamic';

async function runSettlement(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret) return NextResponse.json({ success: false, error: 'Settlement scheduler is not configured' }, { status: 503 });
  if (!supplied || supplied !== secret) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });

  try {
    const overdue = await prisma.round.findMany({ where: { settledAt: null, roundEndTime: { lte: BigInt(Date.now()) } }, orderBy: { roundStartTime: 'asc' }, take: 200 });
    for (const round of overdue) {
      const finalState = await getLiveRoundState(Number(round.roundEndTime) - 1);
      await persistRoundSnapshot({
        nonce: finalState.nonce,
        phase: finalState.phase,
        commitment: finalState.serverHash,
        serverSeed: finalState.serverSeed,
        clientSeed: finalState.clientSeed,
        crashMultiplier: finalState.crashMultiplier,
        roundStartTime: finalState.roundStartTime,
        roundEndTime: finalState.roundEndTime
      });
    }
    const settled = await prisma.round.count({ where: { settledAt: { gte: BigInt(Date.now() - 60_000) } } });
    return NextResponse.json({ success: true, overdueRoundsProcessed: overdue.length, roundsSettledInLastMinute: settled, checkedAt: Date.now() });
  } catch (error) {
    console.error('[cron:settle-rounds] reconciliation failed', error);
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Round settlement failed' }, { status: 500 });
  }
}

// Vercel Cron invokes scheduled routes with GET requests.
export async function GET(request: NextRequest) {
  return runSettlement(request);
}

// Keep POST available for manual scheduler integrations and operations.
export async function POST(request: NextRequest) {
  return runSettlement(request);
}
