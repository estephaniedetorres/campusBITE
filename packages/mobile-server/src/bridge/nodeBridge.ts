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

// Placeholder no-op for web/dev environment
export function startNodeServer() {
  console.log('[Bridge] Mock startNodeServer — in real Android build this spawns Node.js Mobile');
}
export function stopNodeServer() {
  console.log('[Bridge] Mock stopNodeServer');
}
