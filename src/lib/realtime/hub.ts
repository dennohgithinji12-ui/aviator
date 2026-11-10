import { randomUUID } from 'node:crypto';
import { NextRequest } from 'next/server';
import { prisma } from '@/lib/db';
import { GET as getRoundState } from '@/app/api/round-state/route';
import { getLiveRoundStateNow } from '@/app/api/round-state/route';
import { GET as getLiveBets } from '@/app/api/live-bets/route';
import { placeBetAt } from '@/app/api/wallet/bet/route';
import { POST as cancelBet } from '@/app/api/wallet/cancel/route';
import { POST as cashoutBet } from '@/app/api/wallet/cashout/route';

type Socket = { send(data: string): void; on(event: 'close' | 'error', listener: () => void): void; on(event: 'message', listener: (data: Buffer) => void): void };
const id = randomUUID();
const sockets = new Set<Socket>();
let timer: ReturnType<typeof setInterval> | null = null;
let busy = false;
let refreshRequested = false;
let lastRound = '';
let lastRoundBroadcastAt = 0;
let lastBets = '';
let lastRealBets = '';
let lastPresence = 0;
let latestBets: unknown = null;

function send(socket: Socket, event: unknown) { try { socket.send(JSON.stringify(event)); } catch { sockets.delete(socket); } }
function broadcast(event: unknown) { for (const socket of sockets) send(socket, event); }

async function tick() {
  if (busy || !sockets.size) return;
  busy = true;
  try {
    const roundResponse = await getRoundState();
    if (!roundResponse.ok) return;
    const state = await getLiveRoundStateNow();
    const roundKey = `${state.nonce}:${state.phase}`;
    const phaseChanged = roundKey !== lastRound;
    const roundChanged = lastRound !== '' && !lastRound.startsWith(`${state.nonce}:`);
    if (phaseChanged || Date.now() - lastRoundBroadcastAt >= 3000) {
      lastRound = roundKey;
      lastRoundBroadcastAt = Date.now();
      broadcast({ type: 'round', state });
      if (phaseChanged) {
        if (state.phase === 'CRASHED' || roundChanged) broadcast({ type: 'history-changed' });
        lastBets = '';
      }
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
  finally {
    busy = false;
    if (refreshRequested) { refreshRequested = false; queueMicrotask(() => void tick()); }
  }
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
    const receivedAt = Date.now();
    if (data.length > 4096) return;
    try {
      const message = JSON.parse(data.toString());
      if (message.type === 'sync') {
        void (async () => {
          const startedAt = Date.now();
          try {
            const state = await getLiveRoundStateNow();
            send(socket, { type: 'round', state, sync: true, processingMs: Date.now() - startedAt });
            if (latestBets && (latestBets as { roundNonce?: number }).roundNonce === state.nonce) send(socket, { type: 'bets', data: latestBets });
          } catch { /* The regular hub tick will retry. */ }
        })();
      }
      if (message.type === 'command' && typeof message.id === 'string' && message.id.length <= 64 && typeof message.token === 'string' && message.token.length < 2048 && message.body && typeof message.body === 'object') {
        const handler = message.action === 'bet' ? (request: NextRequest) => placeBetAt(request, receivedAt) : message.action === 'cancel' ? cancelBet : message.action === 'cashout' ? cashoutBet : null;
        if (!handler) return;
        void (async () => {
          try {
            const request = new NextRequest(`https://localhost/api/wallet/${message.action}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${message.token}` }, body: JSON.stringify(message.body) });
            const response = await handler(request);
            send(socket, { type: 'reply', id: message.id, status: response.status, data: await response.json() });
            if (response.ok) { lastBets = ''; lastRealBets = ''; if (busy) refreshRequested = true; else void tick(); }
          } catch { send(socket, { type: 'reply', id: message.id, status: 500, data: { success: false, message: 'Unable to process realtime action' } }); }
        })();
      }
    } catch { /* Ignore invalid messages. */ }
  });
  if (!timer) timer = setInterval(() => void tick(), 1500);
  void tick();
}
