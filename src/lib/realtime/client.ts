type Event = { type: 'round'; state: unknown } | { type: 'bets'; data: unknown } | { type: 'bets-changed' } | { type: 'history-changed' } | { type: 'presence'; count: number } | { type: 'reply'; id: string; status: number; data: Record<string, unknown> };
const listeners = new Set<(event: Event) => void>();
const pending = new Map<string, { resolve: (value: { status: number; data: Record<string, unknown> }) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> }>();
let socket: WebSocket | null = null;
let retry: ReturnType<typeof setTimeout> | null = null;
let delay = 1000;
let online = false;

function connect() {
  if (typeof window === 'undefined' || !listeners.size || socket || retry) return;
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  socket = new WebSocket(`${protocol}//${location.host}/api/realtime`);
  socket.onopen = () => { online = true; delay = 1000; socket?.send(JSON.stringify({ type: 'sync' })); };
  socket.onmessage = (message) => {
    try {
      const event = JSON.parse(message.data) as Event;
      if (event.type === 'reply') {
        const request = pending.get(event.id);
        if (request) { clearTimeout(request.timer); pending.delete(event.id); request.resolve({ status: event.status, data: event.data }); }
      } else for (const listener of listeners) listener(event);
    } catch { /* Ignore malformed frames. */ }
  };
  socket.onclose = () => {
    socket = null; online = false;
    for (const [id, request] of pending) { clearTimeout(request.timer); request.reject(new Error('Realtime connection closed')); pending.delete(id); }
    if (listeners.size) { retry = setTimeout(() => { retry = null; connect(); }, delay); delay = Math.min(delay * 2, 15000); }
  };
  socket.onerror = () => socket?.close();
}

export function subscribeRealtime(listener: (event: Event) => void) {
  listeners.add(listener); connect();
  return () => {
    listeners.delete(listener);
    if (!listeners.size) { if (retry) clearTimeout(retry); retry = null; socket?.close(); socket = null; online = false; }
  };
}

export function realtimeConnected() { return online; }

export function sendRealtimeCommand(action: 'bet' | 'cancel' | 'cashout', token: string, body: Record<string, unknown>) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return null;
  const id = crypto.randomUUID();
  return new Promise<{ status: number; data: Record<string, unknown> }>((resolve, reject) => {
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('Realtime response timed out')); }, 10000);
    pending.set(id, { resolve, reject, timer });
    try { socket!.send(JSON.stringify({ type: 'command', id, action, token, body })); }
    catch (error) { clearTimeout(timer); pending.delete(id); reject(error instanceof Error ? error : new Error('Unable to send realtime command')); }
  });
}
