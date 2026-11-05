import { NextRequest, NextResponse } from 'next/server';
import { getUser, updateBalance, recordBet } from '@/lib/db/operations';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const phone = data.phone?.trim();

    if (!phone || phone === 'guest') {
      return NextResponse.json({
        success: false,
        code: 'ACCOUNT_REQUIRED',
        message: 'An active account is required to place bets'
      }, { status: 401 });
    }

    const mode = data.mode === 'REAL' ? 'REAL' : 'DEMO';
    const amount = Math.max(100, parseFloat(data.amount) || 100);
    const terminalId = parseInt(data.terminalId) || 1;
    const roundNonce = parseInt(data.roundNonce) || 0;

    const user = await getUser(phone);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found'
      }, { status: 404 });
    }

    const available = mode === 'REAL' ? Number(user.realBalance) : Number(user.demoBalance);

    if (mode === 'REAL' && Number(user.realBalance) < amount) {
      return NextResponse.json({
        success: false,
        code: 'INSUFFICIENT_REAL_FUNDS',
        message: `Insufficient Real Money balance (KES ${user.realBalance})`
      }, { status: 400 });
    }

    if (mode === 'DEMO' && Number(user.demoBalance) < amount) {
      return NextResponse.json({
        success: false,
        code: 'INSUFFICIENT_DEMO_FUNDS',
        message: 'Insufficient demo balance'
      }, { status: 400 });
    }

    await updateBalance(phone, mode, -amount);
    const betId = await recordBet(phone, mode, terminalId, amount, roundNonce);
    const updated = await getUser(phone);

    return NextResponse.json({
      success: true,
      betId,
      mode,
      amount,
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
