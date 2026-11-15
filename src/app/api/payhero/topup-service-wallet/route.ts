import { NextRequest, NextResponse } from 'next/server';
import { callPayHeroApi } from '@/lib/payhero';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const amount = Math.max(10, Math.round(parseFloat(data.amount) || 50));
    let phone = String(data.phone || '').trim().replace(/[^\d+]/g, '');

    if (phone.startsWith('07') || phone.startsWith('01')) {
      phone = '254' + phone.substring(1);
    } else if (phone.startsWith('+254')) {
      phone = phone.substring(1);
    } else if (!phone.startsWith('254') && phone.length === 9) {
      phone = '254' + phone;
    }

    if (!phone || phone.length < 10) {
      return NextResponse.json({
        success: false,
        error: 'Valid phone number required for float top-up'
      }, { status: 400 });
    }

    const topupRes = await callPayHeroApi('topup', 'POST', {
      amount: amount,
      phone_number: phone
    });

    if (topupRes.statusCode >= 400 || (topupRes.body && topupRes.body.error_message)) {
      return NextResponse.json({
        success: false,
        error: topupRes.body.error_message || 'PayHero float top-up failed',
        details: topupRes.body
      }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      message: `M-PESA prompt of KES ${amount} sent to 0${phone.substring(3)}. Enter your PIN to credit PayHero Service Float.`,
      reference: topupRes.body.reference,
      checkoutRequestId: topupRes.body.CheckoutRequestID
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
