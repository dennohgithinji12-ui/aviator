import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('mode') === 'REAL' ? 'REAL' : 'DEMO';
  try {
    const previousRound = await prisma.round.findFirst({
      where: { settledAt: { not: null }, phase: 'CRASHED' },
      orderBy: { roundStartTime: 'desc' },
      select: { nonce: true, roundStartTime: true }
    });
    const [previous, top] = await Promise.all([
      previousRound ? prisma.bet.findMany({
        where: { roundNonce: previousRound.nonce, mode },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, phone: true, terminalId: true, amount: true, multiplier: true, payout: true, status: true, createdAt: true }
      }) : Promise.resolve([]),
      prisma.bet.findMany({
        where: { mode, status: 'WON', payout: { gt: 0 }, createdAt: { gte: BigInt(Date.now() - 30 * 86400000) } },
        orderBy: { payout: 'desc' },
        take: 20,
        select: { id: true, phone: true, amount: true, multiplier: true, payout: true, createdAt: true }
      })
    ]);
    const player = (phone: string) => `${phone.slice(0, 3)}••••${phone.slice(-2)}`;
    return NextResponse.json({
      success: true,
      mode,
      previousRound: previousRound ? { nonce: previousRound.nonce, timestamp: Number(previousRound.roundStartTime) } : null,
      previous: previous.map((bet) => ({ id: bet.id, player: player(bet.phone), terminalId: bet.terminalId, stake: Number(bet.amount), multiplier: Number(bet.multiplier), payout: Number(bet.payout), status: bet.status, timestamp: Number(bet.createdAt) })),
      top: top.map((bet) => ({ id: bet.id, player: player(bet.phone), stake: Number(bet.amount), multiplier: Number(bet.multiplier), payout: Number(bet.payout), timestamp: Number(bet.createdAt) }))
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Bet history is temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
