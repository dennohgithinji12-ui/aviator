import { NextRequest, NextResponse } from 'next/server';
import { getDepositBonusStatus } from '@/lib/db/operations';
import { verifyToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
  const session = verifyToken(token);
  if (!session) return NextResponse.json({ success: false, error: 'Sign in to see available promotions' }, { status: 401 });
  try {
    const promo = await getDepositBonusStatus(session.phone);
    if (!promo) return NextResponse.json({ success: false, error: 'Account not found' }, { status: 404 });
    return NextResponse.json({ success: true, ...promo }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to load promotion status' }, { status: 503 });
  }
}
