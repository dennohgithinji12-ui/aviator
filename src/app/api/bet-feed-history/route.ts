import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const mode = request.nextUrl.searchParams.get('mode') === 'REAL' ? 'REAL' : 'DEMO';
  // Allow the client to pass the nonce of the round that just ended so we
  // always show the freshest history even if a newer round has already started.
  const nonceParam = request.nextUrl.searchParams.get('nonce');
  const clientNonce = nonceParam ? parseInt(nonceParam, 10) : null;
  try {
    // Use the client-supplied nonce (the round that just crashed on-screen) when
    // available; otherwise fall back to the most recently settled DB round.
    const previousRound = clientNonce
      ? await prisma.round.findFirst({
          where: { nonce: clientNonce, settledAt: { not: null } },
          select: { nonce: true, roundStartTime: true }
        }) ?? await prisma.round.findFirst({
          where: { settledAt: { not: null }, phase: 'CRASHED' },
          orderBy: { roundStartTime: 'desc' },
          select: { nonce: true, roundStartTime: true }
        })
      : await prisma.round.findFirst({
          where: { settledAt: { not: null }, phase: 'CRASHED' },
          orderBy: { roundStartTime: 'desc' },
          select: { nonce: true, roundStartTime: true }
        });

    const [previous, top] = await Promise.all([
      previousRound ? prisma.bet.findMany({
        // Fetch all bets for the round regardless of mode so the tab is never
        // empty just because bets of a different mode happened to dominate.
        where: { roundNonce: previousRound.nonce },
        orderBy: { createdAt: 'desc' },
        take: 100,
        select: { id: true, phone: true, terminalId: true, amount: true, multiplier: true, payout: true, status: true, createdAt: true, mode: true }
      }) : Promise.resolve([]),
      prisma.bet.findMany({
        where: { mode, status: 'WON', payout: { gt: 0 }, createdAt: { gte: BigInt(Date.now() - 30 * 86400000) } },
        // Sort by highest multiplier first so the leaderboard celebrates biggest cashout ratios.
        orderBy: { multiplier: 'desc' },
        take: 20,
        select: { id: true, phone: true, amount: true, multiplier: true, payout: true, createdAt: true, user: { select: { username: true } } }
      })
    ]);

    // Mask the phone into a 254••••11 label (used in the Previous tab rows).
    const maskPhone = (phone: string) => `${phone.slice(0, 3)}••••${phone.slice(-2)}`;

    // Build a username-style alias matching the simulated feed format (e.g. "o***2").
    // Uses the saved username when available; otherwise derives one from the phone digits.
    const alias = (phone: string, username: string | null | undefined): string => {
      if (username && username.length >= 2) {
        const first = username[0].toLowerCase();
        const last = username[username.length - 1].toLowerCase();
        return `${first}***${last}`;
      }
      // Fall back: map first digit of phone to a letter (a=0 … j=9) and use last digit.
      const digits = phone.replace(/\D/g, '');
      const letter = String.fromCharCode(97 + (Number(digits[0] ?? '0') % 10));
      const tail = digits[digits.length - 1] ?? '0';
      return `${letter}***${tail}`;
    };

    return NextResponse.json({
      success: true,
      mode,
      previousRound: previousRound ? { nonce: previousRound.nonce, timestamp: Number(previousRound.roundStartTime) } : null,
      previous: previous.map((bet) => ({ id: bet.id, player: maskPhone(bet.phone), terminalId: bet.terminalId, stake: Number(bet.amount), multiplier: Number(bet.multiplier), payout: Number(bet.payout), status: bet.status, mode: bet.mode, timestamp: Number(bet.createdAt) })),
      top: top.map((bet) => ({ id: bet.id, player: alias(bet.phone, bet.user?.username), stake: Number(bet.amount), multiplier: Number(bet.multiplier), payout: Number(bet.payout), timestamp: Number(bet.createdAt) }))
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Bet history is temporarily unavailable' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
