import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { callPayHeroApi } from '@/lib/payhero';
import { getPayHeroConfig } from '@/lib/payhero-config';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');
  if (!secret) return NextResponse.json({ success: false, error: 'Withdrawal scheduler is not configured' }, { status: 503 });
  if (!supplied || supplied !== secret) return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  const config = await getPayHeroConfig();
  if (!config.payoutsEnabled) {
    return NextResponse.json({ success: false, error: 'PayHero payouts are disabled' }, { status: 503 });
  }

  const accountId = Number(config.payoutAccountId);
  const networkCode = config.networkCode;
  const callbackSecret = config.callbackSecret;
  const appUrl = process.env.APP_BASE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  const payHeroUsername = config.username;
  const payHeroPassword = config.password;
  if (!Number.isInteger(accountId) || accountId < 1 || !networkCode || !callbackSecret || !appUrl || !payHeroUsername || !payHeroPassword) {
    return NextResponse.json({ success: false, error: 'PayHero payout account, callback, app URL, and API credentials must be configured' }, { status: 503 });
  }

  try {
    const queued = await prisma.withdrawal.findMany({
      where: { status: 'QUEUED_FOR_PAYOUT' },
      orderBy: { createdAt: 'asc' },
      take: 25
    });
    const results: Array<{ reference: string; status: string }> = [];

    for (const withdrawal of queued) {
      const claimed = await prisma.withdrawal.updateMany({
        where: { id: withdrawal.id, status: 'QUEUED_FOR_PAYOUT' },
        data: { status: 'DISPATCHING', failureReason: null }
      });
      if (!claimed.count) continue;

      const callbackUrl = new URL('/api/payhero/withdrawal-callback', appUrl);
      callbackUrl.searchParams.set('key', callbackSecret);
      try {
        const response = await callPayHeroApi('withdraw', 'POST', {
          external_reference: withdrawal.reference,
          account_id: accountId,
          amount: Number(withdrawal.netAmount),
          phone_number: withdrawal.targetPhone || withdrawal.phone,
          account_number: withdrawal.targetPhone || withdrawal.phone,
          network_code: networkCode,
          channel: 'phone',
          recipient_type: 'MSISDN',
          callback_url: callbackUrl.toString()
        });
        const body = response.body || {};
        const accepted = response.statusCode >= 200 && response.statusCode < 300 && ['QUEUED', 'PROCESSING', 'SUCCESS'].includes(String(body.status || '').toUpperCase());
        if (!accepted) {
          const reason = String(body.error_message || body.message || `PayHero returned HTTP ${response.statusCode}`).slice(0, 500);
          await prisma.withdrawal.updateMany({ where: { id: withdrawal.id, status: 'DISPATCHING' }, data: { status: 'PAYOUT_RECONCILIATION', failureReason: reason } });
          results.push({ reference: withdrawal.reference, status: 'PAYOUT_RECONCILIATION' });
          continue;
        }

        const finalAccepted = String(body.status).toUpperCase() === 'SUCCESS';
        await prisma.withdrawal.updateMany({
          where: { id: withdrawal.id, status: 'DISPATCHING' },
          data: {
            status: finalAccepted ? 'SETTLED' : 'PROCESSING',
            providerReference: body.merchant_reference || body.reference || null,
            checkoutRequestId: body.checkout_request_id || body.checkoutRequestId || null,
            failureReason: null,
            ...(finalAccepted ? { completedAt: BigInt(Date.now()) } : {})
          }
        });
        results.push({ reference: withdrawal.reference, status: finalAccepted ? 'SETTLED' : 'PROCESSING' });
      } catch (error) {
        const reason = (error instanceof Error ? error.message : 'Unknown PayHero transport error').slice(0, 500);
        await prisma.withdrawal.updateMany({ where: { id: withdrawal.id, status: 'DISPATCHING' }, data: { status: 'PAYOUT_RECONCILIATION', failureReason: reason } });
        results.push({ reference: withdrawal.reference, status: 'PAYOUT_RECONCILIATION' });
      }
    }

    return NextResponse.json({ success: true, examined: queued.length, dispatched: results.length, results });
  } catch (error) {
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : 'Withdrawal dispatch failed' }, { status: 500 });
  }
}
