import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin-auth';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const defaults = { home: true, sports: true, casino: true, aviator: true, me: true, communityChat: false, roomTwo: false };

function normalize(value: unknown) {
  const saved = value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  return Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, typeof saved[key] === 'boolean' ? saved[key] : fallback]));
}

export async function GET(request: NextRequest) {
  if (!await getAdminSession(request)) return NextResponse.json({ success: false, error: 'Admin authentication required' }, { status: 401 });
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'PRIMARY_NAV_MODULES' }, select: { value: true } });
    return NextResponse.json({ success: true, modules: normalize(setting?.value) });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to load module settings' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const admin = await getAdminSession(request);
  if (!admin || !['SUPER_ADMIN', 'ADMIN'].includes(admin.role)) return NextResponse.json({ success: false, error: 'Administrator permission required' }, { status: 403 });
  try {
    const body = await request.json();
    if (!body.modules || typeof body.modules !== 'object' || Object.keys(defaults).some((key) => typeof body.modules[key] !== 'boolean')) {
      return NextResponse.json({ success: false, error: 'Provide an enabled or disabled value for each module' }, { status: 400 });
    }
    const modules = normalize(body.modules);
    const now = BigInt(Date.now());
    await prisma.appSetting.upsert({
      where: { key: 'PRIMARY_NAV_MODULES' },
      update: { value: modules, description: 'Primary navigation modules visible to players', updatedAt: now },
      create: { key: 'PRIMARY_NAV_MODULES', value: modules, description: 'Primary navigation modules visible to players', updatedAt: now }
    });
    return NextResponse.json({ success: true, modules });
  } catch {
    return NextResponse.json({ success: false, error: 'Unable to save module settings' }, { status: 500 });
  }
}
