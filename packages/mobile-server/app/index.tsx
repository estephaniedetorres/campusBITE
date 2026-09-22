import { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, Linking, Alert } from 'react-native';
import { getApiBase, apiGet } from '../constants/api';

export default function Home() {
  const [health, setHealth] = useState<any>(null);
  const [stalls, setStalls] = useState<any[]>([]);
  const apiBase = getApiBase();

  async function load() {
    try {
      const h = await apiGet('/api/health');
      setHealth(h);
      const s = await apiGet('/api/stalls');
      setStalls(s);
    } catch {}
  }
  useEffect(() => { load(); }, []);

  const matees = stalls.find((s: any) => s.name === 'Matees');
  const potato = stalls.find((s: any) => s.name === 'Potato Corner');
  const mateesRating = matees?.rating != null ? Number(matees.rating).toFixed(1) : '4.8';
  const potatoRating = potato?.rating != null ? Number(potato.rating).toFixed(1) : '4.9';

  function open(path: string) {
    Linking.openURL(`${getApiBase()}${path}`).catch(() => Alert.alert('Cannot open', `${getApiBase()}${path}`));
  }

  return (
    <View style={styles.safe}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        {/* Hero — The Fork promo */}
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>CampusBITE · Offline Canteen</Text>
          <Text style={styles.heroTitle}>Canteen favorites,{"\n"}<Text style={styles.heroAccent}>ready when you are.</Text></Text>
          <Text style={styles.heroDesc}>Ice cream from Matees. Famous fries from Potato Corner. Scan, order, pick up — on the canteen hotspot.</Text>
          <View style={styles.heroRow}>
            <TouchableOpacity onPress={() => open('/kiosk')} style={styles.btnDark}><Text style={styles.btnDarkText}>Order now</Text></TouchableOpacity>
            <Text style={styles.heroMeta}>Hotspot · 10-15 min · {health?.ip || '192.168.43.1'}:3000</Text>
          </View>
          <View style={styles.heroRatings}>
            <Text style={styles.ratingPill}>★ {mateesRating} Matees</Text>
            <Text style={styles.ratingDivider}>·</Text>
            <Text style={styles.ratingPill}>🔥 {potatoRating} Potato Corner</Text>
          </View>
          <View style={styles.heroCards}>
            <View style={styles.miniCard}>
              <Text style={styles.miniTitle}>Matees</Text>
              <Text style={styles.miniDesc}>Ice Cream · {mateesRating} ★</Text>
            </View>
            <View style={styles.miniCard}>
              <Text style={styles.miniTitle}>Potato Corner</Text>
              <Text style={styles.miniDesc}>Fries · {potatoRating} ★</Text>
            </View>
          </View>
          <Text style={styles.small}>Hotspot: {apiBase} · Kiosk is public — no account needed</Text>
        </View>

        {/* Featured — Matees & Potato Corner (display only) */}
        <View style={styles.grid}>
          <View style={styles.featureCard}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=600&auto=format&fit=crop&q=60' }} style={styles.featureImage} />
            <View style={styles.featureOverlay} />
            <View style={styles.featureBottom}>
              <View>
                <Text style={styles.featureName}>Matees</Text>
                <Text style={styles.featureSub}>Ice Cream · Sundaes</Text>
              </View>
              <View style={styles.badge}><Text style={styles.badgeText}>{mateesRating} ★</Text></View>
            </View>
          </View>
          <View style={styles.featureCard}>
            <Image source={{ uri: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=60' }} style={styles.featureImage} />
            <View style={styles.featureOverlay} />
            <View style={styles.featureBottom}>
              <View>
                <Text style={styles.featureName}>Potato Corner</Text>
                <Text style={styles.featureSub}>World Famous Flavored Fries</Text>
              </View>
              <View style={styles.badge}><Text style={styles.badgeText}>{potatoRating} ★</Text></View>
            </View>
          </View>
        </View>
        <View style={styles.gridCaptions}>
          <Text style={styles.caption}>Vanilla · Choco · Strawberry Sundae</Text>
          <Text style={styles.caption}>Plain · Cheese · Loaded Chili</Text>
        </View>

        {/* For Stall Owners — login only here */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>For Stall Owners</Text>
          <Text style={styles.cardDesc}>Manage your menu, prices and stock. Log in to access POS, Kitchen and Inventory for your stall.</Text>
          <Text style={styles.mono}>matees/matees123 · potato/potato123 · admin/admin123</Text>
          <TouchableOpacity onPress={() => open('/login')} style={styles.btnDarkFull}><Text style={styles.btnDarkText}>Stall Owner Log in</Text></TouchableOpacity>
        </View>

        {/* Quick open */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Open</Text>
          <View style={styles.tiles}>
            <TouchableOpacity onPress={() => open('/kiosk')} style={[styles.tile, styles.tileDark]}><Text style={styles.tileTitleLight}>Kiosk</Text><Text style={styles.tileDescLight}>Customer order</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => open('/pos')} style={styles.tile}><Text style={styles.tileTitle}>POS</Text><Text style={styles.tileDesc}>Cashier</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => open('/kds')} style={styles.tile}><Text style={styles.tileTitle}>Kitchen</Text><Text style={styles.tileDesc}>KDS</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => open('/admin')} style={styles.tile}><Text style={styles.tileTitle}>Admin</Text><Text style={styles.tileDesc}>Menu + Stock</Text></TouchableOpacity>
          </View>
        </View>

        <Text style={styles.footer}>CampusBITE · Expo Go · npx expo start --host lan</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#FAFAF9' },
  container: { padding: 16, gap: 16, paddingBottom: 40 },
  hero: { backgroundColor: '#fff', borderRadius: 28, padding: 20, borderWidth: 1, borderColor: '#E7E5E4' },
  eyebrow: { fontSize: 11, fontWeight: '700', letterSpacing: 1.5, color: '#0F4C4A', textTransform: 'uppercase', backgroundColor: '#E6F2F0', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, overflow: 'hidden' },
  heroTitle: { fontSize: 28, fontWeight: '800', color: '#1C1917', marginTop: 12, lineHeight: 30 },
  heroAccent: { color: '#0F4C4A' },
  heroDesc: { fontSize: 14, color: '#57534E', marginTop: 8, lineHeight: 20 },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 16, flexWrap: 'wrap' },
  btnDark: { backgroundColor: '#1C1917', paddingHorizontal: 18, paddingVertical: 12, borderRadius: 999, alignItems: 'center' },
  btnDarkText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnDarkFull: { backgroundColor: '#1C1917', paddingVertical: 12, borderRadius: 999, alignItems: 'center', marginTop: 12 },
  heroMeta: { fontSize: 11, color: '#78716C' },
  heroRatings: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'center' },
  ratingPill: { fontSize: 12, fontWeight: '600', color: '#1C1917' },
  ratingDivider: { color: '#D6D3D1' },
  heroCards: { flexDirection: 'row', gap: 10, marginTop: 16 },
  miniCard: { flex: 1, backgroundColor: '#F5F5F4', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: '#E7E5E4' },
  miniTitle: { fontSize: 12, fontWeight: '700', color: '#1C1917' },
  miniDesc: { fontSize: 11, color: '#78716C', marginTop: 2 },
  small: { fontSize: 11, color: '#78716C', marginTop: 6 },
  grid: { flexDirection: 'row', gap: 12 },
  featureCard: { flex: 1, height: 140, borderRadius: 20, overflow: 'hidden', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E7E5E4' },
  featureImage: { ...StyleSheet.absoluteFillObject },
  featureOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.25)' },
  featureBottom: { position: 'absolute', bottom: 12, left: 12, right: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  featureName: { color: '#fff', fontWeight: '800', fontSize: 13 },
  featureSub: { color: 'rgba(255,255,255,0.8)', fontSize: 11, marginTop: 2 },
  badge: { backgroundColor: '#fff', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  badgeText: { fontSize: 11, fontWeight: '800', color: '#1C1917' },
  gridCaptions: { flexDirection: 'row', gap: 12, marginTop: -8 },
  caption: { flex: 1, fontSize: 12, color: '#57534E', textAlign: 'center' },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#E7E5E4' },
  cardTitle: { fontWeight: '800', fontSize: 14, color: '#1C1917' },
  cardDesc: { fontSize: 12, color: '#78716C', marginTop: 4 },
  mono: { fontFamily: 'monospace', fontSize: 10, color: '#78716C', marginTop: 6 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  tile: { flexBasis: '48%', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E7E5E4', borderRadius: 16, padding: 14 },
  tileDark: { backgroundColor: '#1C1917', borderColor: '#1C1917' },
  tileTitle: { fontWeight: '800', color: '#1C1917' },
  tileTitleLight: { fontWeight: '800', color: '#fff' },
  tileDesc: { fontSize: 11, color: '#78716C', marginTop: 2 },
  tileDescLight: { fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
  footer: { textAlign: 'center', fontSize: 11, color: '#A8A29E', marginTop: 8 },
});
