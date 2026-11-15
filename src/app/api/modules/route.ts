import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

const defaults = { home: true, sports: true, casino: true, aviator: true, me: true, communityChat: false, roomTwo: false };

export async function GET() {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'PRIMARY_NAV_MODULES' }, select: { value: true } });
    const saved = setting?.value && typeof setting.value === 'object' && !Array.isArray(setting.value) ? setting.value as Record<string, unknown> : {};
    const modules = Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, typeof saved[key] === 'boolean' ? saved[key] : fallback]));
    return NextResponse.json({ success: true, modules }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ success: true, modules: defaults }, { headers: { 'Cache-Control': 'no-store' } });
  }
}
