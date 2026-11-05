import { NextRequest, NextResponse } from 'next/server';
import { getBalances, getTotalDeposits, getTotalTurnover } from '@/lib/db/operations';

export async function GET(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get('phone') || '';
    const balances = await getBalances(phone);
    const totalDeposits = await getTotalDeposits(phone);
    const totalTurnover = await getTotalTurnover(phone);
    const turnoverCompleted = (totalDeposits === 0) || (totalTurnover >= totalDeposits);

    return NextResponse.json({
      success: true,
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
