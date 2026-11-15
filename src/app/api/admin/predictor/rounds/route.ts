import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';
import { getUpcomingRoundOutcomes } from '@/app/api/round-state/route';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return NextResponse.json({ success: false, error: 'Admin authentication required' }, { status: 401 });
  try {
    let schedule: Awaited<ReturnType<typeof getUpcomingRoundOutcomes>>;
    try {
      schedule = await getUpcomingRoundOutcomes(5);
    } catch (firstError) {
      console.warn('[admin/predictor/rounds] Retrying a failed schedule read:', firstError);
      schedule = await getUpcomingRoundOutcomes(5);
    }
    const { current, upcoming } = schedule;
    const verifiedRounds = upcoming.map((round) => {
      const scaledMultiplier = round.crashMultiplier * 100;
      const roundedHundredths = Math.round(scaledMultiplier);
      const multiplier = roundedHundredths / 100;
      if (!Number.isFinite(round.crashMultiplier) || multiplier < 1 || Math.abs(scaledMultiplier - roundedHundredths) > 0.000001) {
        throw new Error(`Invalid scheduled odds for round ${round.nonce}`);
      }
      return { ...round, crashMultiplier: multiplier };
    });
    return NextResponse.json({
      success: true,
      generatedAt: Date.now(),
      oddsPrecision: 2,
      source: 'game-engine-schedule',
      current: {
        nonce: current.nonce,
        phase: current.phase,
        currentMultiplier: current.currentMultiplier,
        scheduledMultiplier: Math.round(current.crashMultiplier * 100) / 100,
        remainingSeconds: current.remainingSeconds,
        roundStartTime: current.roundStartTime,
        flightDuration: current.flightDuration
      },
      upcoming: verifiedRounds
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('[admin/predictor/rounds] Failed to resolve the game schedule:', error);
    return NextResponse.json({ success: false, error: 'Unable to read the scheduled rounds' }, { status: 503 });
  }
}
