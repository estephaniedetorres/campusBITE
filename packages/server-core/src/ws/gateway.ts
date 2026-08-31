import { WebSocketServer, WebSocket } from 'ws';
import type { Server } from 'node:http';

// Simple room-based broadcast. Clients join rooms: 'kds', 'pos', 'kiosk:<orderId>', 'admin'
// Every message is JSON: { type, payload }

type ClientInfo = { ws: WebSocket; rooms: Set<string>; id: string };

export class WSGateway {
  private wss: WebSocketServer;
  private clients = new Set<ClientInfo>();
  private orderRooms = new Map<string, Set<ClientInfo>>(); // orderId -> clients

  constructor(server: Server) {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.wss.on('connection', (ws) => this.handleConnection(ws));
    console.log('[WS] Gateway listening on /ws');
  }

  private handleConnection(ws: WebSocket) {
    const client: ClientInfo = { ws, rooms: new Set(), id: Math.random().toString(36).slice(2, 7) };
    this.clients.add(client);
    console.log(`[WS] Client connected ${client.id} (total ${this.clients.size})`);

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString());
        // Expected: { type: 'JOIN', room: 'kds' } or { type: 'JOIN_ORDER', orderId: '...' }
        if (msg.type === 'JOIN' && msg.room) {
          client.rooms.add(msg.room);
          console.log(`[WS] ${client.id} joined room ${msg.room}`);
        }
        if (msg.type === 'JOIN_ORDER' && msg.orderId) {
          const room = `order:${msg.orderId}`;
          client.rooms.add(room);
          if (!this.orderRooms.has(msg.orderId)) this.orderRooms.set(msg.orderId, new Set());
          this.orderRooms.get(msg.orderId)!.add(client);
        }
        if (msg.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
        }
      } catch (e) {
        console.error('[WS] Parse error', e);
      }
    });

    ws.on('close', () => {
      this.clients.delete(client);
      // cleanup orderRooms
      for (const set of this.orderRooms.values()) set.delete(client);
      console.log(`[WS] Client ${client.id} disconnected (${this.clients.size} left)`);
    });

    ws.on('error', (err) => console.error(`[WS] Error ${client.id}`, err.message));

    // Welcome
    ws.send(JSON.stringify({ type: 'WELCOME', clientId: client.id, message: 'Connected to CampusBITE WS' }));
  }

  broadcastToRoom(room: string, type: string, payload: any) {
    const msg = JSON.stringify({ type, payload, timestamp: Date.now() });
    let sent = 0;
    for (const c of this.clients) {
      if (c.rooms.has(room) && c.ws.readyState === WebSocket.OPEN) {
        c.ws.send(msg);
        sent++;
      }
    }
    // also log if no one listening (useful for debugging)
    if (sent === 0) console.log(`[WS] Broadcast ${type} to room ${room}: no listeners`);
    else console.log(`[WS] Broadcast ${type} to ${sent} clients in ${room}`);
  }

  broadcastToAll(type: string, payload: any) {
    const msg = JSON.stringify({ type, payload, timestamp: Date.now() });
    for (const c of this.clients) {
      if (c.ws.readyState === WebSocket.OPEN) c.ws.send(msg);
    }
  }

  notifyOrderStatus(orderId: string, order: any) {
    // Notify: 1) specific order trackers 2) kds + pos rooms 3) all
    this.broadcastToRoom(`order:${orderId}`, 'ORDER_STATUS_UPDATED', order);
    this.broadcastToRoom('kds', 'ORDER_STATUS_UPDATED', order);
    this.broadcastToRoom('pos', 'ORDER_STATUS_UPDATED', order);
    this.broadcastToRoom('admin', 'ORDER_STATUS_UPDATED', order);
  }

  notifyNewOrder(order: any) {
    this.broadcastToRoom('kds', 'ORDER_CREATED', order);
    this.broadcastToRoom('pos', 'ORDER_CREATED', order);
    this.broadcastToRoom('admin', 'ORDER_CREATED', order);
    this.broadcastToAll('ORDER_CREATED', order); // also for demo
  }

  getStats() {
    return { totalClients: this.clients.size, rooms: Array.from(new Set([...this.clients].flatMap(c => [...c.rooms]))) };
  }
}
