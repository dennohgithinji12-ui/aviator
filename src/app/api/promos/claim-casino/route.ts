import { NextRequest, NextResponse } from 'next/server';
import { claimCasinoStakeBonus } from '@/lib/db/operations';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
  try {
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    const session = verifyToken(token);
    if (!session) {
      return NextResponse.json({
        success: false,
        error: 'LOGIN_REQUIRED',
        message: 'Please register or log in to track your 500 Bob stake progress'
      }, { status: 401 });
    }

    const result = await claimCasinoStakeBonus(session.phone);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
