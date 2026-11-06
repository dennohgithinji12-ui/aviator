import { prisma } from '@/lib/db';

export interface RoundSnapshot {
  nonce: number;
  phase: 'WAITING' | 'FLYING' | 'CRASHED';
  commitment: string;
  serverSeed: string;
  clientSeed: string;
  crashMultiplier: number;
  roundStartTime: number;
  roundEndTime: number;
}

const recentlyPersisted = new Set<string>();
let persistQueue: Promise<void> = Promise.resolve();

export function persistRoundSnapshot(snapshot: RoundSnapshot): Promise<void> {
  const key = `${snapshot.nonce}:${snapshot.phase}`;
  const operation = persistQueue.catch(() => undefined).then(async () => {
    if (recentlyPersisted.has(key)) return;
    await prisma.$transaction(async (tx) => {
      const now = BigInt(Date.now());
      await tx.round.createMany({
        data: [{
          nonce: snapshot.nonce,
          phase: snapshot.phase,
          commitment: snapshot.commitment,
          serverSeed: snapshot.phase === 'CRASHED' ? snapshot.serverSeed : null,
          clientSeed: snapshot.clientSeed,
          crashMultiplier: snapshot.phase === 'CRASHED' ? snapshot.crashMultiplier : null,
          roundStartTime: BigInt(Math.floor(snapshot.roundStartTime)),
          roundEndTime: BigInt(Math.floor(snapshot.roundEndTime)),
          createdAt: now,
          updatedAt: now
        }],
        skipDuplicates: true
      });
      const existing = await tx.round.findUniqueOrThrow({ where: { nonce: snapshot.nonce } });
      const writablePhases = snapshot.phase === 'WAITING'
        ? ['WAITING']
        : snapshot.phase === 'FLYING'
          ? ['WAITING', 'FLYING']
          : ['WAITING', 'FLYING', 'CRASHED'];
      await tx.round.updateMany({ where: { nonce: snapshot.nonce, phase: { in: writablePhases } }, data: {
          phase: snapshot.phase,
          commitment: snapshot.commitment,
          serverSeed: snapshot.phase === 'CRASHED' ? snapshot.serverSeed : existing.serverSeed,
          clientSeed: snapshot.clientSeed,
          crashMultiplier: snapshot.phase === 'CRASHED' ? snapshot.crashMultiplier : existing.crashMultiplier,
          roundStartTime: BigInt(Math.floor(snapshot.roundStartTime)),
          roundEndTime: BigInt(Math.floor(snapshot.roundEndTime)),
          updatedAt: now
      } });

      if (snapshot.phase === 'CRASHED' && !existing?.settledAt) {
        const lost = await tx.bet.updateMany({
          where: { roundNonce: snapshot.nonce, status: 'ACTIVE' },
          data: { status: 'LOST', cashedOut: 0 }
        });
        await tx.round.updateMany({ where: { nonce: snapshot.nonce, settledAt: null }, data: { phase: 'CRASHED', settledAt: now, lostBetCount: lost.count, updatedAt: now } });

        // Match the legacy pool distribution for the simulated wallet only.
        // Live-money positions accrue nothing until a funded revenue policy is
        // configured; no balances are invented for the live wallet.
        const [volume, positionsTotal] = await Promise.all([
          tx.bet.aggregate({ where: { roundNonce: snapshot.nonce, mode: 'DEMO' }, _sum: { amount: true } }),
          tx.liquidityPosition.aggregate({ where: { mode: 'DEMO', status: 'ACTIVE', principal: { gt: 0 } }, _sum: { principal: true } })
        ]);
        const demoVolume = Number(volume._sum.amount || 0);
        const demoTvl = Number(positionsTotal._sum.principal || 0);
        if (demoVolume > 0 && demoTvl > 0) {
          const activePositions = await tx.liquidityPosition.findMany({ where: { mode: 'DEMO', status: 'ACTIVE', principal: { gt: 0 } }, select: { id: true, principal: true } });
          const protocolFee = demoVolume * 0.015;
          for (const position of activePositions) {
            const share = Number(position.principal) / demoTvl;
            const yieldAmount = Math.max(0.01, protocolFee * share * 8.5);
            await tx.liquidityPosition.update({ where: { id: position.id }, data: { accruedYield: { increment: yieldAmount }, updatedAt: now } });
          }
        }
      }
    });

    recentlyPersisted.add(key);
    if (recentlyPersisted.size > 150) recentlyPersisted.delete(recentlyPersisted.values().next().value as string);
  });
  persistQueue = operation;
  return operation;
}
