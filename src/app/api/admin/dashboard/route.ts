import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function authorized(request: NextRequest) {
  const configuredKey = process.env.ADMIN_API_KEY;
  const suppliedKey = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  return Boolean(configuredKey && suppliedKey && suppliedKey === configuredKey);
}

export async function GET(request: NextRequest) {
  if (!process.env.ADMIN_API_KEY) {
    return NextResponse.json({ success: false, error: 'Admin access is not configured' }, { status: 503 });
  }
  if (!authorized(request)) {
    return NextResponse.json({ success: false, error: 'Admin authentication required' }, { status: 401 });
  }

  try {
    const [users, bets, deposits, withdrawals, recentBets] = await Promise.all([
      prisma.user.count(),
      prisma.bet.aggregate({ _count: true, _sum: { amount: true, payout: true } }),
      prisma.deposit.aggregate({ where: { status: 'SUCCESS' }, _count: true, _sum: { amount: true } }),
      prisma.withdrawal.aggregate({ where: { status: { in: ['PROCESSING', 'SETTLED'] } }, _count: true, _sum: { amount: true } }),
      prisma.bet.findMany({
        take: 30,
        orderBy: { createdAt: 'desc' },
        select: { id: true, mode: true, terminalId: true, amount: true, roundNonce: true, multiplier: true, payout: true, status: true, createdAt: true, phone: true }
      })
    ]);

    return NextResponse.json({
      success: true,
      generatedAt: Date.now(),
      summary: {
        users,
        bets: bets._count,
        stakedKes: Number(bets._sum.amount || 0),
        paidOutKes: Number(bets._sum.payout || 0),
        deposits: deposits._count,
        depositedKes: Number(deposits._sum.amount || 0),
        withdrawals: withdrawals._count,
        withdrawnKes: Number(withdrawals._sum.amount || 0)
      },
      recentBets: recentBets.map((bet) => ({
        ...bet,
        phone: `${bet.phone.slice(0, 3)}••••${bet.phone.slice(-2)}`,
        amount: Number(bet.amount),
        multiplier: Number(bet.multiplier),
        payout: Number(bet.payout),
        createdAt: Number(bet.createdAt)
      }))
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Dashboard data unavailable' }, { status: 500 });
  }
}
