// CampusBITE embedded Node — runs inside Expo Dev Build via nodejs-mobile-react-native
// This file is the entry for the Node side. It starts Express + SQLite + WS on 0.0.0.0:3000
// and reports ready via rn-bridge. Phone hotspot IP (192.168.43.1) is then reachable by clients.

const path = require('path');
const fs = require('fs');

// nodejs-mobile puts project files at /data/.../nodejs-project, and server-core bundle at ./server
// We copy server-core/dist into this folder at build time (scripts/bundle-mobile-node.js)

// Try to load rn-bridge for RN ↔ Node messaging
let rnBridge;
try { rnBridge = require('rn-bridge'); } catch (e) { console.log('[Node] rn-bridge not available (running standalone)'); }

function sendToRN(type, payload) {
  try { if (rnBridge) rnBridge.channel.send(JSON.stringify({ type, payload })); } catch {}
  console.log(`[Node->RN] ${type}`, payload || '');
}

if (rnBridge) {
  rnBridge.channel.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.type === 'PING') sendToRN('PONG', { ts: Date.now() });
    } catch {}
  });
}

// Set DB path to app's private files dir (writable on Android)
// nodejs-mobile's cwd is the project dir; use ./data
process.env.DB_PATH = path.join(__dirname, 'data', 'campusbite.db');
process.env.PORT = '3000';
process.env.HOST = '0.0.0.0';

console.log('[Node] Starting CampusBITE server on', process.env.HOST + ':' + process.env.PORT);
console.log('[Node] DB:', process.env.DB_PATH);
console.log('[Node] Node', process.versions.node);

// Ensure data dir exists
try { fs.mkdirSync(path.join(__dirname, 'data'), { recursive: true }); } catch {}

// Start server — require the bundled server (copied via scripts/bundle-mobile-node.js)
// The bundled server does: import './db/database.js' → creates DB + schema, then starts Express + WS
try {
  require('./server/server.js');
  console.log('[Node] Server required, should be listening');
  sendToRN('SERVER_READY', { port: 3000, db: process.env.DB_PATH });
} catch (e) {
  console.error('[Node] Failed to start server:', e && e.stack || e);
  sendToRN('SERVER_ERROR', { error: String(e && e.message || e) });
}
