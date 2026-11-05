import { NextRequest, NextResponse } from 'next/server';
import { callPayHeroApi } from '@/lib/payhero';
import { getDeposit, completeDeposit, getBalances } from '@/lib/db/operations';

const PAYHERO_TRANSACTIONS = new Map<string, any>();

export async function GET(req: NextRequest) {
  try {
    const ref = req.nextUrl.searchParams.get('reference') || req.nextUrl.searchParams.get('ref') || '';
    let tx = PAYHERO_TRANSACTIONS.get(ref);

    if (!tx) {
      const dbDep = await getDeposit(ref);
      if (dbDep) {
        tx = {
          reference: dbDep.reference,
          status: dbDep.status,
          amount: Number(dbDep.amount),
          phone: dbDep.phone || '',
          receiptNumber: dbDep.receiptNumber || null
        };
      }
    }

    if (!tx) {
      return NextResponse.json({
        success: false,
        status: 'NOT_FOUND'
      });
    }

    if (tx.status === 'PENDING' && process.env.PAYHERO_API_KEY) {
      try {
        const tRes = await callPayHeroApi('transactions?page=1&per_page=25', 'GET');
        if (tRes.body && Array.isArray(tRes.body.transactions)) {
          const match = tRes.body.transactions.find((t: any) => {
            const ext = String(t.external_reference || '');
            const txRef = String(t.transaction_reference || '');
            const desc = String(t.description || '');
            const ben = String(t.beneficiary_number || '');
            const prov = String(t.provider_reference || '');

            const matchRef = (ext && ext === tx.reference);
            const matchPayheroRef = (tx.payheroReference && txRef === tx.payheroReference);
            const matchPhone = (tx.phone && (desc.includes(tx.phone.slice(-9)) || ben.includes(tx.phone.slice(-9))));

            return (matchRef || matchPayheroRef || matchPhone) && !prov.startsWith('cost_');
          });

          if (match) {
            const receipt = match.provider_reference || ('NL' + Math.random().toString(36).substring(2, 9).toUpperCase());
            tx.status = 'SUCCESS';
            tx.receiptNumber = receipt;
            if (match.amount) tx.amount = parseFloat(match.amount);
            PAYHERO_TRANSACTIONS.set(ref, tx);
            await completeDeposit(tx.reference, receipt);
            console.log(`[PayHero Status] Reconciled deposit ${tx.reference} via PayHero API -> Receipt: ${receipt}`);
          }
        }
      } catch (apiErr) {
        console.warn('[PayHero Status Reconcile Warning]:', apiErr instanceof Error ? apiErr.message : 'Unknown error');
      }
    }

    const balances = await getBalances(tx.phone || '');
    return NextResponse.json({
      success: true,
      status: tx.status,
      reference: tx.reference,
      amount: tx.amount,
      phone: tx.phone,
      receiptNumber: tx.receiptNumber || null,
      realBalance: balances.realBalance,
      demoBalance: balances.demoBalance
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      error: err instanceof Error ? err.message : 'Unknown error'
    }, { status: 500 });
  }
}
