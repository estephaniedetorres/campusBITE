import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import os from 'node:os';
import { execSync } from 'node:child_process';

import './db/database.js'; // ensure DB initialized
import { menuRouter } from './routes/menuRoutes.js';
import { createOrderRouter } from './routes/orderRoutes.js';
import { inventoryRouter } from './routes/inventoryRoutes.js';
import { auditRouter } from './routes/auditRoutes.js';
import { authRouter } from './routes/authRoutes.js';
import { WSGateway } from './ws/gateway.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';

const app = express();
app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging middleware (teaching)
app.use((req, _res, next) => {
  console.log(`[HTTP] ${req.method} ${req.path}`);
  next();
});

function getHotspotIp(): { ips: string[], all: Record<string,string[]>, hotspotIp: string, hotspotCandidates: string[], rawRoute?: string, getprop?: string } {
  const nets = os.networkInterfaces();
  const ips: string[] = [];
  const all: Record<string,string[]> = {};
  for (const [name, addrs] of Object.entries(nets)) {
    all[name] = [];
    for (const a of addrs || []) if (a.family === 'IPv4') {
      all[name].push(`${a.address}${a.internal ? ' (internal)' : ''}`);
      if (!a.internal) ips.push(a.address);
    }
  }
  // Termux: os.networkInterfaces() may miss hotspot due to netlink permission → try alternatives
  let hotspotCandidates: string[] = [...ips];
  let rawRoute = '';
  let getpropOut = '';
  // Try /proc/net/route for 192.168.43.x gateway
  try {
    rawRoute = fs.readFileSync('/proc/net/route','utf-8').slice(0,2000);
    // route gateway is little-endian hex, 0101A8C0 = 192.168.1.1, 012B2BA8 = 192.168.43.1? Actually 01 = 1, 2B=43, etc.
    // Simpler: just check if file contains C0A802... We just return raw for debug, hotspotIp stays fallback.
    if (rawRoute.includes('C0A8') && !hotspotCandidates.some(ip=>ip.startsWith('192.168.43.'))) {
      hotspotCandidates.push('192.168.43.1 (from /proc/net/route)');
    }
  } catch {}
  try {
    getpropOut = execSync('getprop 2>/dev/null | grep -i "192.168.43" | head -5', { encoding:'utf-8', timeout:500 }).trim();
    if (getpropOut && !hotspotCandidates.some(ip=>ip.includes('192.168.43.'))) {
      hotspotCandidates.push('192.168.43.1 (from getprop)');
    }
  } catch {}
  // Always ensure fallback
  if (!hotspotCandidates.some(ip=>ip.startsWith('192.168.43.'))) hotspotCandidates.push('192.168.43.1 (fallback — Android hotspot default)');
  // Also add common Samsung alternatives
  if (!hotspotCandidates.includes('192.168.12.1')) hotspotCandidates.push('192.168.12.1 (alt Samsung)');
  if (!hotspotCandidates.includes('192.168.208.1')) hotspotCandidates.push('192.168.208.1 (alt)');
  const hotspotIp = ips.find(ip => ip.startsWith('192.168.43.')) || ips.find(ip => ip.startsWith('192.168.')) || '192.168.43.1';
  return { ips, all, hotspotIp, hotspotCandidates, rawRoute: rawRoute.slice(0,800), getprop: getpropOut.slice(0,800) };
}

// Health endpoint — includes all interfaces and hotspot hint for Termux
app.get('/api/health', (req, res) => {
  const { ips, all, hotspotIp, hotspotCandidates, rawRoute, getprop } = getHotspotIp();
  res.json({
    ok: true,
    service: 'CampusBITE server-core',
    uptime: process.uptime(),
    ips,
    allInterfaces: all,
    hotspotIp,
    hotspotCandidates,
    hotspotUrl: `http://${hotspotIp}:${PORT}/kiosk?stall=stall-001`,
    port: PORT,
    ws: `ws://${hotspotIp}:${PORT}/ws`,
    debug: { rawRoute: (rawRoute||'').slice(0,400), getprop: (getprop||'').slice(0,400) },
    hint: '100.101.218.190 is mobile carrier CGNAT (not hotspot). If hotspot ON, use 192.168.43.1 even if not in ips — server listens on 0.0.0.0. Termux cannot bind netlink → hotspotIp fallback',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/debug/ips', (req, res) => {
  const { ips, all, hotspotIp, hotspotCandidates, rawRoute, getprop } = getHotspotIp();
  // Also try termux-wifi-connectioninfo if available
  let wifiInfo = '';
  try { wifiInfo = execSync('termux-wifi-connectioninfo 2>/dev/null | head -20', { encoding:'utf-8', timeout:800 }).trim(); } catch {}
  res.json({ ips, all, hotspotIp, hotspotCandidates, rawRoute: (rawRoute||'').slice(0,1000), getprop: (getprop||'').slice(0,1000), wifiInfo: wifiInfo.slice(0,1000) });
});

// API routes (auth first so /auth/login is public)
app.use('/api', authRouter);
app.use('/api', menuRouter);

// WS gateway needs HTTP server, so create server first then inject gateway
const httpServer = createServer(app);
const wsGateway = new WSGateway(httpServer);

app.use('/api', createOrderRouter(wsGateway));
app.use('/api', inventoryRouter);
app.use('/api', auditRouter);

// Also expose WS stats
app.get('/api/ws-stats', (req, res) => res.json(wsGateway.getStats()));

// Serve bundled SPA static files if present
// Priority: 1) packages/web-client/dist  2) ../web-client/dist  3) ../../web/dist  4) public folder
const candidateStaticDirs = [
  path.join(__dirname, '../../web-client/dist'),
  path.join(__dirname, '../../../web-client/dist'),
  path.join(process.cwd(), 'packages/web-client/dist'),
  path.join(process.cwd(), '../web-client/dist'),
  path.join(__dirname, '../public'),
];

let staticDir: string | null = null;
for (const dir of candidateStaticDirs) {
  if (fs.existsSync(dir) && fs.existsSync(path.join(dir, 'index.html'))) {
    staticDir = dir;
    break;
  }
}

if (staticDir) {
  console.log(`[Static] Serving SPA from ${staticDir}`);
  app.use(express.static(staticDir));
  // SPA fallback: all non-API, non-WS GETs return index.html
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api') || req.path.startsWith('/ws')) return next();
    res.sendFile(path.join(staticDir!, 'index.html'));
  });
} else {
  console.log('[Static] No SPA bundle found. API-only mode. Build web-client to enable UI.');
  app.get('/', (req, res) => {
    res.json({
      message: 'CampusBITE API running. Build web-client for UI.',
      endpoints: {
        health: '/api/health',
        stalls: '/api/stalls',
        menu: '/api/menu?stallId=stall-001',
        orders: '/api/orders',
        inventory: '/api/inventory',
        ws: '/ws',
      },
      docs: 'See README for usage',
    });
  });
}

// 404 for API
app.use('/api', (req, res) => res.status(404).json({ error: `API route ${req.method} ${req.path} not found` }));

httpServer.listen(PORT, HOST, () => {
  const { ips, all, hotspotIp, hotspotCandidates } = getHotspotIp();
  const allFlat: string[] = [];
  for (const [name, addrs] of Object.entries(all)) for (const a of addrs) allFlat.push(`${name}:${a}`);
  console.log(`
╔════════════════════════════════════════════════════╗
║  CampusBITE Server running                        ║
║  Local:   http://localhost:${PORT}                  ║
${ips.map(ip => `║  Network: http://${ip}:${PORT} `.padEnd(53) + '║').join('\n')}
║  Hotspot (try even if not listed): http://${hotspotIp}:${PORT}      ║
║  Hotspot candidates: ${hotspotCandidates.slice(0,3).join(', ')} ║
║  WS:      ws://${hotspotIp}:${PORT}/ws                      ║
║  Health:  http://localhost:${PORT}/api/health       ║
║  Debug:   http://localhost:${PORT}/api/debug/ips    ║
║  All ifaces: ${allFlat.join(', ')} ║
╚════════════════════════════════════════════════════╝
  `);
  console.log(`[Hint] 100.101.218.190 is mobile CGNAT (not hotspot). Termux 'cannot bind netlink' → hotspot IP is still 192.168.43.1, try http://${hotspotIp}:${PORT}/kiosk even if not in list`);
  console.log(`[QR] Customers scan: http://${hotspotIp}:${PORT}/kiosk?stall=stall-001`);
  if (!staticDir) console.log('Tip: Run \`npm run build --workspace=web-client\` to enable the SPA UI.');
});
