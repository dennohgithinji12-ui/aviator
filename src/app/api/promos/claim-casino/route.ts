import { NextRequest, NextResponse } from 'next/server';
import { claimCasinoStakeBonus } from '@/lib/db/operations';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const phone = data.phone?.trim();

    if (!phone || phone === 'guest') {
      return NextResponse.json({
        success: false,
        error: 'LOGIN_REQUIRED',
        message: 'Please register or log in to track your 500 Bob stake progress'
      }, { status: 401 });
    }

    const result = await claimCasinoStakeBonus(phone);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
