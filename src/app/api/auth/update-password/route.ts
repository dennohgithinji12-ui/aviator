import { NextRequest, NextResponse } from 'next/server';
import { updatePassword } from '@/lib/db/operations';
import { verifyToken } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { getUser } from '@/lib/db/operations';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || '';
    const session = verifyToken(token);
    if (!session) return NextResponse.json({ success: false, error: 'Sign in to change your password' }, { status: 401 });
    const currentPassword = typeof data.currentPassword === 'string' ? data.currentPassword : '';
    const newPassword = typeof data.newPassword === 'string' ? data.newPassword : '';
    if (newPassword.length < 8 || newPassword.length > 72) return NextResponse.json({ success: false, error: 'Password must be between 8 and 72 characters' }, { status: 400 });
    const user = await getUser(session.phone);
    if (!user?.passwordHash || !await verifyPassword(currentPassword, user.passwordHash)) return NextResponse.json({ success: false, error: 'Current password is incorrect' }, { status: 401 });
    const updated = await updatePassword(session.phone, await hashPassword(newPassword));
    return NextResponse.json({
      success: Boolean(updated)
    });
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
