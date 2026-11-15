import { NextRequest, NextResponse } from 'next/server';
import { getDeposit, getBalances } from '@/lib/db/operations';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    const session = verifyToken(token);
    if (!session) return NextResponse.json({ success: false, error: 'Sign in to check payment status' }, { status: 401 });
    const ref = req.nextUrl.searchParams.get('reference') || req.nextUrl.searchParams.get('ref') || '';
    const tx = ref ? await getDeposit(ref) : null;
    if (!tx || tx.phone !== session.phone) {
      return NextResponse.json({
        success: false,
        status: 'NOT_FOUND'
      });
    }
    const balances = await getBalances(tx.phone);
    return NextResponse.json({
      success: true,
      status: tx.status,
      reference: tx.reference,
      amount: Number(tx.amount),
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
