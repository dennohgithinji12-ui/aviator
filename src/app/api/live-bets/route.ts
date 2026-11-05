import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const roundNonce = Number(request.nextUrl.searchParams.get('roundNonce'));
  if (!Number.isInteger(roundNonce) || roundNonce < 0) return NextResponse.json({ success: false, error: 'A valid roundNonce is required' }, { status: 400 });
  try {
    const where = { roundNonce };
    const [bets, count, stakeTotal, cashedOut] = await Promise.all([
      prisma.bet.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100, select: { id: true, phone: true, mode: true, terminalId: true, amount: true, multiplier: true, payout: true, status: true, createdAt: true } }),
      prisma.bet.count({ where }),
      prisma.bet.aggregate({ where, _sum: { amount: true } }),
      prisma.bet.count({ where: { ...where, status: 'WON' } })
    ]);
    return NextResponse.json({
      success: true,
      roundNonce,
      totals: {
        count,
        stakeKes: Number(stakeTotal._sum.amount || 0),
        cashedOut
      },
      bets: bets.map((bet) => ({
        id: bet.id,
        player: `${bet.phone.slice(0, 3)}••••${bet.phone.slice(-2)}`,
        mode: bet.mode,
        terminalId: bet.terminalId,
        stake: Number(bet.amount),
        multiplier: Number(bet.multiplier),
        payout: Number(bet.payout),
        status: bet.status,
        createdAt: Number(bet.createdAt)
      }))
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Live bets are temporarily unavailable' }, { status: 500 });
  }
}
