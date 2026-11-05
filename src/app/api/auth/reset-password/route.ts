import { NextRequest, NextResponse } from 'next/server';
import { checkResetRateLimit, recordResetAttempt } from '@/lib/db/operations';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const phone = data.phone || '';

    if (!phone) {
      return NextResponse.json({
        success: false,
        error: 'Phone number required'
      }, { status: 400 });
    }

    const rateCheck = await checkResetRateLimit(phone);
    if (!rateCheck.allowed) {
      return NextResponse.json({
        success: false,
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Strict Security Limit: Password reset can only be performed a maximum of 2 times per rolling week',
        ...rateCheck
      }, { status: 429 });
    }

    await recordResetAttempt(phone);
    const newRate = await checkResetRateLimit(phone);

    return NextResponse.json({
      success: true,
      message: 'Password reset registered and OTP sent via Firebase Spark SMS gateway',
      remainingResetsThisWeek: newRate.remainingResets
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
