import Link from 'next/link';
import { AppPageFrame } from '@/components/layout/AppPageFrame';
import { AviatorConsole } from '@/components/game/AviatorConsole';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export default async function RoomTwoPage() {
  let enabled = false;
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: 'PRIMARY_NAV_MODULES' }, select: { value: true } });
    const value = setting?.value;
    enabled = Boolean(value && typeof value === 'object' && !Array.isArray(value) && (value as Record<string, unknown>).roomTwo === true);
  } catch { /* Keep Room 2 closed if its setting cannot be verified. */ }

  return <AppPageFrame>
    <div className="room-two-heading"><div><span className="feature-eyebrow">GAME ROOM</span><h1>Room 2</h1><p>{enabled ? 'This view shares the live Aviator round and your existing bets with the main room.' : 'Room 2 is currently unavailable.'}</p></div><Link href="/">Main room</Link></div>
    {enabled && <AviatorConsole />}
  </AppPageFrame>;
}
