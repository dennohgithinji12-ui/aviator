import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/db/operations';
import { generateToken } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const phone = data.phone;
    const password = data.password;

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

    // Verify password if user has one set
    if (user.passwordHash) {
      if (!password) {
        return NextResponse.json({
          success: false,
          error: 'Password is required'
        }, { status: 400 });
      }

      const isValid = await verifyPassword(password, user.passwordHash);
      if (!isValid) {
        return NextResponse.json({
          success: false,
          error: 'Incorrect password'
        }, { status: 401 });
      }
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
