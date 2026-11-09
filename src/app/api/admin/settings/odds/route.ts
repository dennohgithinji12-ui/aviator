import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';
import { getLiveRoundState } from '@/app/api/round-state/route';
import { getOddsPolicyChanges, isFavorableOddsEnabled, scheduleOddsPolicyChange, FAVORABLE_ODDS_TARGET_PERCENT } from '@/lib/engine/odds-policy';

export const dynamic = 'force-dynamic';

async function requireAdmin(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin) return null;
  if (!['SUPER_ADMIN', 'ADMIN'].includes(admin.role)) return null;
  return admin;
}

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ success: false, error: 'Administrator permission required' }, { status: 403 });
  }
  try {
    const [current, changes] = await Promise.all([getLiveRoundState(), getOddsPolicyChanges()]);
    const effectiveFromNonce = current.nonce + 1;
    return NextResponse.json({
      success: true,
      enabled: isFavorableOddsEnabled(changes, effectiveFromNonce),
      effectiveFromNonce,
      targetPercent: FAVORABLE_ODDS_TARGET_PERCENT
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to load round odds settings' }, { status: 503 });
  }
}

export async function PUT(request: NextRequest) {
  if (!await requireAdmin(request)) {
    return NextResponse.json({ success: false, error: 'Administrator permission required' }, { status: 403 });
  }
  try {
    const body = await request.json();
    if (typeof body.enabled !== 'boolean') {
      return NextResponse.json({ success: false, error: 'Provide enabled as true or false' }, { status: 400 });
    }
    const current = await getLiveRoundState();
    const effectiveFromNonce = current.nonce + 1;
    await scheduleOddsPolicyChange(effectiveFromNonce, body.enabled);
    return NextResponse.json({
      success: true,
      enabled: body.enabled,
      effectiveFromNonce,
      targetPercent: FAVORABLE_ODDS_TARGET_PERCENT
    }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to save round odds settings' }, { status: 503 });
  }
}
