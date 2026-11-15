import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getAdminSession } from '@/lib/admin-auth';

const HOLD_STATUSES = ['MANUAL_HOLD_PHONE_MISMATCH', 'MANUAL_HOLD_VELOCITY_EXCEEDED', 'MANUAL_HOLD_HIGH_VALUE'];

export async function POST(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin || !['SUPER_ADMIN', 'ADMIN'].includes(admin.role)) {
    return NextResponse.json({ success: false, error: 'Administrator permission required' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const id = Number(body.id);
    const decision = body.decision;
    if (!Number.isInteger(id) || !['approve', 'reject'].includes(decision)) {
      return NextResponse.json({ success: false, error: 'A valid withdrawal and decision are required' }, { status: 400 });
    }

    const outcome = await prisma.$transaction(async (tx) => {
      const withdrawal = await tx.withdrawal.findUnique({ where: { id } });
      if (!withdrawal || !HOLD_STATUSES.includes(withdrawal.status)) throw new Error('WITHDRAWAL_NOT_REVIEWABLE');
      const status = decision === 'approve' ? 'QUEUED_FOR_PAYOUT' : 'PAYOUT_FAILED';
      const now = BigInt(Date.now());
      const changed = await tx.withdrawal.updateMany({
        where: { id, status: { in: HOLD_STATUSES } },
        data: { status, ...(decision === 'reject' ? { completedAt: now, failureReason: 'Rejected by administrator' } : { riskReason: `${withdrawal.riskReason || ''} · Approved by administrator`.trim() }) }
      });
      if (!changed.count) throw new Error('WITHDRAWAL_NOT_REVIEWABLE');

      if (decision === 'reject') {
        const user = await tx.user.update({ where: { phone: withdrawal.phone }, data: { realBalance: { increment: withdrawal.amount } } });
        const balanceAfter = Number(user.realBalance);
        await tx.walletTransaction.create({ data: {
          phone: withdrawal.phone, reference: `WITHDRAWAL_REFUND_${withdrawal.reference}`, type: 'WITHDRAWAL_REFUND', mode: 'REAL', amount: withdrawal.amount,
          balanceBefore: balanceAfter - Number(withdrawal.amount), balanceAfter, createdAt: now,
          metadata: { withdrawalReference: withdrawal.reference, reason: 'Rejected by administrator' }
        } });
      }

      await tx.adminAuditLog.create({ data: {
        adminId: admin.id, action: `WITHDRAWAL_${String(decision).toUpperCase()}`, entityType: 'Withdrawal', entityId: String(id),
        details: { reference: withdrawal.reference, previousStatus: withdrawal.status, status }, createdAt: now
      } });
      return { reference: withdrawal.reference, status };
    });

    return NextResponse.json({ success: true, ...outcome });
  } catch (error) {
    if (error instanceof Error && error.message === 'WITHDRAWAL_NOT_REVIEWABLE') {
      return NextResponse.json({ success: false, error: 'Withdrawal is no longer awaiting administrator review' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Withdrawal decision failed' }, { status: 500 });
  }
}
