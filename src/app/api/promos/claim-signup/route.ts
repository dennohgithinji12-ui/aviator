import { NextRequest, NextResponse } from 'next/server';
import { claimSignupBonus } from '@/lib/db/operations';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const phone = data.phone?.trim();

    if (!phone || phone === 'guest') {
      return NextResponse.json({
        success: false,
        error: 'LOGIN_REQUIRED',
        message: 'Please register or log in with your phone to claim your KES 20 signup freebet'
      }, { status: 401 });
    }

    const result = await claimSignupBonus(phone);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
