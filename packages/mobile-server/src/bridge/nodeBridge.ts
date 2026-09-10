/**
 * nodeBridge.ts — How React Native talks to the embedded Node engine
 *
 * In a full RN build with `nodejs-mobile-react-native`, the bridge looks like:
 *
 * import nodejs from 'nodejs-mobile-react-native';
 *
 * export function startNodeServer() {
 *   nodejs.start('main.js'); // main.js = compiled server-core/dist/server.js + assets
 *   nodejs.channel.addListener('message', (msg) => {
 *     if (msg === 'server:ready') console.log('Node side ready');
 *     if (msg.event === 'client:connected') updateUI(msg.count);
 *   });
 * }
 *
 * // Node side (server-core) would do:
 * // import rnBridge from 'rn-bridge';
 * // rnBridge.channel.send({ event: 'server:ready', ip: getHotspotIp() });
 *
 * Why this matters for learning:
 * - RN and Node run in separate JS engines but share a message channel.
 * - RN manages Android lifecycle (foreground service, WakeLock, notifications).
 * - Node handles HTTP/WS/SQLite. If Node crashes, RN restarts it (START_STICKY).
 */

// Real bridge for Expo Dev Build (no Termux) — embedded Node via nodejs-mobile-react-native
// Expo Go cannot run this (requires native module), so it falls back to mock + fetch to hotspot IP.

let _started = false;
export function startNodeServer() {
  if (_started) return;
  try {
    // @ts-ignore — only available in Dev Build, not Expo Go
    const nodejs = require('nodejs-mobile-react-native');
    const rnBridge = require('rn-bridge');
    console.log('[Bridge] Starting embedded Node...');
    nodejs.start('main.js');
    nodejs.channel.addListener('message', (msg: string) => {
      try {
        const data = JSON.parse(msg);
        console.log('[Bridge] Node → RN', data);
        if (data.type === 'SERVER_READY') console.log('[Bridge] Node server ready on', data.payload);
        if (data.type === 'SERVER_ERROR') console.error('[Bridge] Node error', data.payload);
      } catch { console.log('[Bridge] raw', msg); }
    });
    // Optionally start Android Foreground Service via native module
    try {
      const { NativeModules } = require('react-native');
      if (NativeModules.ServerForegroundService) {
        NativeModules.ServerForegroundService.startService();
        console.log('[Bridge] Foreground service started');
      }
    } catch {}
    _started = true;
  } catch (e: any) {
    console.log('[Bridge] nodejs-mobile not available (Expo Go) — use Termux or Dev Build. Falling back to hotspot fetch. Reason:', e.message?.slice(0, 80));
  }
}
export function stopNodeServer() {
  try {
    const nodejs = require('nodejs-mobile-react-native');
    // nodejs-mobile has no stop, but we can send signal via bridge
    console.log('[Bridge] stop requested');
  } catch {}
  _started = false;
}
export function isEmbedded() {
  try { require('nodejs-mobile-react-native'); return true; } catch { return false; }
}
