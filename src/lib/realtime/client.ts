type Event = { type: 'round'; state: unknown } | { type: 'bets'; data: unknown } | { type: 'bets-changed' } | { type: 'history-changed' } | { type: 'presence'; count: number };
const listeners = new Set<(event: Event) => void>();
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
    try { const event = JSON.parse(message.data) as Event; for (const listener of listeners) listener(event); } catch { /* Ignore malformed frames. */ }
  };
  socket.onclose = () => {
    socket = null; online = false;
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
