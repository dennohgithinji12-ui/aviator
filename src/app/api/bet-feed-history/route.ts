import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function createSimulatedPreviousBets(roundNonce: number, roundStartTime: number, crashMultiplier: number) {
  const digest = crypto.createHash('sha256').update(`demo-feed:${roundNonce}`).digest();
  let seed = digest.readUInt32BE(0);
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 0x1_0000_0000;
  };
  const count = 70 + Math.floor(random() * 20);
  const names = [
    'b***3', 'w***1', 'k***8', 'a***9', 'o***4', 'd***2', 'f***7', 'm***0', 'j***5', 'v***1',
    'n***6', 'h***2', 'g***8', 'c***4', 'p***9', 'e***1', 'r***5', 't***8', 'l***2', 's***6',
    'z***3', 'y***7', 'x***4', 'u***9', 'i***2', 'q***5', 'k***4', 'm***9', 'j***7', 'b***8',
    'o***2', 'w***5', 'd***9', 'f***3', 's***1', 'a***4', 'c***7', 'p***2', 'v***6', 't***1',
    'r***8', 'e***4', 'l***9', 'g***3', 'n***5', 'h***8', 'z***7', 'y***2', 'x***8', 'u***3'
  ];
  const stakeBands = [200, 300, 400, 500, 750, 1000, 1500, 2000, 3500, 5000, 10000, 25000, 50000];
  const bets = [];

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
    const targetMultiplier = Math.round(target * 100) / 100;
    const won = targetMultiplier <= crashMultiplier;
    const stake = stakeBands[stakeIndex];
    bets.push({
      id: `prev-sim-${roundNonce}-${index}`,
      player: names[Math.floor(random() * names.length)],
      terminalId: 1,
      stake,
      multiplier: won ? targetMultiplier : 0,
      payout: won ? Math.floor(stake * targetMultiplier * 100) / 100 : 0,
      status: won ? 'WON' : 'LOST',
      mode: 'DEMO',
      timestamp: roundStartTime
    });
  }

  return bets.sort((a, b) => b.stake - a.stake);
}

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('mode') === 'REAL' ? 'REAL' : 'DEMO';
  const nonceParam = request.nextUrl.searchParams.get('nonce');
  const clientNonce = nonceParam ? parseInt(nonceParam, 10) : null;

  try {
    // Locate the previous finished round:
    // If client provided a nonce, target that round or clientNonce - 1; otherwise latest crashed
    let previousRound = null;
    if (clientNonce && clientNonce > 0) {
      previousRound = await prisma.round.findFirst({
        where: { nonce: clientNonce, settledAt: { not: null } },
        select: { nonce: true, roundStartTime: true, crashMultiplier: true }
      });
      if (!previousRound && clientNonce > 1) {
        previousRound = await prisma.round.findFirst({
          where: { nonce: clientNonce - 1, settledAt: { not: null } },
          select: { nonce: true, roundStartTime: true, crashMultiplier: true }
        });
      }
    }

    if (!previousRound) {
      previousRound = await prisma.round.findFirst({
        where: { settledAt: { not: null }, phase: 'CRASHED' },
        orderBy: { roundStartTime: 'desc' },
        select: { nonce: true, roundStartTime: true, crashMultiplier: true }
      });
    }

    const prevNonce = previousRound?.nonce ?? (clientNonce ? clientNonce - 1 : 1);
    const prevTime = previousRound ? Number(previousRound.roundStartTime) : Date.now() - 15000;
    const prevCrash = previousRound?.crashMultiplier ? Number(previousRound.crashMultiplier) : 2.15;

    const [dbBets, top] = await Promise.all([
      previousRound ? prisma.bet.findMany({
        where: { roundNonce: previousRound.nonce },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, phone: true, terminalId: true, amount: true, multiplier: true, payout: true, status: true, createdAt: true, mode: true }
      }) : Promise.resolve([]),
      prisma.bet.findMany({
        where: { mode, status: 'WON', payout: { gt: 0 }, createdAt: { gte: BigInt(Date.now() - 30 * 86400000) } },
        orderBy: { multiplier: 'desc' },
        take: 20,
        select: { id: true, phone: true, amount: true, multiplier: true, payout: true, createdAt: true, user: { select: { username: true } } }
      })
    ]);

    const maskPhone = (phone: string) => `${phone.slice(0, 3)}••••${phone.slice(-2)}`;

    const alias = (phone: string, username: string | null | undefined): string => {
      if (username && username.length >= 2) {
        const first = username[0].toLowerCase();
        const last = username[username.length - 1].toLowerCase();
        return `${first}***${last}`;
      }
      const digits = phone.replace(/\D/g, '');
      const letter = String.fromCharCode(97 + (Number(digits[0] ?? '0') % 10));
      const tail = digits[digits.length - 1] ?? '0';
      return `${letter}***${tail}`;
    };

    const formattedDbBets = dbBets.map((bet) => ({
      id: bet.id,
      player: maskPhone(bet.phone),
      terminalId: bet.terminalId,
      stake: Number(bet.amount),
      multiplier: Number(bet.multiplier),
      payout: Number(bet.payout),
      status: bet.status,
      mode: bet.mode,
      timestamp: Number(bet.createdAt)
    }));

    // If mode is DEMO or no real DB bets were recorded in that round, supplement with simulated bets
    let previousList = formattedDbBets;
    if (mode === 'DEMO' || formattedDbBets.length === 0) {
      const simulatedList = createSimulatedPreviousBets(prevNonce, prevTime, prevCrash);
      previousList = [...formattedDbBets, ...simulatedList].sort((a, b) => b.stake - a.stake);
    }

    return NextResponse.json({
      success: true,
      mode,
      previousRound: { nonce: prevNonce, timestamp: prevTime, crashMultiplier: prevCrash },
      previous: previousList,
      top: top.map((bet) => ({
        id: bet.id,
        player: alias(bet.phone, bet.user?.username),
        stake: Number(bet.amount),
        multiplier: Number(bet.multiplier),
        payout: Number(bet.payout),
        timestamp: Number(bet.createdAt)
      }))
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    // If DB has a temporary hiccup, provide fallback simulated data so the UI remains active
    const fallbackNonce = clientNonce ? clientNonce - 1 : 1;
    const fallbackSim = createSimulatedPreviousBets(fallbackNonce, Date.now() - 15000, 2.15);
    return NextResponse.json({
      success: true,
      mode,
      previousRound: { nonce: fallbackNonce, timestamp: Date.now() - 15000, crashMultiplier: 2.15 },
      previous: fallbackSim,
      top: []
    }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
