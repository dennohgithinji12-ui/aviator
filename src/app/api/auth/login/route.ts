import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getUser } from '@/lib/db/operations';
import { generateToken } from '@/lib/auth';
import { verifyPassword } from '@/lib/password';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const phone = data.phone;
    const password = data.password;

    if (typeof phone !== 'string' || !phone.trim()) {
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

    if (typeof password !== 'string' || !password) {
      return NextResponse.json({ success: false, error: 'Password is required' }, { status: 400 });
    }
    if (!user.passwordHash) {
      return NextResponse.json({ success: false, error: 'This account has no password yet. Contact support to recover access.' }, { status: 401 });
    }
    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      return NextResponse.json({
        success: false,
        error: 'Incorrect phone number or password'
      }, { status: 401 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: BigInt(Date.now()) } });

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
