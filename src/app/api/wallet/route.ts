import { NextRequest, NextResponse } from 'next/server';
import { getBalances, getTotalDeposits, getTotalTurnover } from '@/lib/db/operations';
import { verifyToken } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    const session = verifyToken(token);
    if (!session) return NextResponse.json({ success: false, error: 'Sign in to view your wallet' }, { status: 401 });
    const balances = await getBalances(session.phone);
    const totalDeposits = await getTotalDeposits(session.phone);
    const totalTurnover = await getTotalTurnover(session.phone);
    const turnoverCompleted = (totalDeposits === 0) || (totalTurnover >= totalDeposits);

    return NextResponse.json({
      success: true,
      id: session.userId,
      ...balances,
      totalDeposits,
      totalTurnover,
      turnoverCompleted,
      turnoverRequired: Math.max(0, totalDeposits - totalTurnover)
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
