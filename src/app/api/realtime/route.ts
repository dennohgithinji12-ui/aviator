import { upgradeWebSocket } from '@vercel/functions';
import { register } from '@/lib/realtime/hub';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export function GET() {
  return upgradeWebSocket((socket) => { register(socket); });
}
