import { NextRequest, NextResponse } from 'next/server';
import { registerPhoneUser } from '@/lib/db/operations';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const phone = data.phone;
    const firebaseUid = data.firebaseUid || null;
    const username = data.username || null;
    const passwordHash = data.passwordHash || null;

    if (!phone) {
      return NextResponse.json({
        success: false,
        error: 'Phone number is required'
      }, { status: 400 });
    }

    const user = await registerPhoneUser(phone, firebaseUid, username, passwordHash);
    return NextResponse.json({
      success: true,
      user: {
        id: user?.id,
        phone: user?.phone,
        firebaseUid: user?.firebaseUid,
        username: user?.username,
        demoBalance: Number(user?.demoBalance),
        realBalance: Number(user?.realBalance)
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
