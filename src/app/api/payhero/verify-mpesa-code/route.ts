import { NextRequest, NextResponse } from 'next/server';
import { callPayHeroApi } from '@/lib/payhero';
import {
  getDepositByReceipt,
  createDeposit,
  completeDeposit,
  getBalances
} from '@/lib/db/operations';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const rawCode = String(data.mpesaCode || data.receipt || '').trim().toUpperCase();
    let phone = String(data.phone || '').trim().replace(/[^\d+]/g, '');

    if (phone.startsWith('07') || phone.startsWith('01')) {
      phone = '254' + phone.substring(1);
    } else if (phone.startsWith('+254')) {
      phone = phone.substring(1);
    } else if (!phone.startsWith('254') && phone.length === 9) {
      phone = '254' + phone;
    }

    if (!rawCode || rawCode.length < 8) {
      return NextResponse.json({
        success: false,
        error: 'Please enter a valid M-PESA confirmation receipt code (e.g. UAO234VA8A or NL12345678)'
      }, { status: 400 });
    }

    const alreadyClaimed = await getDepositByReceipt(rawCode);
    if (alreadyClaimed && alreadyClaimed.status === 'SUCCESS') {
      return NextResponse.json({
        success: false,
        error: `M-PESA receipt code ${rawCode} has already been credited to user ${alreadyClaimed.phone}`
      }, { status: 400 });
    }

    let matchedTx = null;
    try {
      const txRes = await callPayHeroApi('transactions?page=1&per_page=50', 'GET');
      if (txRes.body && Array.isArray(txRes.body.transactions)) {
        matchedTx = txRes.body.transactions.find((t: any) => {
          const provRef = String(t.provider_reference || '').toUpperCase();
          const extRef = String(t.external_reference || '').toUpperCase();
          const txRef = String(t.transaction_reference || '').toUpperCase();
          return provRef === rawCode || provRef.endsWith(rawCode) || extRef === rawCode || txRef.includes(rawCode);
        });
      }
    } catch (apiErr) {
      console.warn('[PayHero Transactions Query Warning]:', apiErr);
    }

    if (matchedTx) {
      const creditedAmount = Math.max(10, parseFloat(matchedTx.amount) || parseFloat(data.amount) || 10);
      const ref = `PH_TILL_${rawCode}`;
      await createDeposit(ref, phone, creditedAmount);
      await completeDeposit(ref, rawCode);
      const balances = await getBalances(phone);

      return NextResponse.json({
        success: true,
        message: `Deposit verified! KES ${creditedAmount.toFixed(2)} credited from Lipa na M-PESA Till payment (Ref: ${rawCode})`,
        receiptNumber: rawCode,
        reference: ref,
        creditedAmount,
        realBalance: balances.realBalance,
        demoBalance: balances.demoBalance
      });
    }

    if (data.isSandbox === true || process.env.PAYHERO_SANDBOX === 'true') {
      const creditedAmount = Math.max(10, parseFloat(data.amount) || 10);
      const ref = `PH_TEST_${rawCode}`;
      await createDeposit(ref, phone, creditedAmount);
      await completeDeposit(ref, rawCode);
      const balances = await getBalances(phone);

      return NextResponse.json({
        success: true,
        message: `[Sandbox] Test receipt ${rawCode} verified! KES ${creditedAmount.toFixed(2)} credited`,
        receiptNumber: rawCode,
        reference: ref,
        creditedAmount,
        realBalance: balances.realBalance,
        demoBalance: balances.demoBalance
      });
    }

    return NextResponse.json({
      success: false,
      error: `M-PESA receipt code ${rawCode} was not found in recent PayHero Till transactions. If you just sent money to Till 9956081, please wait 15 seconds for Safaricom to sync and try again`,
      code: 'RECEIPT_NOT_FOUND'
    }, { status: 404 });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
