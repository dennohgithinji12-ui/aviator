import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/operations';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const phone = data.phone;
    const passwordHash = data.passwordHash;

    if (!phone) {
      return NextResponse.json({
        success: false,
        error: 'Phone number is required'
      }, { status: 400 });
    }

    const user = await getUser(phone);
    if (!user) {
      return NextResponse.json({
        success: false,
        error: 'User not found in database'
      }, { status: 404 });
    }

    if (user.passwordHash && passwordHash && user.passwordHash !== passwordHash) {
      return NextResponse.json({
        success: false,
        error: 'Incorrect password'
      }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        phone: user.phone,
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
