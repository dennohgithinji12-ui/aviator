import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getLiveRoundState } from '@/app/api/round-state/route';
import { getOddsPolicyChanges, isFavorableOddsEnabled, getCrashMultiplierForPolicy } from '@/lib/engine/odds-policy';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

const MASTER_SECRET = 'shiftstack_aviator_provably_fair_master_chain_2026';
const PUBLIC_CLIENT_SEED = 'global_aviator_network_shared_seed_100x';

let cachedHistory: { data: unknown; expiresAt: number } | null = null;

export async function GET() {
  const now = Date.now();
  if (cachedHistory && now < cachedHistory.expiresAt) {
    return NextResponse.json(cachedHistory.data, {
      headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' }
    });
  }

  try {
    const dbRounds = await prisma.round.findMany({
      where: { phase: 'CRASHED', settledAt: { not: null }, crashMultiplier: { not: null } },
      orderBy: { roundStartTime: 'desc' },
      take: 40,
      select: { nonce: true, crashMultiplier: true, commitment: true, serverSeed: true, clientSeed: true, roundStartTime: true }
    });

    const mapped = dbRounds.map((round) => ({
      nonce: round.nonce,
      multiplier: Number(round.crashMultiplier),
      commitment: round.commitment,
      serverSeed: round.serverSeed,
      clientSeed: round.clientSeed,
      timestamp: Number(round.roundStartTime)
    }));

    // If the database has fewer than 25 records (e.g. fresh DB or empty rounds skipped),
    // deterministically generate the history ribbon backwards from the live round
    let finalRounds = mapped;
    if (finalRounds.length < 25) {
      try {
        const live = await getLiveRoundState();
        const policyChanges = await getOddsPolicyChanges();
        const existingNonces = new Set(finalRounds.map((r) => r.nonce));
        const synthetic = [];
        let currNonce = live.nonce - 1;
        let currTime = live.roundStartTime - 10000;

        while (currNonce > 0 && synthetic.length + finalRounds.length < 40) {
          if (!existingNonces.has(currNonce)) {
            const hmac = crypto.createHmac('sha256', MASTER_SECRET);
            hmac.update(`${PUBLIC_CLIENT_SEED}:${currNonce}`);
            const hex = hmac.digest('hex');
            const favorable = isFavorableOddsEnabled(policyChanges, currNonce);
            const multiplier = getCrashMultiplierForPolicy(hex, favorable);
            synthetic.push({
              nonce: currNonce,
              multiplier,
              commitment: crypto.createHash('sha256').update(`${MASTER_SECRET}:${currNonce}`).digest('hex'),
              serverSeed: '',
              clientSeed: PUBLIC_CLIENT_SEED,
              timestamp: currTime
            });
          }
          currNonce -= 1;
          currTime -= 14000;
        }
        finalRounds = [...finalRounds, ...synthetic].sort((a, b) => b.timestamp - a.timestamp);
      } catch {
        // Fallback to mapped
      }
    }

    const payload = { success: true, rounds: finalRounds };
    cachedHistory = { data: payload, expiresAt: now + 5000 };

    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=15' }
    });
  } catch {
    return NextResponse.json({ success: false, rounds: [] }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
