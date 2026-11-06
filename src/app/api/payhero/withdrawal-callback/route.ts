import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

function validCallbackKey(expected: string | undefined, supplied: string | null) {
  if (!expected || !supplied) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(request: NextRequest) {
  if (!validCallbackKey(process.env.PAYHERO_CALLBACK_SECRET, request.nextUrl.searchParams.get('key'))) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const reference = String(payload.external_reference || payload.response?.ExternalReference || '');
    const status = String(payload.status || payload.response?.Status || '').toLowerCase();
    if (!reference || !['success', 'failed'].includes(status) || payload.transaction_type === 'inbound_payment') {
      return NextResponse.json({ success: false, error: 'Invalid payout callback' }, { status: 400 });
    }

    const withdrawal = await prisma.withdrawal.findUnique({ where: { reference } });
    if (!withdrawal) return NextResponse.json({ success: false, error: 'Withdrawal not found' }, { status: 404 });

    const eventId = String(payload.transaction_id || payload.reference || `${reference}:${status}:${payload.provider_reference || ''}`);
    const now = BigInt(Date.now());
    const update = await prisma.$transaction(async (tx) => {
      const created = await tx.paymentEvent.createMany({
        data: [{
          provider: 'PAYHERO', providerEventId: `withdrawal:${eventId}`, reference,
          status: status.toUpperCase(), payload, receivedAt: now, processedAt: now
        }],
        skipDuplicates: true
      });
      if (!created.count) return { duplicate: true, status: withdrawal.status };

      const current = await tx.withdrawal.findUniqueOrThrow({ where: { reference } });
      if (['SETTLED', 'PAYOUT_FAILED'].includes(current.status)) return { duplicate: true, status: current.status };

      if (status === 'success') {
        const changed = await tx.withdrawal.updateMany({
          where: { id: current.id, status: { in: ['DISPATCHING', 'PROCESSING', 'PAYOUT_RECONCILIATION'] } },
          data: {
            status: 'SETTLED',
            providerReference: String(payload.provider_reference || payload.reference || current.providerReference || '') || null,
            completedAt: now,
            failureReason: null
          }
        });
        return { duplicate: !changed.count, status: changed.count ? 'SETTLED' : current.status };
      }

      const changed = await tx.withdrawal.updateMany({
        where: { id: current.id, status: { in: ['DISPATCHING', 'PROCESSING', 'PAYOUT_RECONCILIATION'] } },
        data: { status: 'PAYOUT_FAILED', failureReason: String(payload.message || payload.response?.ResultDesc || 'PayHero payout failed').slice(0, 500), completedAt: now }
      });
      if (!changed.count) return { duplicate: true, status: current.status };

      const user = await tx.user.update({ where: { phone: current.phone }, data: { realBalance: { increment: current.amount } } });
      const balanceAfter = Number(user.realBalance);
      await tx.walletTransaction.create({ data: {
        phone: current.phone, reference: `WITHDRAWAL_REFUND_${reference}`, type: 'WITHDRAWAL_REFUND', mode: 'REAL', amount: current.amount,
        balanceBefore: balanceAfter - Number(current.amount), balanceAfter, createdAt: now,
        metadata: { withdrawalReference: reference, failureReason: String(payload.message || 'PayHero payout failed').slice(0, 500) }
      } });
      return { duplicate: false, status: 'PAYOUT_FAILED' };
    });

    return NextResponse.json({ success: true, duplicate: update.duplicate, status: update.status });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Withdrawal callback failed' }, { status: 500 });
  }
}
