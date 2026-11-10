import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  if (!await getAdminSession(request)) return NextResponse.json({ success: false, error: 'Admin authentication required' }, { status: 401 });
  const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: 'REALTIME_PRESENCE_' }, updatedAt: { gte: BigInt(Date.now() - 15000) } }, select: { value: true } });
  return NextResponse.json({ success: true, connections: rows.reduce((sum, row) => sum + (typeof row.value === 'number' ? row.value : 0), 0) }, { headers: { 'Cache-Control': 'no-store' } });
}
