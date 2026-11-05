import { NextRequest, NextResponse } from 'next/server';
import { getDeposit, completeDeposit } from '@/lib/db/operations';

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    console.log('[PayHero Webhook Received]:', payload);
    const ref = payload.external_reference || payload.response?.ExternalReference;
    const receipt = payload.response?.MpesaReceiptNumber || `QPH${Date.now().toString(36).toUpperCase()}`;

    if (ref) {
      const existingDep = await getDeposit(ref);
      if (existingDep && existingDep.status === 'SUCCESS') {
        console.log(`[PayHero Idempotency] Reference ${ref} already processed. Returning HTTP 200.`);
        return NextResponse.json({ status: 'OK', note: 'Idempotent skip' });
      }

      // Note: In-memory transaction tracking would be here if needed
      // For serverless, we rely on database state

      await completeDeposit(ref, receipt);
    }

    return NextResponse.json({ status: 'OK' });
  } catch (e) {
    return NextResponse.json({
      status: 'ERROR',
      error: e instanceof Error ? e.message : 'Unknown error'
    });
  }
}
