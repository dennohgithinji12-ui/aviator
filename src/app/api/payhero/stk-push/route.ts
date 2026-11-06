import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyToken } from '@/lib/auth';
import { callPayHeroApi } from '@/lib/payhero';
import {
  checkStkRateLimit,
  recordStkAttempt,
  createDeposit,
  updateDepositProviderDetails,
  completeDeposit,
  failDeposit
} from '@/lib/db/operations';

const PAYHERO_TRANSACTIONS = new Map<string, any>();

function simulateSandboxSuccess(reference: string, txRecord: any) {
  setTimeout(() => {
    if (PAYHERO_TRANSACTIONS.has(reference)) {
      const tx = PAYHERO_TRANSACTIONS.get(reference);
      if (tx.status === 'PENDING') {
        tx.status = 'SUCCESS';
        tx.receiptNumber = 'NL' + Math.random().toString(36).substring(2, 9).toUpperCase();
        tx.completedAt = Date.now();
        PAYHERO_TRANSACTIONS.set(reference, tx);

        void completeDeposit(reference, tx.receiptNumber).catch((e) => console.error('[DB Deposit Error]:', e instanceof Error ? e.message : 'Unknown error'));

        console.log(`[PayHero Sandbox] Confirmed M-PESA STK Push payment for ${tx.reference}: KES ${tx.amount} (Receipt: ${tx.receiptNumber})`);
      }
    }
  }, 3500);
}

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    const session = verifyToken(token);
    if (!session) return NextResponse.json({ success: false, error: 'Sign in before starting a deposit' }, { status: 401 });
    const data = await req.json();
    const amount = parseFloat(data.amount);
    const phone = session.phone;

    if (!Number.isFinite(amount) || amount < 49 || !Number.isInteger(amount)) {
      return NextResponse.json({
        success: false,
        error: 'Deposit must be a whole KES amount of at least KES 49'
      }, { status: 400 });
    }

    if (!phone || phone.length < 10) {
      return NextResponse.json({
        success: false,
        error: 'Please enter a valid Kenyan phone number (e.g. 0712 345 678)'
      }, { status: 400 });
    }

    const rateCheck = await checkStkRateLimit(phone);
    if (!rateCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: rateCheck.message,
        reason: rateCheck.reason
      }, { status: 429 });
    }

    await recordStkAttempt(phone, 'PENDING');

    const reference = data.reference || `PH_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    const txRecord: any = {
      reference,
      phone,
      amount,
      status: 'PENDING',
      createdAt: Date.now()
    };
    PAYHERO_TRANSACTIONS.set(reference, txRecord);

    await createDeposit(reference, phone, amount);

    const paymentMode = await prisma.appSetting.findUnique({ where: { key: 'PAYMENTS_SANDBOX_MODE' }, select: { value: true } });
    const sandboxMode = process.env.NODE_ENV !== 'production' && (paymentMode ? paymentMode.value === true : process.env.PAYMENTS_SANDBOX_MODE !== 'false');
    const apiKey = process.env.PAYHERO_API_KEY;
    const apiSecret = process.env.PAYHERO_API_SECRET;
    const channelId = process.env.PAYHERO_CHANNEL_ID || '4848';

    if (process.env.NODE_ENV === 'production' && (!apiKey || !apiSecret || !process.env.PAYHERO_CALLBACK_SECRET)) {
      return NextResponse.json({ success: false, error: 'Live payment credentials and callback secret are not configured' }, { status: 503 });
    }

    if (apiKey && apiSecret && !sandboxMode) {
      try {
        const callbackUrl = new URL('/api/payhero/callback', process.env.APP_BASE_URL || req.nextUrl.origin);
        callbackUrl.searchParams.set('key', process.env.PAYHERO_CALLBACK_SECRET || '');
        const phRes = await callPayHeroApi('payments', 'POST', {
          amount: Math.round(amount),
          phone_number: phone,
          channel_id: parseInt(channelId),
          provider: 'm-pesa',
          external_reference: reference,
          customer_name: data.customerName || 'Aviator Pilot',
          callback_url: callbackUrl.toString()
        });

        const phJson = phRes.body || {};

        if (phRes.statusCode >= 400 || (phJson.error_message && !phJson.success)) {
          await failDeposit(reference);
          console.warn('[PayHero Live API Notice]:', phRes.statusCode, phJson);

          if (phJson.error_message && phJson.error_message.includes('insufficient balance')) {
            return NextResponse.json({
              success: false,
              code: 'INSUFFICIENT_SERVICE_FLOAT',
              error: 'PayHero service float is currently low. Please try again shortly',
              reference,
              payheroResponse: phJson
            }, { status: 400 });
          }

          return NextResponse.json({
            success: false,
            error: phJson.error_message || phJson.message || 'PayHero payment initiation failed',
            payheroResponse: phJson
          }, { status: 400 });
        }

        if (phJson.reference) txRecord.payheroReference = phJson.reference;
        if (phJson.CheckoutRequestID) txRecord.checkoutRequestId = phJson.CheckoutRequestID;
        PAYHERO_TRANSACTIONS.set(reference, txRecord);
        await updateDepositProviderDetails(reference, phJson.reference, phJson.CheckoutRequestID);

        return NextResponse.json({
          success: true,
          status: 'PENDING',
          reference,
          payheroReference: phJson.reference,
          checkoutRequestId: phJson.CheckoutRequestID,
          message: `STK Push sent to 0${phone.substring(3)}. Enter your M-PESA PIN to complete deposit of KES ${amount}`,
          payheroResponse: phJson
        });
      } catch (liveErr) {
        await failDeposit(reference);
        console.warn('[PayHero Live Error]:', liveErr instanceof Error ? liveErr.message : 'Unknown error');
        return NextResponse.json({
          success: false,
          code: 'PAYHERO_API_ERROR',
          error: `PayHero connection issue: ${liveErr instanceof Error ? liveErr.message : 'Unknown error'}. Please try again shortly`
        }, { status: 400 });
      }
    } else {
      console.log(`[PayHero Sandbox] Simulated STK Push for KES ${amount} to ${phone} (Ref: ${reference})`);
      simulateSandboxSuccess(reference, txRecord);

      return NextResponse.json({
        success: true,
        status: 'PENDING',
        reference,
        message: `STK Push prompt sent to 0${phone.substring(3)}. Enter your M-PESA PIN on your phone to complete deposit of KES ${amount}`,
        isSandbox: true
      });
    }
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
