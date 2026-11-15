import { NextResponse } from 'next/server';

export async function POST() {
  return NextResponse.json({
    success: false,
    code: 'PHONE_VERIFICATION_UNAVAILABLE',
    error: 'Password recovery is unavailable until phone verification is configured.'
  }, { status: 503 });
}
