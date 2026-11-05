import { NextRequest, NextResponse } from 'next/server';
import { callPayHeroApi } from '@/lib/payhero';
import {
  checkStkRateLimit,
  recordStkAttempt,
  createDeposit,
  getDeposit,
  completeDeposit,
  getBalances
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

        try {
          completeDeposit(reference, tx.receiptNumber);
        } catch (e) {
          console.error('[DB Deposit Error]:', e instanceof Error ? e.message : 'Unknown error');
        }

        console.log(`[PayHero Sandbox] Confirmed M-PESA STK Push payment for ${tx.reference}: KES ${tx.amount} (Receipt: ${tx.receiptNumber})`);
      }
    }
  }, 3500);
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const amount = parseFloat(data.amount);
    let phone = String(data.phone || '').trim().replace(/[^\d+]/g, '');

    if (phone.startsWith('07') || phone.startsWith('01')) {
      phone = '254' + phone.substring(1);
    } else if (phone.startsWith('+254')) {
      phone = phone.substring(1);
    } else if (!phone.startsWith('254') && phone.length === 9) {
      phone = '254' + phone;
    }

    if (isNaN(amount) || amount < 49) {
      return NextResponse.json({
        success: false,
        error: 'Minimum deposit is KES 49.00 (49 Bob). Please enter 49 KES or more'
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

    try {
      await createDeposit(reference, phone, amount);
    } catch (e) {
      console.warn('[DB Deposit Init Notice]:', e instanceof Error ? e.message : 'Unknown error');
    }

    const apiKey = process.env.PAYHERO_API_KEY;
    const apiSecret = process.env.PAYHERO_API_SECRET;
    const channelId = process.env.PAYHERO_CHANNEL_ID || '4848';

    if (apiKey && apiSecret && !data.forceSandbox) {
      try {
        const phRes = await callPayHeroApi('payments', 'POST', {
          amount: Math.round(amount),
          phone_number: phone,
          channel_id: parseInt(channelId),
          provider: 'm-pesa',
          external_reference: reference,
          customer_name: data.customerName || 'Aviator Pilot',
          callback_url: `${req.headers.get('host')}/api/payhero/callback`
        });

        const phJson = phRes.body || {};

        if (phRes.statusCode >= 400 || (phJson.error_message && !phJson.success)) {
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
