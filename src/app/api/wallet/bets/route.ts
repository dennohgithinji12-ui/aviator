import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const session = verifyToken(token);
  if (!session) return NextResponse.json({ success: false, error: 'Sign in to view your bet history' }, { status: 401 });
  try {
    const bets = await prisma.bet.findMany({
      where: { phone: session.phone },
      orderBy: { createdAt: 'desc' },
      take: 50,
      select: { id: true, mode: true, terminalId: true, amount: true, roundNonce: true, multiplier: true, payout: true, profit: true, status: true, createdAt: true }
    });
    return NextResponse.json({ success: true, bets: bets.map((bet) => ({
      ...bet,
      amount: Number(bet.amount),
      multiplier: Number(bet.multiplier),
      payout: Number(bet.payout),
      profit: Number(bet.profit),
      createdAt: Number(bet.createdAt)
    })) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to load bet history' }, { status: 503 });
  }
}
