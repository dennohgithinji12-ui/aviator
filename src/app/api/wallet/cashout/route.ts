import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getLiveRoundState } from '@/app/api/round-state/route';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({ success: false, code: 'AUTH_REQUIRED', message: 'Sign in to cash out a recorded bet' }, { status: 401 });
    }

    const mode = data.mode === 'REAL' ? 'REAL' : 'DEMO';
    const betId = Number(data.betId);
    const round = await getLiveRoundState();
    if (round.phase !== 'FLYING' || !Number.isInteger(betId)) {
      return NextResponse.json({ success: false, code: 'CASHOUT_CLOSED', message: 'Cashout is only available during flight' }, { status: 409 });
    }
    const settled = await prisma.$transaction(async (tx) => {
      const latestRound = await getLiveRoundState();
      if (latestRound.phase !== 'FLYING' || latestRound.nonce !== round.nonce) throw new Error('CASHOUT_CLOSED');
      const bet = await tx.bet.findFirst({ where: { id: betId, phone: session.phone, mode, roundNonce: round.nonce, status: 'ACTIVE' } });
      if (!bet) throw new Error('BET_NOT_ACTIVE');
      const multiplier = Math.floor(latestRound.currentMultiplier * 100) / 100;
      const payout = Math.floor(Number(bet.amount) * multiplier * 100) / 100;
      const changed = await tx.bet.updateMany({ where: { id: bet.id, status: 'ACTIVE' }, data: { cashedOut: 1, multiplier, payout, profit: payout - Number(bet.amount), status: 'WON' } });
      if (!changed.count) throw new Error('BET_NOT_ACTIVE');
      const balanceField = mode === 'REAL' ? 'realBalance' : 'demoBalance';
      const user = await tx.user.update({ where: { phone: session.phone }, data: { [balanceField]: { increment: payout } } });
      const balanceAfter = Number(mode === 'REAL' ? user.realBalance : user.demoBalance);
      await tx.walletTransaction.create({ data: {
        phone: session.phone, reference: `BET_${bet.id}_PAYOUT`, type: 'BET_PAYOUT', mode, amount: payout,
        balanceBefore: balanceAfter - payout, balanceAfter, createdAt: BigInt(Date.now()), metadata: { betId: bet.id, multiplier }
      } });
      return { user, payout, multiplier };
    });
    return NextResponse.json({
      success: true,
      mode,
      payout: settled.payout,
      multiplier: settled.multiplier,
      realBalance: Number(settled.user.realBalance),
      demoBalance: Number(settled.user.demoBalance)
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'BET_NOT_ACTIVE') {
      return NextResponse.json({ success: false, code: 'BET_NOT_ACTIVE', message: 'This bet is already settled or belongs to another round' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'CASHOUT_CLOSED') {
      return NextResponse.json({ success: false, code: 'CASHOUT_CLOSED', message: 'Cashout is only available during flight' }, { status: 409 });
    }
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
