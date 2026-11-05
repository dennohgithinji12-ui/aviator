import { NextRequest, NextResponse } from 'next/server';
import { updatePassword } from '@/lib/db/operations';

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const phone = data.phone;
    const passwordHash = data.passwordHash;

    if (!phone || !passwordHash) {
      return NextResponse.json({
        success: false,
        error: 'Phone and passwordHash are required'
      }, { status: 400 });
    }

    const updated = await updatePassword(phone, passwordHash);
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
