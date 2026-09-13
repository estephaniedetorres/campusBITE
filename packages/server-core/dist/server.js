import express from 'express';
import cors from 'cors';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import os from 'node:os';
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
function getIps() {
    const nets = os.networkInterfaces();
    const ips = [];
    for (const addrs of Object.values(nets)) {
        for (const a of addrs || [])
            if (a.family === 'IPv4' && !a.internal)
                ips.push(a.address);
    }
    return ips;
}
// Simple health — returns actual reachable IP (no forced fallback, no debug)
app.get('/api/health', (req, res) => {
    const ips = getIps();
    const ip = ips[0] || '192.168.43.1';
    res.json({
        ok: true,
        service: 'CampusBITE server-core',
        ip,
        ips,
        port: PORT,
        kioskUrl: `http://${ip}:${PORT}/kiosk?stall=stall-001`,
        timestamp: new Date().toISOString(),
    });
});
app.get('/api/debug/ping', (req, res) => {
    res.json({ ok: true, localAddr: req.socket.localAddress, remoteAddr: req.ip, headers: req.headers, time: new Date().toISOString() });
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
let staticDir = null;
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
        if (req.path.startsWith('/api') || req.path.startsWith('/ws'))
            return next();
        res.sendFile(path.join(staticDir, 'index.html'));
    });
}
else {
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
    const ips = getIps();
    const ip = ips[0] || '192.168.43.1';
    console.log(`CampusBITE running at http://${ip}:${PORT}`);
    console.log(`Kiosk: http://${ip}:${PORT}/kiosk`);
    console.log(`Health: http://${ip}:${PORT}/api/health`);
    if (!staticDir)
        console.log('Tip: Run npm run build --workspace=web-client to enable SPA');
});
httpServer.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
        console.error(`[Error] Port ${PORT} already in use → pkill node; pkill -f http.server; node packages/server-core/dist/server.js`);
        process.exit(1);
    }
    console.error('[Error] Server', err);
});
//# sourceMappingURL=server.js.map