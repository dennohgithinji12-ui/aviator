import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getLiveRoundState } from '@/app/api/round-state/route';

export async function POST(request: NextRequest) {
  const receivedAt = Date.now();
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const session = verifyToken(token);
  if (!session) return NextResponse.json({ success: false, message: 'Sign in to cancel a recorded bet' }, { status: 401 });

  const data = await request.json();
  const betId = Number(data.betId);
  if (!Number.isInteger(betId) || betId <= 0) return NextResponse.json({ success: false, message: 'A valid bet is required' }, { status: 400 });
  const round = await getLiveRoundState(receivedAt);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const bet = await tx.bet.findFirst({ where: { id: betId, phone: session.phone } });
      if (!bet) throw new Error('BET_NOT_ACTIVE');
      if (bet.status === 'CANCELLED') return tx.user.findUniqueOrThrow({ where: { phone: session.phone } });
      if (round.phase !== 'WAITING' || bet.roundNonce !== round.nonce) throw new Error('ROUND_CLOSED');
      if (bet.status !== 'ACTIVE') throw new Error('BET_NOT_ACTIVE');
      const changed = await tx.bet.updateMany({ where: { id: bet.id, status: 'ACTIVE' }, data: { status: 'CANCELLED' } });
      if (!changed.count) throw new Error('BET_NOT_ACTIVE');
      const balanceField = bet.mode === 'REAL' ? 'realBalance' : 'demoBalance';
      const user = await tx.user.update({ where: { phone: session.phone }, data: { [balanceField]: { increment: bet.amount } } });
      const balanceAfter = Number(bet.mode === 'REAL' ? user.realBalance : user.demoBalance);
      await tx.walletTransaction.create({ data: {
        phone: session.phone, reference: `BET_${bet.id}_REFUND`, type: 'BET_REFUND', mode: bet.mode, amount: bet.amount,
        balanceBefore: balanceAfter - Number(bet.amount), balanceAfter, createdAt: BigInt(Date.now()), metadata: { betId: bet.id }
      } });
      return user;
    });
    return NextResponse.json({ success: true, realBalance: Number(result.realBalance), demoBalance: Number(result.demoBalance) });
  } catch (error) {
    if (error instanceof Error && error.message === 'BET_NOT_ACTIVE') return NextResponse.json({ success: false, message: 'This bet is no longer active' }, { status: 409 });
    if (error instanceof Error && error.message === 'ROUND_CLOSED') return NextResponse.json({ success: false, message: 'Bets can only be cancelled before takeoff' }, { status: 409 });
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unable to cancel bet' }, { status: 500 });
  }
}
