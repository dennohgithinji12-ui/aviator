import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    success: false,
    code: 'FIREBASE_VERIFICATION_REQUIRED',
    error: 'Verify your phone with Firebase before creating an account.'
  }, { status: 410 });
}
