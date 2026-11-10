import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { GET as getRoundState } from '@/app/api/round-state/route';
import { GET as getLiveBets } from '@/app/api/live-bets/route';

type Socket = { send(data: string): void; on(event: 'close' | 'error', listener: () => void): void; on(event: 'message', listener: (data: Buffer) => void): void };
const id = randomUUID();
const sockets = new Set<Socket>();
let timer: ReturnType<typeof setInterval> | null = null;
let busy = false;
let lastRound = '';
let lastBets = '';
let lastRealBets = '';
let lastPresence = 0;
let latestRound: unknown = null;
let latestBets: unknown = null;

function send(socket: Socket, event: unknown) { try { socket.send(JSON.stringify(event)); } catch { sockets.delete(socket); } }
function broadcast(event: unknown) { for (const socket of sockets) send(socket, event); }

async function tick() {
  if (busy || !sockets.size) return;
  busy = true;
  try {
    const roundResponse = await getRoundState();
    if (!roundResponse.ok) return;
    const state = await roundResponse.json();
    latestRound = state;
    const roundKey = `${state.nonce}:${state.phase}`;
    if (roundKey !== lastRound) {
      lastRound = roundKey;
      broadcast({ type: 'round', state });
      if (state.phase === 'CRASHED') broadcast({ type: 'history-changed' });
      lastBets = '';
    }
    const response = await getLiveBets(new NextRequest(`https://localhost/api/live-bets?roundNonce=${state.nonce}`));
    if (response.ok) {
      const bets = await response.json();
      latestBets = bets;
      const realKey = JSON.stringify(bets.bets);
      if (realKey !== lastRealBets) { lastRealBets = realKey; broadcast({ type: 'bets-changed' }); }
      const key = JSON.stringify([bets.bets, bets.simulatedBets]);
      if (key !== lastBets) {
        lastBets = key;
        broadcast({ type: 'bets', data: bets });
      }
    }
    if (Date.now() - lastPresence > 5000) {
      lastPresence = Date.now();
      const updatedAt = BigInt(lastPresence);
      await prisma.appSetting.upsert({ where: { key: `REALTIME_PRESENCE_${id}` }, update: { value: sockets.size, updatedAt }, create: { key: `REALTIME_PRESENCE_${id}`, value: sockets.size, updatedAt } });
      await prisma.appSetting.deleteMany({ where: { key: { startsWith: 'REALTIME_PRESENCE_' }, updatedAt: { lt: BigInt(lastPresence - 60000) } } });
      const rows = await prisma.appSetting.findMany({ where: { key: { startsWith: 'REALTIME_PRESENCE_' }, updatedAt: { gte: BigInt(lastPresence - 15000) } }, select: { value: true } });
      broadcast({ type: 'presence', count: rows.reduce((sum, row) => sum + (typeof row.value === 'number' ? row.value : 0), 0) });
    }
  } catch (error) { console.error('[realtime]', error instanceof Error ? error.message : error); }
  finally { busy = false; }
}

export function register(socket: Socket) {
  sockets.add(socket);
  const close = () => {
    sockets.delete(socket);
    if (!sockets.size && timer) { clearInterval(timer); timer = null; void prisma.appSetting.deleteMany({ where: { key: `REALTIME_PRESENCE_${id}` } }).catch(() => undefined); }
  };
  socket.on('close', close);
  socket.on('error', close);
  socket.on('message', (data) => {
    if (data.length > 256) return;
    try {
      if (JSON.parse(data.toString()).type === 'sync') {
        if (latestRound) send(socket, { type: 'round', state: latestRound });
        if (latestBets) send(socket, { type: 'bets', data: latestBets });
      }
    } catch { /* Ignore invalid messages. */ }
  });
  if (!timer) timer = setInterval(() => void tick(), 1500);
  void tick();
}
