import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { claimDepositBonus } from '@/lib/db/operations';

export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const session = verifyToken(token);
  if (!session) return NextResponse.json({ success: false, error: 'LOGIN_REQUIRED', message: 'Sign in to claim this reward.' }, { status: 401 });

  try {
    const body = await request.json();
    const tier = Number(body?.tier);
    if (tier !== 100 && tier !== 500) {
      return NextResponse.json({ success: false, error: 'INVALID_TIER', message: 'Choose a valid deposit reward.' }, { status: 400 });
    }
    const result = await claimDepositBonus(session.phone, tier);
    return NextResponse.json(result, { status: result.success ? 200 : 400, headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'CLAIM_FAILED', message: 'Unable to claim this reward right now.' }, { status: 500 });
  }
}
