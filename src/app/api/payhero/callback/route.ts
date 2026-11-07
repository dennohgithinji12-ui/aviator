import { timingSafeEqual } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { completeDeposit, failDeposit, getDeposit } from '@/lib/db/operations';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function matchesSecret(expected: string | undefined, supplied: string | null) {
  if (!expected || !supplied) return false;
  const expectedBytes = Buffer.from(expected);
  const suppliedBytes = Buffer.from(supplied);
  return expectedBytes.length === suppliedBytes.length && timingSafeEqual(expectedBytes, suppliedBytes);
}

function normalizedPhone(value: unknown) {
  let phone = String(value || '').replace(/\D/g, '');
  if (phone.startsWith('0') && phone.length === 10) phone = `254${phone.slice(1)}`;
  return phone;
}

export async function POST(request: NextRequest) {
  if (!matchesSecret(process.env.PAYHERO_CALLBACK_SECRET, request.nextUrl.searchParams.get('key'))) {
    return NextResponse.json({ status: 'ERROR', error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await request.json();
    const response = payload?.response || {};
    const reference = String(response.ExternalReference || payload.external_reference || '').trim();
    if (!reference) return NextResponse.json({ status: 'ERROR', error: 'Missing external reference' }, { status: 400 });

    const deposit = await getDeposit(reference);
    if (!deposit) return NextResponse.json({ status: 'ERROR', error: 'Deposit reference not found' }, { status: 404 });
    if (deposit.status === 'SUCCESS') return NextResponse.json({ status: 'OK', note: 'Already processed' });

    const resultCode = Number(response.ResultCode);
    const paymentStatus = String(response.Status || '').toLowerCase();
    if (response.ResultCode === undefined || !response.Status) {
      return NextResponse.json({ status: 'ERROR', error: 'Missing payment result in callback' }, { status: 400 });
    }
    const succeeded = resultCode === 0 && paymentStatus === 'success';
    if (!succeeded) {
      await failDeposit(reference, String(response.ResultDesc || response.Status || 'M-PESA payment was cancelled or failed'));
      return NextResponse.json({ status: 'OK', note: 'Failed payment recorded' });
    }

    const callbackAmount = Number(response.Amount);
    const callbackPhone = normalizedPhone(response.Phone);
    if (!response.MpesaReceiptNumber || !Number.isFinite(callbackAmount) || callbackAmount !== Number(deposit.amount) || callbackPhone !== deposit.phone) {
      console.error('[PayHero callback mismatch]', { reference, amountMatched: callbackAmount === Number(deposit.amount), phoneMatched: !callbackPhone || callbackPhone === deposit.phone });
      return NextResponse.json({ status: 'ERROR', error: 'Payment callback did not match the pending deposit' }, { status: 400 });
    }

    await completeDeposit(reference, String(response.MpesaReceiptNumber));
    return NextResponse.json({ status: 'OK' });
  } catch (error) {
    console.error('[PayHero callback]', error instanceof Error ? error.message : 'Unknown error');
    return NextResponse.json({ status: 'ERROR', error: 'Unable to process payment callback' }, { status: 500 });
  }
}
