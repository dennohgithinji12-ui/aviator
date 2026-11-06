import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/admin-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) {
    return NextResponse.json({ success: false, error: 'Admin authentication required' }, { status: 401 });
  }

  try {
    const [users, bets, deposits, withdrawals, recentBets, withdrawalQueue] = await Promise.all([
      prisma.user.count(),
      prisma.bet.aggregate({ _count: true, _sum: { amount: true, payout: true } }),
      prisma.deposit.aggregate({ where: { status: 'SUCCESS' }, _count: true, _sum: { amount: true } }),
      prisma.withdrawal.aggregate({ where: { status: { not: 'PAYOUT_FAILED' } }, _count: true, _sum: { amount: true } }),
      prisma.bet.findMany({
        take: 30,
        orderBy: { createdAt: 'desc' },
        select: { id: true, mode: true, terminalId: true, amount: true, roundNonce: true, multiplier: true, payout: true, status: true, createdAt: true, phone: true }
      }),
      prisma.withdrawal.findMany({
        where: { status: { not: 'SETTLED' } },
        take: 50,
        orderBy: { createdAt: 'desc' },
        select: { id: true, phone: true, targetPhone: true, amount: true, taxAmount: true, netAmount: true, reference: true, status: true, riskReason: true, createdAt: true }
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
      })),
      withdrawalQueue: withdrawalQueue.map((withdrawal) => ({
        ...withdrawal,
        phone: `${withdrawal.phone.slice(0, 3)}••••${withdrawal.phone.slice(-2)}`,
        targetPhone: withdrawal.targetPhone ? `${withdrawal.targetPhone.slice(0, 3)}••••${withdrawal.targetPhone.slice(-2)}` : null,
        amount: Number(withdrawal.amount),
        taxAmount: Number(withdrawal.taxAmount),
        netAmount: Number(withdrawal.netAmount),
        createdAt: Number(withdrawal.createdAt)
      }))
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Dashboard data unavailable' }, { status: 500 });
  }
}
