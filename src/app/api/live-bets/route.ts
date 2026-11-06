import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { getLiveRoundState } from '@/app/api/round-state/route';

export const dynamic = 'force-dynamic';

interface SimulatedBet {
  id: string;
  player: string;
  stake: number;
  multiplier: number;
  visibleAt: number;
}

function createSimulatedBets(roundNonce: number, roundStartTime: number): SimulatedBet[] {
  // Preserve the legacy feed profile while making its round data consistent
  // across server instances and visitors.
  const digest = crypto.createHash('sha256').update(`demo-feed:${roundNonce}`).digest();
  let seed = digest.readUInt32BE(0);
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  const count = 75 + Math.floor(random() * 21);
  const names = [
    'b***3', 'w***1', 'k***8', 'a***9', 'o***4', 'd***2', 'f***7', 'm***0', 'j***5', 'v***1',
    'n***6', 'h***2', 'g***8', 'c***4', 'p***9', 'e***1', 'r***5', 't***8', 'l***2', 's***6',
    'z***3', 'y***7', 'x***4', 'u***9', 'i***2', 'q***5', 'k***4', 'm***9', 'j***7', 'b***8',
    'o***2', 'w***5', 'd***9', 'f***3', 's***1', 'a***4', 'c***7', 'p***2', 'v***6', 't***1',
    'r***8', 'e***4', 'l***9', 'g***3', 'n***5', 'h***8', 'z***7', 'y***2', 'x***8', 'u***3'
  ];
  const stakeBands = [200, 300, 400, 500, 750, 1000, 1500, 2000, 3500, 5000, 10000, 25000, 50000];
  const bets: SimulatedBet[] = [];

  for (let index = 0; index < count; index += 1) {
    const stakeRoll = random();
    const stakeIndex = stakeRoll < 0.45
      ? Math.floor(random() * 3)
      : stakeRoll < 0.80
        ? 3 + Math.floor(random() * 4)
        : stakeRoll < 0.95
          ? 7 + Math.floor(random() * 3)
          : 10 + Math.floor(random() * 3);
    const targetRoll = random();
    const target = targetRoll < 0.50
      ? 1.15 + random() * 1.05
      : targetRoll < 0.80
        ? 2.21 + random() * 2.80
        : targetRoll < 0.94
          ? 5.02 + random() * 9.50
          : 15 + random() * 55;
    bets.push({
      id: `demo-${roundNonce}-${index}`,
      player: names[Math.floor(random() * names.length)],
      stake: stakeBands[stakeIndex],
      multiplier: Math.round(target * 100) / 100,
      // Legacy placed rows at steady intervals through the open 4.2s window.
      visibleAt: roundStartTime + Math.floor(4200 * (index + 1) / (count + 1))
    });
  }

  return bets.sort((a, b) => b.stake - a.stake || a.id.localeCompare(b.id));
}

export async function GET(request: NextRequest) {
  const roundNonce = Number(request.nextUrl.searchParams.get('roundNonce'));
  if (!Number.isInteger(roundNonce) || roundNonce < 0) return NextResponse.json({ success: false, error: 'A valid roundNonce is required' }, { status: 400 });
  try {
    const round = await getLiveRoundState();
    if (round.nonce !== roundNonce) return NextResponse.json({ success: false, error: 'Round has changed' }, { status: 409 });
    const simulatedBets = createSimulatedBets(roundNonce, round.roundStartTime);
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
      serverTime: round.serverTime,
      phase: round.phase,
      simulatedBets,
      totals: { count, stakeKes: Number(stakeTotal._sum.amount || 0), cashedOut },
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
