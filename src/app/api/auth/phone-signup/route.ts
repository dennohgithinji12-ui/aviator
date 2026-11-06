import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { hashPassword } from '@/lib/password';

function normalizePhone(raw: unknown) {
  if (typeof raw !== 'string') return '';
  let digits = raw.trim().replace(/\D/g, '');
  if (digits.startsWith('0')) digits = `254${digits.slice(1)}`;
  else if (digits.startsWith('7') || digits.startsWith('1')) digits = `254${digits}`;
  return /^254[17]\d{8}$/.test(digits) ? digits : '';
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const phone = normalizePhone(data.phone);
    const password = typeof data.password === 'string' ? data.password : '';
    const username = typeof data.username === 'string' ? data.username.trim().slice(0, 32) : '';
    if (!phone) return NextResponse.json({ success: false, error: 'Enter a valid Kenyan phone number' }, { status: 400 });
    if (password.length < 8 || password.length > 72) return NextResponse.json({ success: false, error: 'Password must be between 8 and 72 characters' }, { status: 400 });
    const existing = await prisma.user.findUnique({ where: { phone }, select: { id: true } });
    if (existing) return NextResponse.json({ success: false, code: 'ACCOUNT_EXISTS', error: 'An account already exists for this phone number. Log in instead.' }, { status: 409 });

    const now = BigInt(Date.now());
    await prisma.user.create({
      data: {
        phone,
        username: username || `pilot_${phone.slice(-4)}`,
        passwordHash: await hashPassword(password),
        realBalance: 0,
        demoBalance: 50000,
        createdAt: now,
        lastLogin: null
      }
    });
    return NextResponse.json({ success: true, message: 'Account created. Log in to continue.' }, { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ success: false, code: 'ACCOUNT_EXISTS', error: 'An account already exists for this phone number. Log in instead.' }, { status: 409 });
    }
    return NextResponse.json({ success: false, error: 'Unable to create account right now. Try again.' }, { status: 500 });
  }
}
