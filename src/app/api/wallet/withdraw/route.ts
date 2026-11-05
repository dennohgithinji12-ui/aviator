import { NextRequest, NextResponse } from 'next/server';
import {
  getUser,
  updateBalance,
  createWithdrawal,
  getDailyWithdrawalCount,
  getTotalDeposits,
  getTotalTurnover
} from '@/lib/db/operations';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const phone = data.phone?.trim();
    const targetPhone = data.targetPhone?.trim() || phone;
    const amount = parseFloat(data.amount) || 0;

    if (!phone || phone === 'guest') {
      return NextResponse.json({
        success: false,
        error: 'An active account is required to withdraw funds'
      }, { status: 401 });
    }

    const user = await getUser(phone);
    const normPhone = user?.phone || phone;
    const normTarget = (await getUser(targetPhone))?.phone || targetPhone;

    if (amount < 25) {
      return NextResponse.json({
        success: false,
        error: 'Minimum withdrawal amount is KES 25.00'
      }, { status: 400 });
    }

    const currentBal = await getUser(normPhone);
    if (!currentBal || Number(currentBal.realBalance) < amount) {
      return NextResponse.json({
        success: false,
        error: `Insufficient real money balance (Available: KES ${currentBal?.realBalance || 0})`
      }, { status: 400 });
    }

    // AML Turnover Rule
    const totalDeposits = await getTotalDeposits(normPhone);
    const totalTurnover = await getTotalTurnover(normPhone);
    if (totalDeposits > 0 && totalTurnover < totalDeposits) {
      const deficit = totalDeposits - totalTurnover;
      return NextResponse.json({
        success: false,
        code: 'REJECTED_INSUFFICIENT_TURNOVER',
        error: `AML Compliance: You must wager 100% of deposited funds. Required: KES ${totalDeposits.toFixed(2)}, Current: KES ${totalTurnover.toFixed(2)} (Deficit: KES ${deficit.toFixed(2)})`
      }, { status: 400 });
    }

    // 5% Gaming Tax
    const TAX_RATE = 0.05;
    const grossAmount = amount;
    const taxAmount = Math.round((grossAmount * TAX_RATE) * 100) / 100;
    const netDisbursement = Math.max(0, Math.round((grossAmount - taxAmount) * 100) / 100);

    // Phone mismatch check
    if (normTarget !== normPhone) {
      const reference = `WTH_HOLD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      await updateBalance(normPhone, 'REAL', -grossAmount);
      await createWithdrawal(
        normPhone,
        grossAmount,
        reference,
        'MANUAL_HOLD_PHONE_MISMATCH',
        80,
        'Destination phone mismatch',
        taxAmount,
        netDisbursement
      );
      return NextResponse.json({
        success: true,
        status: 'PROCESSING',
        reference,
        grossAmount,
        taxRate: '5%',
        taxAmount,
        netDisbursement,
        message: `Withdrawal of KES ${grossAmount.toFixed(2)} submitted for verification. 5% Gaming Tax (KES ${taxAmount.toFixed(2)}) reserved.`
      });
    }

    // Velocity check
    const dailyCount = await getDailyWithdrawalCount(normPhone);
    if (dailyCount >= 2) {
      const reference = `WTH_HOLD_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
      await updateBalance(normPhone, 'REAL', -grossAmount);
      await createWithdrawal(
        normPhone,
        grossAmount,
        reference,
        'MANUAL_HOLD_VELOCITY_EXCEEDED',
        60,
        'Velocity exceeded (>2 in 24h)',
        taxAmount,
        netDisbursement
      );
      return NextResponse.json({
        success: true,
        status: 'PROCESSING',
        reference,
        grossAmount,
        taxRate: '5%',
        taxAmount,
        netDisbursement,
        message: `Withdrawal of KES ${grossAmount.toFixed(2)} queued. 5% Gaming Tax (KES ${taxAmount.toFixed(2)}) reserved.`
      });
    }

    // Auto-approval ceiling
    const AUTO_DISBURSEMENT_LIMIT = 5000.00;
    const reference = `WTH_${Date.now()}_${Math.floor(1000 + Math.random() * 9000)}`;
    await updateBalance(normPhone, 'REAL', -grossAmount);

    let status = 'SETTLED';
    let riskScore = 10;
    let riskReason = 'Approved automated B2C payout';

    if (grossAmount > AUTO_DISBURSEMENT_LIMIT) {
      status = 'MANUAL_HOLD_HIGH_VALUE';
      riskScore = 50;
      riskReason = `Amount KES ${grossAmount} exceeds automated ceiling of KES 5,000.00`;
    }

    await createWithdrawal(
      normPhone,
      grossAmount,
      reference,
      status,
      riskScore,
      riskReason,
      taxAmount,
      netDisbursement
    );

    const updatedBal = await getUser(normPhone);

    return NextResponse.json({
      success: true,
      status: 'PROCESSING',
      reference,
      grossAmount,
      taxRate: '5%',
      taxAmount,
      netDisbursement,
      message: `Withdrawal of KES ${grossAmount.toFixed(2)} processed! 5% Gaming Tax (KES ${taxAmount.toFixed(2)}) deducted. KES ${netDisbursement.toFixed(2)} disbursed to M-PESA ${normPhone}.`,
      realBalance: Number(updatedBal?.realBalance),
      demoBalance: Number(updatedBal?.demoBalance)
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
