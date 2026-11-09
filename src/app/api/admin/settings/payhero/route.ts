import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';
import { getPayHeroConfig, savePayHeroConfig } from '@/lib/payhero-config';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin || admin.role !== 'SUPER_ADMIN') return NextResponse.json({ success: false, error: 'Super administrator permission required' }, { status: 403 });
  try {
    const { username, password, channelId, callbackSecret, payoutAccountId, networkCode, payoutsEnabled } = await getPayHeroConfig();
    return NextResponse.json({ success: true, settings: { username, channelId, payoutAccountId, networkCode, payoutsEnabled, passwordSaved: Boolean(password), callbackSecretSaved: Boolean(callbackSecret) } }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to load PayHero settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin || admin.role !== 'SUPER_ADMIN') return NextResponse.json({ success: false, error: 'Super administrator permission required' }, { status: 403 });
  try {
    const body = await request.json();
    const previous = await getPayHeroConfig();
    const username = String(body.username || '').trim();
    const password = String(body.password || '') || previous.password;
    const channelId = String(body.channelId || '').trim();
    const callbackSecret = String(body.callbackSecret || '') || previous.callbackSecret;
    const payoutAccountId = String(body.payoutAccountId || '').trim();
    const networkCode = String(body.networkCode || '').trim();
    const payoutsEnabled = body.payoutsEnabled === true;
    if (!username || !password || !/^\d+$/.test(channelId) || Number(channelId) < 1 || !callbackSecret || callbackSecret.length < 16 || (payoutsEnabled && (!/^\d+$/.test(payoutAccountId) || !networkCode))) {
      return NextResponse.json({ success: false, error: 'Enter API credentials, a numeric channel ID, and a callback secret of at least 16 characters. Payouts also need an account ID and network code.' }, { status: 400 });
    }
    await savePayHeroConfig({ username, password, channelId, callbackSecret, payoutAccountId, networkCode, payoutsEnabled });
    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to save PayHero settings' }, { status: 500 });
  }
}
