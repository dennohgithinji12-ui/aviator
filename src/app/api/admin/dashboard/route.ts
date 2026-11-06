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
    const now = Date.now();
    const oneDayAgo = BigInt(now - 24 * 60 * 60 * 1000);
    const today = new Date();
    const firstChartDay = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - 13);
    const chartStart = BigInt(firstChartDay);
    const [users, activeUsers24h, completedRounds, bets, deposits, withdrawals, pendingWithdrawals, recentBets, withdrawalQueue, dailyBets, dailyDeposits, dailyRounds] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { lastLogin: { gte: oneDayAgo } } }),
      prisma.round.count({ where: { settledAt: { not: null } } }),
      prisma.bet.aggregate({ _count: true, _sum: { amount: true, payout: true } }),
      prisma.deposit.aggregate({ where: { status: 'SUCCESS' }, _count: true, _sum: { amount: true } }),
      prisma.withdrawal.aggregate({ where: { status: 'SETTLED' }, _count: true, _sum: { amount: true, netAmount: true } }),
      prisma.withdrawal.count({ where: { status: { notIn: ['SETTLED', 'PAYOUT_FAILED'] } } }),
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
      }),
      prisma.$queryRaw<Array<{ day: bigint; bets: bigint; staked: number; paid: number }>>`
        SELECT floor("createdAt"::numeric / 86400000)::bigint AS day,
          count(*)::bigint AS bets,
          coalesce(sum("amount"), 0)::double precision AS staked,
          coalesce(sum("payout"), 0)::double precision AS paid
        FROM "Bet" WHERE "createdAt" >= ${chartStart} GROUP BY day ORDER BY day
      `,
      prisma.$queryRaw<Array<{ day: bigint; deposits: bigint; amount: number }>>`
        SELECT floor("createdAt"::numeric / 86400000)::bigint AS day,
          count(*)::bigint AS deposits,
          coalesce(sum("amount"), 0)::double precision AS amount
        FROM "Deposit" WHERE "status" = 'SUCCESS' AND "createdAt" >= ${chartStart} GROUP BY day ORDER BY day
      `,
      prisma.$queryRaw<Array<{ day: bigint; games: bigint }>>`
        SELECT floor("roundEndTime"::numeric / 86400000)::bigint AS day,
          count(*)::bigint AS games
        FROM "Round" WHERE "settledAt" IS NOT NULL AND "roundEndTime" >= ${chartStart} GROUP BY day ORDER BY day
      `
    ]);

    const dayMap = new Map<number, { date: string; games: number; bets: number; stakedKes: number; depositedKes: number; payoutsKes: number }>();
    for (let offset = 0; offset < 14; offset += 1) {
      const dayIndex = Math.floor(firstChartDay / 86400000) + offset;
      dayMap.set(dayIndex, { date: new Date(dayIndex * 86400000).toISOString().slice(0, 10), games: 0, bets: 0, stakedKes: 0, depositedKes: 0, payoutsKes: 0 });
    }
    for (const row of dailyBets) {
      const entry = dayMap.get(Number(row.day));
      if (entry) { entry.bets = Number(row.bets); entry.stakedKes = Number(row.staked); entry.payoutsKes = Number(row.paid); }
    }
    for (const row of dailyDeposits) {
      const entry = dayMap.get(Number(row.day));
      if (entry) entry.depositedKes = Number(row.amount);
    }
    for (const row of dailyRounds) {
      const entry = dayMap.get(Number(row.day));
      if (entry) entry.games = Number(row.games);
    }

    return NextResponse.json({
      success: true,
      generatedAt: Date.now(),
      summary: {
        users,
        activeUsers24h,
        completedRounds,
        bets: bets._count,
        stakedKes: Number(bets._sum.amount || 0),
        paidOutKes: Number(bets._sum.payout || 0),
        deposits: deposits._count,
        depositedKes: Number(deposits._sum.amount || 0),
        withdrawals: withdrawals._count,
        withdrawnKes: Number(withdrawals._sum.netAmount || 0),
        pendingWithdrawals
      },
      daily: Array.from(dayMap.values()),
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
