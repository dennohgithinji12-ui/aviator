import { NextResponse } from 'next/server';
import { callPayHeroApi } from '@/lib/payhero';
import { getPayHeroConfig } from '@/lib/payhero-config';

export async function GET() {
  try {
    const config = await getPayHeroConfig();
    const result = await callPayHeroApi('wallets?wallet_type=service_wallet', 'GET');
    const data = result.body || {};

    return NextResponse.json({
      success: result.statusCode < 400,
      availableBalance: data.available_balance !== undefined ? parseFloat(data.available_balance) : 0,
      currency: data.currency || 'KES',
      status: data.wallet_status || 'ACTIVE',
      channelId: config.channelId,
      tillNumber: '9956081',
      secondaryTillNumber: '6310357'
    });
  } catch (err) {
    return NextResponse.json({
      success: false,
      availableBalance: 0,
      currency: 'KES',
      error: err instanceof Error ? err.message : 'Unknown error',
      channelId: '',
      tillNumber: '9956081',
      secondaryTillNumber: '6310357'
    });
  }
}
