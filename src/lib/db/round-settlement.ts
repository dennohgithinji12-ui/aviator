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
      }
    });

    recentlyPersisted.add(key);
    if (recentlyPersisted.size > 150) recentlyPersisted.delete(recentlyPersisted.values().next().value as string);
  });
  persistQueue = operation;
  return operation;
}
