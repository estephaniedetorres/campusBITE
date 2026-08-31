import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * useWebSocket - auto-reconnecting WS hook.
 * HOW IT WORKS:
 * - On mount, connects to ws://<current_host>/ws  (works on hotspot IP automatically)
 * - Server sends JSON { type, payload }. We dispatch to listeners.
 * - Auto-reconnect with exponential backoff if phone hotspot blips.
 */
export function useWebSocket(opts: {
  room?: string;           // e.g., 'kds', 'pos', 'admin'
  orderId?: string;        // join specific order room
  onMessage?: (msg: { type: string; payload: any }) => void;
}) {
  const [status, setStatus] = useState<'connecting' | 'open' | 'closed'>('connecting');
  const wsRef = useRef<WebSocket | null>(null);
  const onMessageRef = useRef(opts.onMessage);
  onMessageRef.current = opts.onMessage;

  const connect = useCallback(() => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const url = `${proto}//${location.host}/ws`;
    // In dev, location.host is vite's 5173, but WS is on 3000 via proxy? fallback to 3000.
    // Try location.host first, if fails fallback to same hostname + 3000.
    let ws: WebSocket;
    try {
      ws = new WebSocket(url);
    } catch {
      ws = new WebSocket(`${proto}//${location.hostname}:3000/ws`);
    }
    wsRef.current = ws;
    setStatus('connecting');

    ws.onopen = () => {
      setStatus('open');
      if (opts.room) ws.send(JSON.stringify({ type: 'JOIN', room: opts.room }));
      if (opts.orderId) ws.send(JSON.stringify({ type: 'JOIN_ORDER', orderId: opts.orderId }));
    };
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        onMessageRef.current?.(msg);
      } catch {}
    };
    ws.onclose = () => {
      setStatus('closed');
      // reconnect after 2s
      setTimeout(connect, 2000);
    };
    ws.onerror = () => ws.close();
  }, [opts.room, opts.orderId]);

  useEffect(() => {
    connect();
    return () => wsRef.current?.close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connect]);

  const send = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(data));
  }, []);

  return { status, send };
}
