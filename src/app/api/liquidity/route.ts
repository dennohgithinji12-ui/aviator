import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';

function getSession(request: NextRequest) {
  return verifyToken(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '');
}

function normalizedMode(value: unknown): 'REAL' | 'DEMO' {
  return value === 'REAL' ? 'REAL' : 'DEMO';
}

export async function GET(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ success: false, error: 'Sign in to view your liquidity account' }, { status: 401 });
  const mode = normalizedMode(request.nextUrl.searchParams.get('mode'));
  try {
    const [pool, position, poolTotals, activeStakers, volume, transactions] = await Promise.all([
      prisma.liquidityPool.findUnique({ where: { id: 'primary' } }),
      prisma.liquidityPosition.findUnique({ where: { userId_poolId_mode: { userId: session.userId, poolId: 'primary', mode } } }),
      prisma.liquidityPosition.aggregate({ where: { mode, status: 'ACTIVE', principal: { gt: 0 } }, _sum: { principal: true } }),
      prisma.liquidityPosition.count({ where: { mode, status: 'ACTIVE', principal: { gt: 0 } } }),
      prisma.bet.aggregate({ where: { mode, createdAt: { gte: BigInt(Date.now() - 24 * 60 * 60 * 1000) } }, _sum: { amount: true } }),
      prisma.liquidityTransaction.findMany({ where: { userId: session.userId, mode }, orderBy: { createdAt: 'desc' }, take: 12, select: { reference: true, type: true, amount: true, createdAt: true } })
    ]);
    if (!pool) return NextResponse.json({ success: false, error: 'Liquidity pool is not initialized' }, { status: 503 });
    return NextResponse.json({
      success: true,
      mode,
      pool: { name: pool.name, enabled: pool.enabled || mode === 'DEMO', totalValueLocked: Number(poolTotals._sum.principal || 0), apyPercent: mode === 'DEMO' ? 28.4 : Number(pool.apyPercent), totalStakers: activeStakers, volume24h: Number(volume._sum.amount || 0) },
      position: { principal: Number(position?.principal || 0), accruedYield: Number(position?.accruedYield || 0) },
      transactions: transactions.map((item) => ({ ...item, amount: Number(item.amount), createdAt: Number(item.createdAt) }))
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to load liquidity data right now' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = getSession(request);
  if (!session) return NextResponse.json({ success: false, error: 'Sign in to manage your liquidity position' }, { status: 401 });
  try {
    const data = await request.json();
    const action = String(data.action || '');
    const mode = normalizedMode(data.mode);
    const amount = Number(data.amount);
    if (!['stake', 'unstake', 'claim'].includes(action)) return NextResponse.json({ success: false, error: 'Choose a valid liquidity action' }, { status: 400 });
    if (action !== 'claim' && (!Number.isFinite(amount) || amount < 100 || amount > 100000)) return NextResponse.json({ success: false, error: 'Enter an amount between KES 100 and KES 100,000' }, { status: 400 });

    const result = await prisma.$transaction(async (tx) => {
      const now = BigInt(Date.now());
      const pool = await tx.liquidityPool.findUniqueOrThrow({ where: { id: 'primary' } });
      const user = await tx.user.findUniqueOrThrow({ where: { id: session.userId } });
      if (mode === 'REAL' && !pool.enabled) throw new Error('VAULT_PAUSED');
      const balanceField = mode === 'REAL' ? 'realBalance' : 'demoBalance';
      let positionId: bigint | null = null;
      let transactionAmount = amount;
      let walletBefore = Number(user[balanceField]);
      let walletAfter = walletBefore;
      const reference = `LQ-${randomBytes(8).toString('hex').toUpperCase()}`;

      if (action === 'stake') {
        const debited = await tx.user.updateMany({ where: { id: session.userId, [balanceField]: { gte: amount } }, data: { [balanceField]: { decrement: amount } } });
        if (!debited.count) throw new Error('INSUFFICIENT_FUNDS');
        const position = await tx.liquidityPosition.upsert({
          where: { userId_poolId_mode: { userId: session.userId, poolId: pool.id, mode } },
          create: { userId: session.userId, poolId: pool.id, mode, principal: amount, accruedYield: 0, status: 'ACTIVE', createdAt: now, updatedAt: now },
          update: { principal: { increment: amount }, status: 'ACTIVE', updatedAt: now }
        });
        positionId = position.id;
        await tx.liquidityPool.update({ where: { id: pool.id }, data: { totalValueLocked: { increment: amount }, updatedAt: now } });
        const updated = await tx.user.findUniqueOrThrow({ where: { id: session.userId } });
        walletAfter = Number(updated[balanceField]);
      } else {
        const position = await tx.liquidityPosition.findUnique({ where: { userId_poolId_mode: { userId: session.userId, poolId: pool.id, mode } } });
        if (!position) throw new Error(action === 'claim' ? 'NO_YIELD' : 'INSUFFICIENT_POSITION');
        positionId = position.id;
        transactionAmount = action === 'claim' ? Number(position.accruedYield) : amount;
        if (transactionAmount <= 0.01) throw new Error('NO_YIELD');
        if (action === 'unstake') {
          const changed = await tx.liquidityPosition.updateMany({ where: { id: position.id, status: 'ACTIVE', principal: { gte: amount } }, data: { principal: { decrement: amount }, updatedAt: now } });
          if (!changed.count) throw new Error('INSUFFICIENT_POSITION');
          await tx.user.update({ where: { id: session.userId }, data: { [balanceField]: { increment: amount } } });
          await tx.liquidityPool.update({ where: { id: pool.id }, data: { totalValueLocked: { decrement: amount }, updatedAt: now } });
          await tx.liquidityPosition.updateMany({ where: { id: position.id, principal: 0 }, data: { status: 'CLOSED', updatedAt: now } });
        } else {
          const claimed = await tx.liquidityPosition.updateMany({ where: { id: position.id, accruedYield: { gte: transactionAmount } }, data: { accruedYield: 0, updatedAt: now } });
          if (!claimed.count) throw new Error('NO_YIELD');
          await tx.user.update({ where: { id: session.userId }, data: { [balanceField]: { increment: transactionAmount } } });
        }
        const updated = await tx.user.findUniqueOrThrow({ where: { id: session.userId } });
        walletAfter = Number(updated[balanceField]);
      }

      const type = action === 'stake' ? 'STAKE' : action === 'unstake' ? 'UNSTAKE' : 'YIELD_CLAIM';
      await tx.liquidityTransaction.create({ data: { userId: session.userId, poolId: pool.id, positionId, reference, type, mode, amount: transactionAmount, createdAt: now } });
      await tx.walletTransaction.create({ data: { phone: user.phone, reference, type: `LIQUIDITY_${type}`, mode, amount: transactionAmount, balanceBefore: walletBefore, balanceAfter: walletAfter, createdAt: now, metadata: { poolId: pool.id, positionId: positionId?.toString() || null } } });
      const [refreshedPosition, finalUser] = await Promise.all([
        tx.liquidityPosition.findUnique({ where: { userId_poolId_mode: { userId: session.userId, poolId: pool.id, mode } } }),
        tx.user.findUniqueOrThrow({ where: { id: session.userId } })
      ]);
      return { reference, wallet: { realBalance: Number(finalUser.realBalance), demoBalance: Number(finalUser.demoBalance) }, position: { principal: Number(refreshedPosition?.principal || 0), accruedYield: Number(refreshedPosition?.accruedYield || 0) } };
    });
    return NextResponse.json({ success: true, action, ...result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'INSUFFICIENT_FUNDS') return NextResponse.json({ success: false, error: 'The selected wallet does not have enough funds' }, { status: 400 });
    if (message === 'INSUFFICIENT_POSITION') return NextResponse.json({ success: false, error: 'That amount exceeds your active position' }, { status: 400 });
    if (message === 'NO_YIELD') return NextResponse.json({ success: false, error: 'There is no yield available to claim yet' }, { status: 409 });
    if (message === 'VAULT_PAUSED') return NextResponse.json({ success: false, error: 'Real-money liquidity actions are currently paused' }, { status: 409 });
    return NextResponse.json({ success: false, error: 'Unable to process this liquidity action' }, { status: 500 });
  }
}
