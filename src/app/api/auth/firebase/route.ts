import { NextRequest, NextResponse } from 'next/server';
import { getFirebaseAdminAuth } from '@/lib/firebase-admin';
import { getUser, registerPhoneUser } from '@/lib/db/operations';
import { generateToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_CLIENT_EMAIL || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_API_KEY || !process.env.FIREBASE_AUTH_DOMAIN || !process.env.FIREBASE_APP_ID || !process.env.FIREBASE_MESSAGING_SENDER_ID) {
    return NextResponse.json({ success: false, code: 'FIREBASE_NOT_CONFIGURED', error: 'Phone verification is not configured yet. Please contact support.' }, { status: 503 });
  }
  try {
    const { idToken, username } = await request.json();
    if (typeof idToken !== 'string' || idToken.length < 100) {
      return NextResponse.json({ success: false, error: 'A valid Firebase sign-in is required' }, { status: 401 });
    }

    const decoded = await getFirebaseAdminAuth().verifyIdToken(idToken, true);
    const phone = decoded.phone_number;
    const uid = decoded.uid;
    if (!phone || !uid) return NextResponse.json({ success: false, error: 'Verified phone number is missing from Firebase account' }, { status: 401 });

    const existing = await getUser(phone);
    if (existing?.firebaseUid && existing.firebaseUid !== uid) {
      return NextResponse.json({ success: false, error: 'This phone account is linked to a different verified identity. Contact support.' }, { status: 409 });
    }

    const user = await registerPhoneUser(phone, uid, typeof username === 'string' ? username.trim().slice(0, 32) : null);
    if (!user) return NextResponse.json({ success: false, error: 'Unable to create account' }, { status: 500 });

    const token = generateToken({ userId: user.id, phone: user.phone, username: user.username || undefined });
    return NextResponse.json({
      success: true,
      token,
      user: { id: user.id, phone: user.phone, username: user.username, demoBalance: Number(user.demoBalance), realBalance: Number(user.realBalance) }
    });
  } catch {
    return NextResponse.json({ success: false, error: 'The verification code could not be verified. Request a new code and try again.' }, { status: 401 });
  }
}
