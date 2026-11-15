import { NextRequest, NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getLiveRoundState } from '@/app/api/round-state/route';

function sessionFor(request: NextRequest) {
  return verifyToken(request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '');
}
const modeValue = (value: unknown) => value === 'REAL' ? 'REAL' : 'DEMO';
function serializeChallenge(challenge: any) {
  return {
    id: challenge.id.toString(), reference: challenge.reference, mode: challenge.mode, baseStake: Number(challenge.baseStake), targetMultiplier: Number(challenge.targetMultiplier),
    totalStages: challenge.totalStages, currentStage: challenge.currentStage, currentStake: Number(challenge.currentStake), accumulatedProfit: Number(challenge.accumulatedProfit),
    status: challenge.status, createdAt: Number(challenge.createdAt), stages: (challenge.stages || []).map((stage: any) => ({
      stageNumber: stage.stageNumber, roundNonce: stage.roundNonce, stake: Number(stage.stake), targetMultiplier: Number(stage.targetMultiplier),
      resultMultiplier: stage.resultMultiplier === null ? null : Number(stage.resultMultiplier), payout: Number(stage.payout), status: stage.status
    }))
  };
}

export async function GET(request: NextRequest) {
  const session = sessionFor(request);
  if (!session) return NextResponse.json({ success: false, error: 'Sign in to view rollover strategies' }, { status: 401 });
  try {
    const [active, history] = await Promise.all([
      prisma.rolloverChallenge.findFirst({ where: { userId: session.userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, include: { stages: { orderBy: { stageNumber: 'asc' } } } }),
      prisma.rolloverChallenge.findMany({ where: { userId: session.userId, status: { not: 'ACTIVE' } }, orderBy: { createdAt: 'desc' }, take: 10, include: { stages: { orderBy: { stageNumber: 'asc' } } } })
    ]);
    return NextResponse.json({ success: true, active: active ? serializeChallenge(active) : null, history: history.map(serializeChallenge) }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to load rollover data' }, { status: 503 });
  }
}

export async function POST(request: NextRequest) {
  const session = sessionFor(request);
  if (!session) return NextResponse.json({ success: false, error: 'Sign in to manage rollover strategies' }, { status: 401 });
  try {
    const data = await request.json();
    const action = String(data.action || '');
    if (action === 'start') {
      const mode = modeValue(data.mode);
      const baseStake = Number(data.baseStake);
      const targetMultiplier = Number(data.targetMultiplier);
      const totalStages = Number(data.totalStages);
      if (!Number.isFinite(baseStake) || baseStake < 100 || baseStake > 25000 || !Number.isFinite(targetMultiplier) || targetMultiplier < 1.1 || targetMultiplier > 5 || !Number.isInteger(totalStages) || totalStages < 2 || totalStages > 10) {
        return NextResponse.json({ success: false, error: 'Use a stake of KES 100–25,000, a target of 1.10x–5.00x, and 2–10 stages' }, { status: 400 });
      }
      const round = await getLiveRoundState();
      const reference = `RR-${randomBytes(7).toString('hex').toUpperCase()}`;
      const challenge = await prisma.$transaction(async (tx) => {
        const active = await tx.rolloverChallenge.findFirst({ where: { userId: session.userId, status: 'ACTIVE' }, select: { id: true } });
        if (active) throw new Error('ACTIVE_CHALLENGE');
        const user = await tx.user.findUniqueOrThrow({ where: { id: session.userId } });
        const balanceField = mode === 'REAL' ? 'realBalance' : 'demoBalance';
        const debit = await tx.user.updateMany({ where: { id: session.userId, [balanceField]: { gte: baseStake } }, data: { [balanceField]: { decrement: baseStake } } });
        if (!debit.count) throw new Error('INSUFFICIENT_FUNDS');
        const now = BigInt(Date.now());
        const created = await tx.rolloverChallenge.create({ data: {
          reference, userId: session.userId, mode, baseStake, targetMultiplier, totalStages, currentStage: 1, currentStake: baseStake,
          accumulatedProfit: 0, status: 'ACTIVE', createdAt: now, startedAt: now, updatedAt: now,
          stages: { create: { stageNumber: 1, roundNonce: round.phase === 'WAITING' ? round.nonce : round.nonce + 1, stake: baseStake, targetMultiplier, status: round.phase === 'WAITING' ? 'ACTIVE' : 'PENDING', createdAt: now } }
        }, include: { stages: true } });
        const updated = await tx.user.findUniqueOrThrow({ where: { id: session.userId } });
        await tx.walletTransaction.create({ data: { phone: user.phone, reference, type: 'ROLLOVER_LOCK', mode, amount: baseStake, balanceBefore: Number(user[balanceField]), balanceAfter: Number(updated[balanceField]), createdAt: now, metadata: { challengeId: created.id.toString() } } });
        return created;
      });
      return NextResponse.json({ success: true, active: serializeChallenge(challenge), message: 'Strategy launched' });
    }

    if (action === 'stop') {
      const result = await prisma.$transaction(async (tx) => {
        const challenge = await tx.rolloverChallenge.findFirst({ where: { id: BigInt(String(data.challengeId)), userId: session.userId, status: 'ACTIVE' }, include: { stages: true } });
        if (!challenge) throw new Error('ACTIVE_CHALLENGE_NOT_FOUND');
        const refund = Number(challenge.currentStake);
        const now = BigInt(Date.now());
        const balanceField = challenge.mode === 'REAL' ? 'realBalance' : 'demoBalance';
        const user = await tx.user.findUniqueOrThrow({ where: { id: session.userId } });
        const updated = await tx.user.update({ where: { id: session.userId }, data: { [balanceField]: { increment: refund } } });
        await tx.rolloverChallenge.update({ where: { id: challenge.id }, data: { status: 'STOPPED', currentStake: 0, completedAt: now, updatedAt: now } });
        await tx.rolloverStage.updateMany({ where: { challengeId: challenge.id, status: { in: ['ACTIVE', 'PENDING'] } }, data: { status: 'STOPPED', completedAt: now } });
        const reference = `RR-${randomBytes(7).toString('hex').toUpperCase()}`;
        await tx.walletTransaction.create({ data: { phone: user.phone, reference, type: 'ROLLOVER_REFUND', mode: challenge.mode, amount: refund, balanceBefore: Number(user[balanceField]), balanceAfter: Number(updated[balanceField]), createdAt: now, metadata: { challengeId: challenge.id.toString() } } });
        return { realBalance: Number(updated.realBalance), demoBalance: Number(updated.demoBalance) };
      });
      return NextResponse.json({ success: true, ...result, message: 'Open capital returned to your wallet' });
    }

    if (action === 'sync') {
      const round = await getLiveRoundState();
      const settled = await prisma.$transaction(async (tx) => {
        const challenge = await tx.rolloverChallenge.findFirst({ where: { userId: session.userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } });
        if (!challenge) return null;
        const now = BigInt(Date.now());
        let stage = await tx.rolloverStage.findUnique({ where: { challengeId_stageNumber: { challengeId: challenge.id, stageNumber: challenge.currentStage } } });
        if (!stage) throw new Error('ROLLOVER_STAGE_MISSING');
        if (stage.status === 'PENDING') {
          const targetRound = round.phase === 'WAITING' ? round.nonce : round.nonce + 1;
          const activated = await tx.rolloverStage.updateMany({ where: { id: stage.id, status: 'PENDING' }, data: { roundNonce: targetRound, status: 'ACTIVE' } });
          if (!activated.count) return challenge;
          stage = await tx.rolloverStage.findUniqueOrThrow({ where: { id: stage.id } });
        }
        if (stage.status !== 'ACTIVE' || stage.roundNonce === null) return challenge;

        let resultMultiplier: number | null = null;
        if (round.nonce === stage.roundNonce && round.phase === 'FLYING' && round.currentMultiplier >= Number(stage.targetMultiplier)) resultMultiplier = Number(stage.targetMultiplier);
        else if (round.nonce === stage.roundNonce && round.phase === 'CRASHED') resultMultiplier = round.crashMultiplier >= Number(stage.targetMultiplier) ? Number(stage.targetMultiplier) : round.crashMultiplier;
        else if (round.nonce > stage.roundNonce) {
          const completedRound = await tx.round.findUnique({ where: { nonce: stage.roundNonce } });
          if (completedRound?.settledAt && completedRound.crashMultiplier !== null) resultMultiplier = Number(completedRound.crashMultiplier) >= Number(stage.targetMultiplier) ? Number(stage.targetMultiplier) : Number(completedRound.crashMultiplier);
        }
        if (resultMultiplier === null) return challenge;

        const won = resultMultiplier >= Number(stage.targetMultiplier);
        const changed = await tx.rolloverStage.updateMany({ where: { id: stage.id, status: 'ACTIVE' }, data: { status: won ? 'WON' : 'BUSTED', resultMultiplier, payout: won ? Math.floor(Number(stage.stake) * Number(stage.targetMultiplier) * 100) / 100 : 0, completedAt: now } });
        if (!changed.count) return challenge;
        if (!won) {
          await tx.rolloverChallenge.update({ where: { id: challenge.id }, data: { status: 'BUSTED', currentStake: 0, completedAt: now, updatedAt: now } });
          return { ...challenge, status: 'BUSTED', currentStake: 0 };
        }
        const payout = Math.floor(Number(stage.stake) * Number(stage.targetMultiplier) * 100) / 100;
        const profit = payout - Number(stage.stake);
        const accumulatedProfit = Number(challenge.accumulatedProfit) + profit;
        if (challenge.currentStage >= challenge.totalStages) {
          const user = await tx.user.findUniqueOrThrow({ where: { id: session.userId } });
          const balanceField = challenge.mode === 'REAL' ? 'realBalance' : 'demoBalance';
          const updated = await tx.user.update({ where: { id: session.userId }, data: { [balanceField]: { increment: payout } } });
          await tx.rolloverChallenge.update({ where: { id: challenge.id }, data: { status: 'COMPLETED', accumulatedProfit, currentStake: 0, completedAt: now, updatedAt: now } });
          await tx.walletTransaction.create({ data: { phone: user.phone, reference: `RR-${randomBytes(7).toString('hex').toUpperCase()}`, type: 'ROLLOVER_PAYOUT', mode: challenge.mode, amount: payout, balanceBefore: Number(user[balanceField]), balanceAfter: Number(updated[balanceField]), createdAt: now, metadata: { challengeId: challenge.id.toString(), stage: challenge.currentStage } } });
          return { ...challenge, status: 'COMPLETED', accumulatedProfit, currentStake: 0 };
        }
        const nextStage = challenge.currentStage + 1;
        await tx.rolloverChallenge.update({ where: { id: challenge.id }, data: { currentStage: nextStage, currentStake: payout, accumulatedProfit, updatedAt: now } });
        await tx.rolloverStage.create({ data: { challengeId: challenge.id, stageNumber: nextStage, stake: payout, targetMultiplier: challenge.targetMultiplier, status: 'PENDING', createdAt: now } });
        return { ...challenge, currentStage: nextStage, currentStake: payout, accumulatedProfit };
      });
      const [active, history] = await Promise.all([
        prisma.rolloverChallenge.findFirst({ where: { userId: session.userId, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' }, include: { stages: { orderBy: { stageNumber: 'asc' } } } }),
        prisma.rolloverChallenge.findMany({ where: { userId: session.userId, status: { not: 'ACTIVE' } }, orderBy: { createdAt: 'desc' }, take: 10, include: { stages: { orderBy: { stageNumber: 'asc' } } } })
      ]);
      return NextResponse.json({ success: true, active: active ? serializeChallenge(active) : null, history: history.map(serializeChallenge), roundPhase: round.phase, roundNonce: round.nonce, changed: Boolean(settled) });
    }

    return NextResponse.json({ success: false, error: 'Choose a valid rollover action' }, { status: 400 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'INSUFFICIENT_FUNDS') return NextResponse.json({ success: false, error: 'The selected wallet does not have enough funds' }, { status: 400 });
    if (message === 'ACTIVE_CHALLENGE') return NextResponse.json({ success: false, error: 'Stop your active strategy before starting another one' }, { status: 409 });
    if (message === 'ACTIVE_CHALLENGE_NOT_FOUND') return NextResponse.json({ success: false, error: 'There is no active strategy to stop' }, { status: 409 });
    return NextResponse.json({ success: false, error: 'Unable to process this rollover action' }, { status: 500 });
  }
}
