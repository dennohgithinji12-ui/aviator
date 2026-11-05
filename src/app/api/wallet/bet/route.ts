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
      return NextResponse.json({
        success: false,
        code: 'AUTH_REQUIRED',
        message: 'Sign in to place a recorded bet'
      }, { status: 401 });
    }

    const mode = data.mode === 'REAL' ? 'REAL' : 'DEMO';
    const amount = Number(data.amount);
    const terminalId = Number(data.terminalId);
    const roundNonce = Number(data.roundNonce);
    if (!Number.isFinite(amount) || amount < 100 || amount > 100000 || !Number.isInteger(terminalId) || ![1, 2].includes(terminalId)) {
      return NextResponse.json({
        success: false, code: 'INVALID_BET', message: 'Stake must be KES 100–100,000 and terminal must be 1 or 2'
      }, { status: 400 });
    }
    const round = getLiveRoundState();
    if (round.phase !== 'WAITING' || round.nonce !== roundNonce) {
      return NextResponse.json({ success: false, code: 'ROUND_CLOSED', message: 'Betting is closed for this round' }, { status: 409 });
    }

    const balanceField = mode === 'REAL' ? 'realBalance' : 'demoBalance';
    const result = await prisma.$transaction(async (tx) => {
      const latestRound = getLiveRoundState();
      if (latestRound.phase !== 'WAITING' || latestRound.nonce !== roundNonce) throw new Error('ROUND_CLOSED');
      const existing = await tx.bet.findFirst({ where: { phone: session.phone, mode, terminalId, roundNonce, status: 'ACTIVE' } });
      if (existing) throw new Error('BET_ALREADY_PLACED');
      const debit = await tx.user.updateMany({ where: { phone: session.phone, [balanceField]: { gte: amount } }, data: { [balanceField]: { decrement: amount } } });
      if (!debit.count) throw new Error('INSUFFICIENT_FUNDS');
      const bet = await tx.bet.create({ data: { phone: session.phone, mode, terminalId, amount, roundNonce, status: 'ACTIVE', createdAt: BigInt(Date.now()) } });
      const user = await tx.user.findUniqueOrThrow({ where: { phone: session.phone } });
      return { bet, user };
    });

    return NextResponse.json({
      success: true,
      betId: result.bet.id,
      mode,
      amount,
      realBalance: Number(result.user.realBalance),
      demoBalance: Number(result.user.demoBalance)
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json({ success: false, code: 'INSUFFICIENT_FUNDS', message: 'Insufficient balance' }, { status: 400 });
    }
    if (error instanceof Error && error.message === 'BET_ALREADY_PLACED') {
      return NextResponse.json({ success: false, code: 'BET_ALREADY_PLACED', message: 'This terminal already has a bet in this round' }, { status: 409 });
    }
    if (error instanceof Error && error.message === 'ROUND_CLOSED') {
      return NextResponse.json({ success: false, code: 'ROUND_CLOSED', message: 'Betting is closed for this round' }, { status: 409 });
    }
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
