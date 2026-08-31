/**
 * ServerStatus.tsx — placeholder UI component for React Native host app.
 * In a real RN build, this would display:
 * - Hotspot IP and QR code (other devices scan to connect)
 * - Foreground Service status + connected client count (via WSGateway stats)
 * - Toggle: Start/Stop server, WakeLock indicator
 *
 * This file is intentionally plain TSX to keep the monorepo installable without RN native deps.
 */
import React, { useEffect, useState } from 'react';

// Mock hook - in real app you'd use react-native-network-info + fetch('http://localhost:3000/api/health')
export function ServerStatus() {
  const [health, setHealth] = useState<any>(null);
  useEffect(() => {
    fetch('http://localhost:3000/api/health').then(r=>r.json()).then(setHealth).catch(()=>setHealth({ error: 'Server not running on this phone. Start via Termux or Foreground Service.' }));
  }, []);
  return {
    // In RN you'd return <View>... with QRCode SVG, etc.
    health,
    instructions: 'On Android phone: turn on Hotspot, run `node server.js`, share IP shown above, others open http://<ip>:3000 in browser.',
  };
}
export default ServerStatus;
