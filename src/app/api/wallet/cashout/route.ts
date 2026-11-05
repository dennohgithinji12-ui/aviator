import { NextRequest, NextResponse } from 'next/server';
import { getUser, updateBalance, settleBet } from '@/lib/db/operations';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const phone = data.phone?.trim();

    if (!phone || phone === 'guest') {
      return NextResponse.json({
        success: false,
        code: 'ACCOUNT_REQUIRED',
        message: 'An active account is required to cash out winnings'
      }, { status: 401 });
    }

    const mode = data.mode === 'REAL' ? 'REAL' : 'DEMO';
    const betId = parseInt(data.betId) || 0;
    const multiplier = parseFloat(data.multiplier) || 1.0;
    const payout = parseFloat(data.payout) || 0;
    const profit = parseFloat(data.profit) || 0;

    if (payout > 0) {
      await updateBalance(phone, mode, payout);
    }
    if (betId > 0) {
      await settleBet(betId, multiplier, payout, profit);
    }

    const updated = await getUser(phone);
    return NextResponse.json({
      success: true,
      mode,
      payout,
      realBalance: Number(updated?.realBalance),
      demoBalance: Number(updated?.demoBalance)
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
