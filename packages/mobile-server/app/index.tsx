import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Linking, Alert, Platform } from 'react-native';
import * as LinkingExpo from 'expo-linking';
import { getApiBase, setApiBase, apiGet, setToken } from '../constants/api';

// Simple QR using qrcode + SVG rendering via API-generated image (offline fallback: just show URL)
// For Expo Go we use a tiny data-URL via qrcode lib (pure JS). We render as text or via Image from api.qrserver.com? Offline we use text fallback.
// To keep deps minimal, we use qrcode to generate data URL and show via Text, but for real QR we use react-native-svg if available.
// Here we use a simple approach: show URL and use external QR image if online, else show URL for manual entry.
import * as QRCode from 'qrcode';
import { startNodeServer, isEmbedded } from '../src/bridge/nodeBridge';

export default function Home() {
  const [apiBase, setApiBaseState] = useState(getApiBase());
  const [inputUrl, setInputUrl] = useState(getApiBase());
  const [health, setHealth] = useState<any>(null);
  const [stalls, setStalls] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  async function load() {
    setError('');
    try {
      const h = await apiGet('/api/health');
      setHealth(h);
      const s = await apiGet('/api/stalls');
      setStalls(s);
      // Generate QR for first stall
      const ip = h.ips?.[0] || '192.168.43.1';
      const url = `http://${ip}:${h.port}/kiosk?stall=${s[0]?.id || 'stall-001'}`;
      try {
        const dataUrl = await QRCode.toDataURL(url, { width: 160, margin: 1 });
        setQrDataUrl(dataUrl);
      } catch {}
    } catch (e: any) {
      setError(e.message);
      setHealth(null);
    }
  }

  useEffect(() => { load(); }, [apiBase]);
  useEffect(() => { setApiBase(apiBase); }, [apiBase]);
  useEffect(() => {
    // Phone-as-server without Termux: Dev Build embeds Node at 127.0.0.1:3000
    if (isEmbedded()) {
      setApiBase('http://127.0.0.1:3000');
      setApiBaseState('http://127.0.0.1:3000');
      setInputUrl('http://127.0.0.1:3000');
      startNodeServer();
    }
  }, []);

  function applyUrl() {
    const cleaned = inputUrl.replace(/\/$/, '');
    setApiBase(cleaned);
    setApiBaseState(cleaned);
  }

  function open(path: string) {
    const url = `${getApiBase()}${path}`;
    Linking.openURL(url).catch(() => Alert.alert('Cannot open', url));
  }

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.hero}>
          <Text style={styles.heroTitle}>CampusBITE</Text>
          <Text style={styles.heroSub}>Phone as Server • Offline-first • Hotspot:Port 3000</Text>
          <Text style={styles.heroNote}>{isEmbedded() ? 'Dev Build: Node embedded at 127.0.0.1:3000 + Hotspot 192.168.43.1:3000 (no Termux)' : 'Expo Go is UI only. Node server runs via Termux on same phone (or Dev Build). See below.'}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Server URL (tap to edit)</Text>
          <Text style={styles.cardDesc}>Hotspot phone server is usually http://192.168.43.1:3000 — PC dev is http://192.168.1.104:3000</Text>
          <View style={styles.row}>
            <TextInput value={inputUrl} onChangeText={setInputUrl} autoCapitalize="none" autoCorrect={false} style={styles.input} placeholder="http://192.168.43.1:3000" />
            <TouchableOpacity onPress={applyUrl} style={styles.btnDark}><Text style={styles.btnDarkText}>Save</Text></TouchableOpacity>
          </View>
          <View style={styles.row}>
            <TouchableOpacity onPress={() => { setInputUrl('http://127.0.0.1:3000'); setApiBase('http://127.0.0.1:3000'); setApiBaseState('http://127.0.0.1:3000'); }} style={styles.chip}><Text style={styles.chipText}>Embedded</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setInputUrl('http://192.168.43.1:3000'); setApiBase('http://192.168.43.1:3000'); setApiBaseState('http://192.168.43.1:3000'); }} style={styles.chip}><Text style={styles.chipText}>Hotspot</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => { setInputUrl('http://192.168.1.104:3000'); setApiBase('http://192.168.1.104:3000'); setApiBaseState('http://192.168.1.104:3000'); }} style={styles.chip}><Text style={styles.chipText}>Dev PC</Text></TouchableOpacity>
            <TouchableOpacity onPress={load} style={styles.chip}><Text style={styles.chipText}>Refresh Health</Text></TouchableOpacity>
          </View>
          <Text style={styles.mono}>Current: {apiBase}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Server Health</Text>
          {error ? (
            <View style={styles.errorBox}><Text style={styles.errorText}>{error}</Text><Text style={styles.small}>Is server running? In Termux: bash scripts/phone-server.sh → keep open + Hotspot ON</Text></View>
          ) : health ? (
            <>
              <Text style={styles.ok}>● Online — {health.service} • up {Math.floor(health.uptime)}s</Text>
              <Text style={styles.mono}>IPs: {health.ips?.join(', ') || '—'}:{health.port}</Text>
              <Text style={styles.mono}>WS: {health.ws}</Text>
              <Text style={styles.mono}>Kiosk (only public): {getApiBase()}/kiosk?stall=stall-001</Text>
              <Text style={styles.small}>POS/KDS/Admin require login: admin/admin123, grill/grill123, brew/brew123</Text>
            </>
          ) : (
            <Text style={styles.small}>Loading…</Text>
          )}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Stall QR — Customers scan to order</Text>
          <Text style={styles.small}>QR encodes http://&lt;hotspot-ip&gt;:3000/kiosk?stall=STALL_ID — Kiosk is only public page.</Text>
          {stalls.map((s: any) => {
            const ip = health?.ips?.[0] || apiBase.replace('http://','').split(':')[0];
            const url = `http://${ip}:${health?.port || 3000}/kiosk?stall=${s.id}`;
            return (
              <View key={s.id} style={styles.qrRow}>
                <View style={styles.qrBox}>
                  <Text style={styles.qrUrl}>{url}</Text>
                  <Text style={styles.small}>Scan with phone camera → opens Kiosk filtered to {s.name}</Text>
                </View>
                <TouchableOpacity onPress={() => open(`/kiosk?stall=${s.id}`)} style={styles.btnOrange}><Text style={styles.btnOrangeText}>Open</Text></TouchableOpacity>
              </View>
            );
          })}
          {!stalls.length && <Text style={styles.small}>No stalls — run seed: npx tsx packages/server-core/src/db/seed.ts</Text>}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>Quick Open (staff login required for POS/KDS/Admin)</Text>
          <View style={styles.grid}>
            <TouchableOpacity onPress={() => open('/kiosk')} style={[styles.tile, styles.tileOrange]}><Text style={styles.tileTitle}>Kiosk</Text><Text style={styles.tileDesc}>Public • Customer order</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => open('/pos')} style={styles.tile}><Text style={styles.tileTitle}>POS</Text><Text style={styles.tileDesc}>Staff • Cashier</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => open('/kds')} style={styles.tile}><Text style={styles.tileTitle}>Kitchen</Text><Text style={styles.tileDesc}>Staff • KDS</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => open('/admin')} style={styles.tile}><Text style={styles.tileTitle}>Admin</Text><Text style={styles.tileDesc}>Menu + Inventory</Text></TouchableOpacity>
          </View>
          <Text style={styles.small}>If POS says 401 Unauthorized → open /login first (admin/admin123).</Text>
        </View>

        <View style={styles.cardDark}>
          <Text style={styles.cardTitleDark}>Phone as Server — without Termux (Dev Build) vs with Termux</Text>
          <Text style={styles.monoDark}>Expo Go + Termux (now): bash scripts/phone-server.sh → 192.168.43.1:3000</Text>
          <Text style={styles.monoDark}>Dev Build (no Termux, DB inside APK):</Text>
          <Text style={styles.monoDark}>  1. npx expo prebuild</Text>
          <Text style={styles.monoDark}>  2. node scripts/bundle-mobile-node.js</Text>
          <Text style={styles.monoDark}>  3. npx expo run:android  # needs Android Studio + JDK 17</Text>
          <Text style={styles.monoDark}>  → App starts Node at 127.0.0.1:3000 + Hotspot 192.168.43.1:3000, no Termux, DB has database</Text>
          <Text style={styles.smallDark}>Expo Go cannot embed Node — needs Dev Build. Termux is easiest for now.</Text>
        </View>

        <Text style={styles.footer}>CampusBITE • Expo Go • Kiosk only public • Hybrid ADMIN/STALL_OWNER</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#fafafa' },
  container: { padding: 16, gap: 12, paddingBottom: 40 },
  hero: { backgroundColor: '#f97316', borderRadius: 24, padding: 20 },
  heroTitle: { color: '#fff', fontSize: 28, fontWeight: '900' },
  heroSub: { color: '#fff', opacity: 0.9, marginTop: 4 },
  heroNote: { color: '#fff', opacity: 0.85, fontSize: 12, marginTop: 8 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#e4e4e7' },
  cardDark: { backgroundColor: '#111827', borderRadius: 20, padding: 16 },
  cardTitle: { fontWeight: '800', fontSize: 14 },
  cardTitleDark: { fontWeight: '800', color: '#fff' },
  cardDesc: { fontSize: 12, color: '#71717a', marginTop: 4 },
  row: { flexDirection: 'row', gap: 8, marginTop: 10, alignItems: 'center' },
  input: { flex: 1, borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, padding: 12, backgroundColor: '#fff' },
  btnDark: { backgroundColor: '#111', paddingHorizontal: 16, paddingVertical: 12, borderRadius: 12 },
  btnDarkText: { color: '#fff', fontWeight: '700' },
  btnOrange: { backgroundColor: '#f97316', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12 },
  btnOrangeText: { color: '#fff', fontWeight: '800' },
  chip: { backgroundColor: '#f4f4f5', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  chipText: { fontSize: 12, fontWeight: '600' },
  mono: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), fontSize: 11, color: '#71717a', marginTop: 6 },
  monoDark: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), fontSize: 11, color: '#d4d4d8', marginTop: 4 },
  ok: { color: '#16a34a', fontWeight: '700', marginTop: 6 },
  errorBox: { backgroundColor: '#fef2f2', borderColor: '#fecaca', borderWidth: 1, borderRadius: 12, padding: 10, marginTop: 8 },
  errorText: { color: '#dc2626', fontSize: 12 },
  small: { fontSize: 11, color: '#71717a', marginTop: 6 },
  smallDark: { fontSize: 11, color: '#a1a1aa', marginTop: 6 },
  qrRow: { flexDirection: 'row', gap: 10, marginTop: 10, alignItems: 'center', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 12, padding: 10 },
  qrBox: { flex: 1 },
  qrUrl: { fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }), fontSize: 10, color: '#18181b' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  tile: { flexBasis: '48%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e4e7', borderRadius: 16, padding: 14 },
  tileOrange: { backgroundColor: '#fff7ed', borderColor: '#fed7aa' },
  tileTitle: { fontWeight: '800' },
  tileDesc: { fontSize: 11, color: '#71717a', marginTop: 2 },
  footer: { textAlign: 'center', fontSize: 11, color: '#a1a1aa', marginTop: 8 },
});
