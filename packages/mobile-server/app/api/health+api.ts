// Simple health endpoint — explicit file ensures /api/health works even if catch-all fails on Windows
export async function GET(request: Request) {
  return new Response(JSON.stringify({
    ok: true,
    service: 'CampusBITE Expo API (health+api)',
    ip: '127.0.0.1',
    ips: ['127.0.0.1'],
    port: 8081,
    kioskUrl: '/kiosk?stall=stall-001',
    timestamp: new Date().toISOString(),
    hint: 'If you see this, Expo API is working. If not, restart: npx expo start --web --host lan --clear',
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}
