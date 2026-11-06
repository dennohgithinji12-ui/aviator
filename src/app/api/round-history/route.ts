import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const rounds = await prisma.round.findMany({
      where: { phase: 'CRASHED', settledAt: { not: null }, crashMultiplier: { not: null } },
      orderBy: { roundStartTime: 'desc' },
      take: 40,
      select: { nonce: true, crashMultiplier: true, commitment: true, serverSeed: true, clientSeed: true, roundStartTime: true }
    });
    return NextResponse.json({ success: true, rounds: rounds.map((round) => ({
      nonce: round.nonce,
      multiplier: Number(round.crashMultiplier),
      commitment: round.commitment,
      serverSeed: round.serverSeed,
      clientSeed: round.clientSeed,
      timestamp: Number(round.roundStartTime)
    })) }, { headers: { 'Cache-Control': 'private, max-age=2, stale-while-revalidate=10' } });
  } catch {
    return NextResponse.json({ success: false, rounds: [] }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
