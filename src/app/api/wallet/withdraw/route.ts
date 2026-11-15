import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { getUser, getDailyWithdrawalCount, getTotalDeposits, getTotalTurnover } from '@/lib/db/operations';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    const session = verifyToken(token);
    if (!session) return NextResponse.json({ success: false, error: 'Sign in to withdraw funds' }, { status: 401 });

    const data = await req.json();
    const amount = Number(data.amount);
    if (!Number.isFinite(amount) || amount < 25 || amount > 1000000 || Math.round(amount * 100) !== amount * 100) {
      return NextResponse.json({ success: false, error: 'Withdrawal amount must be KES 25 or more, with up to two decimal places' }, { status: 400 });
    }

    const user = await getUser(session.phone);
    if (!user) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    const phone = user.phone;
    const suppliedTarget = typeof data.targetPhone === 'string' ? data.targetPhone.trim() : phone;
    const targetUser = await getUser(suppliedTarget);
    const targetPhone = targetUser?.phone || suppliedTarget;

    const totalDeposits = await getTotalDeposits(phone);
    const totalTurnover = await getTotalTurnover(phone);
    if (totalDeposits > 0 && totalTurnover < totalDeposits) {
      return NextResponse.json({
        success: false,
        code: 'REJECTED_INSUFFICIENT_TURNOVER',
        error: `AML Compliance: wagered turnover must reach KES ${totalDeposits.toFixed(2)} before withdrawal (current: KES ${totalTurnover.toFixed(2)})`
      }, { status: 400 });
    }

    const taxAmount = Math.round(amount * 0.05 * 100) / 100;
    const netAmount = Math.max(0, Math.round((amount - taxAmount) * 100) / 100);
    const dailyCount = await getDailyWithdrawalCount(phone);
    const status = targetPhone !== phone
      ? 'MANUAL_HOLD_PHONE_MISMATCH'
      : dailyCount >= 2
        ? 'MANUAL_HOLD_VELOCITY_EXCEEDED'
        : amount > 5000
          ? 'MANUAL_HOLD_HIGH_VALUE'
          : 'QUEUED_FOR_PAYOUT';
    const riskScore = status === 'MANUAL_HOLD_PHONE_MISMATCH' ? 80 : status === 'MANUAL_HOLD_VELOCITY_EXCEEDED' ? 60 : status === 'MANUAL_HOLD_HIGH_VALUE' ? 50 : 10;
    const riskReason = status === 'MANUAL_HOLD_PHONE_MISMATCH'
      ? 'Destination phone mismatch'
      : status === 'MANUAL_HOLD_VELOCITY_EXCEEDED'
        ? 'Velocity exceeded (>2 in 24h)'
        : status === 'MANUAL_HOLD_HIGH_VALUE'
          ? `Amount KES ${amount} exceeds automated ceiling of KES 5,000.00`
          : 'Queued for B2C payout';
    const reference = `WTH_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;

    const result = await prisma.$transaction(async (tx) => {
      const debit = await tx.user.updateMany({
        where: { phone, realBalance: { gte: amount } },
        data: { realBalance: { decrement: amount } }
      });
      if (!debit.count) throw new Error('INSUFFICIENT_FUNDS');
      const updated = await tx.user.findUniqueOrThrow({ where: { phone } });
      const balanceAfter = Number(updated.realBalance);
      const withdrawal = await tx.withdrawal.create({ data: {
        userId: user.id, phone, targetPhone, amount, taxAmount, netAmount, taxRate: 0.05,
        reference, status, riskScore, riskReason, createdAt: BigInt(Date.now())
      } });
      await tx.walletTransaction.create({ data: {
        phone, reference: `WITHDRAWAL_${reference}`, type: 'WITHDRAWAL_DEBIT', mode: 'REAL', amount,
        balanceBefore: balanceAfter + amount, balanceAfter, createdAt: BigInt(Date.now()),
        metadata: { withdrawalId: withdrawal.id, withdrawalReference: reference, targetPhone, taxAmount, netAmount, status }
      } });
      return updated;
    });

    return NextResponse.json({
      success: true,
      status,
      reference,
      grossAmount: amount,
      taxRate: '5%',
      taxAmount,
      netDisbursement: netAmount,
      message: `Withdrawal of KES ${amount.toFixed(2)} submitted. 5% gaming tax (KES ${taxAmount.toFixed(2)}) reserved.`,
      realBalance: Number(result.realBalance),
      demoBalance: Number(result.demoBalance)
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json({ success: false, code: 'INSUFFICIENT_FUNDS', error: 'Insufficient real money balance' }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}
