import { NextRequest, NextResponse } from 'next/server';
import { registerPhoneUser } from '@/lib/db/operations';
import { generateToken } from '@/lib/auth';

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

    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'Failed to register user'
      }, { status: 500 });
    }

    const token = generateToken({
      userId: user.id,
      phone: user.phone,
      username: user.username || undefined
    });

    return NextResponse.json({
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        firebaseUid: user.firebaseUid,
        username: user.username,
        demoBalance: Number(user.demoBalance),
        realBalance: Number(user.realBalance)
      }
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
