import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { callPayHeroApi } from '@/lib/payhero';
import {
  checkStkRateLimit,
  recordStkAttempt,
  createDeposit,
  updateDepositProviderDetails,
  failDeposit
} from '@/lib/db/operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const session = verifyToken(token);
  if (!session) return NextResponse.json({ success: false, error: 'Sign in before starting a deposit' }, { status: 401 });

  const username = process.env.PAYHERO_API_USERNAME || process.env.PAYHERO_API_KEY;
  const password = process.env.PAYHERO_API_PASSWORD || process.env.PAYHERO_API_SECRET;
  const channelId = Number(process.env.PAYHERO_CHANNEL_ID);
  const baseUrl = process.env.APP_BASE_URL?.replace(/\/+$/, '');
  const callbackSecret = process.env.PAYHERO_CALLBACK_SECRET;
  let publicBaseUrl: URL | null = null;
  try { if (baseUrl) publicBaseUrl = new URL(baseUrl); } catch { /* reported below */ }
  if (!username || !password || !Number.isInteger(channelId) || channelId < 1 || publicBaseUrl?.protocol !== 'https:' || !callbackSecret) {
    return NextResponse.json({ success: false, error: 'PayHero username, password, channel ID, callback secret, and public app URL must be configured' }, { status: 503 });
  }

  let reference = '';
  try {
    const body = await request.json();
    const amount = Number(body?.amount);
    const phone = session.phone.replace(/\D/g, '');
    if (!Number.isSafeInteger(amount) || amount < Number(process.env.MINIMUM_DEPOSIT_KES || 49)) {
      return NextResponse.json({ success: false, error: `Deposit must be a whole KES amount of at least KES ${process.env.MINIMUM_DEPOSIT_KES || 49}` }, { status: 400 });
    }
    if (!/^254(?:7|1)\d{8}$/.test(phone)) {
      return NextResponse.json({ success: false, error: 'Your account phone number is not a valid Kenyan M-PESA number' }, { status: 400 });
    }

    const rateCheck = await checkStkRateLimit(phone);
    if (!rateCheck.allowed) {
      return NextResponse.json({ success: false, error: rateCheck.message, reason: rateCheck.reason }, { status: 429 });
    }

    reference = `SS_${Date.now()}_${randomUUID().replaceAll('-', '').slice(0, 12).toUpperCase()}`;
    await createDeposit(reference, phone, amount);
    await recordStkAttempt(phone, 'PENDING');

    const callbackUrl = new URL('/api/payhero/callback', publicBaseUrl);
    callbackUrl.searchParams.set('key', callbackSecret);
    const response = await callPayHeroApi('payments', 'POST', {
      amount,
      phone_number: `0${phone.slice(3)}`,
      channel_id: channelId,
      provider: 'm-pesa',
      external_reference: reference,
      callback_url: callbackUrl.toString()
    });
    const result = response.body;
    if (response.statusCode < 200 || response.statusCode >= 300 || result.success !== true) {
      const reason = String(result.error_message || result.message || 'PayHero did not accept the STK Push request');
      await failDeposit(reference, reason);
      return NextResponse.json({ success: false, error: reason, reference }, { status: 502 });
    }

    await updateDepositProviderDetails(reference, result.reference, result.CheckoutRequestID);
    return NextResponse.json({
      success: true,
      status: result.status || 'QUEUED',
      reference,
      payheroReference: result.reference || null,
      checkoutRequestId: result.CheckoutRequestID || null,
      message: `M-PESA prompt sent to 0${phone.slice(3)}. Enter your PIN to complete the KES ${amount} deposit.`
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === 'TimeoutError';
    if (reference && !timedOut) await failDeposit(reference, error instanceof Error ? error.message : 'Unable to contact PayHero').catch(() => undefined);
    console.error('[PayHero STK Push]', error instanceof Error ? error.message : 'Unknown error');
    if (reference && timedOut) {
      return NextResponse.json({
        success: true,
        status: 'PENDING',
        reference,
        message: 'PayHero did not respond in time. The request may still be processing; this window will keep checking for confirmation.'
      }, { status: 202, headers: { 'Cache-Control': 'no-store' } });
    }
    return NextResponse.json({
      success: false,
      error: 'Unable to start the M-PESA payment. Please try again shortly.',
      ...(reference ? { reference } : {})
    }, { status: 502 });
  }
}
