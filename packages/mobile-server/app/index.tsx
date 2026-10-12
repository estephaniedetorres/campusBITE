// CampusBITE landing — full-bleed stall carousel (Mobbin / Subway home pattern).
// One slide per stall from /api/stalls; every stall has its own QR (kiosk?stall=<id>).
import { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Image, Modal, ScrollView, Pressable, useWindowDimensions } from 'react-native';
import { useRouter, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SvgXml } from 'react-native-svg';
import QRCode from 'qrcode';
import { Star, Clock, ArrowRight, QrCode, Store, X, Wifi } from 'lucide-react-native';
import { apiGet } from '../constants/api';
import { C } from '../constants/theme';
import { stallHeroImage as heroImage } from '../lib/stallImages';
import { CustomerNav } from '../src/components/CustomerNav';

type Stall = {
  id: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  rating?: number | null;
  rating_count?: number | null;
};

const GREEN = C.green;
const SLIDE_MS = 6000;

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function initials(name?: string | null): string {
  if (!name) return 'CB';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');
}

// Same QR renderer as kiosk.tsx / admin.tsx (qrcode → SVG string → SvgXml)
function QrSvg({ value, size }: { value: string; size: number }) {
  const [xml, setXml] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    const opts: any = { type: 'svg', margin: 1, width: size, errorCorrectionLevel: 'M' };
    const done = (svg?: string | null) => { if (mounted) setXml(svg || null); };
    const p: any = (QRCode as any).toString(value, opts);
    if (p && typeof p.then === 'function') p.then(done).catch(() => done(null));
    else (QRCode as any).toString(value, opts, (err: any, svg: string) => done(err ? null : svg));
    return () => { mounted = false; };
  }, [value, size]);
  if (!xml) return <View style={{ width: size, height: size, backgroundColor: '#F5F5F4', borderRadius: 12 }} />;
  return <SvgXml xml={xml} width={size} height={size} />;
}

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isWide = width >= 768;

  const [stalls, setStalls] = useState<Stall[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [user, setUser] = useState<any>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState<null | 'stalls' | 'scan'>(null);
  const [qrStall, setQrStall] = useState<Stall | null>(null);
  const touchX = useRef<number | null>(null);
  const params = useLocalSearchParams<{ sheet?: string }>();

  useEffect(() => {
    apiGet('/api/stalls').then(setStalls).catch(() => {});
    apiGet('/api/health').then(setHealth).catch(() => {});
  }, []);

  // Deep-link from other screens' nav: /?sheet=stalls | /?sheet=scan
  useEffect(() => {
    if (params.sheet === 'stalls' || params.sheet === 'scan') {
      setSheet(params.sheet);
      router.setParams({ sheet: undefined } as any);
    }
  }, [params.sheet]);

  // Refresh login state whenever the page is shown
  useFocusEffect(useCallback(() => {
    AsyncStorage.getItem('campusbite_user').then(raw => setUser(raw ? JSON.parse(raw) : null)).catch(() => {});
  }, []));

  // Auto-advance unless touching or a sheet/modal is open
  useEffect(() => {
    if (stalls.length < 2 || paused || sheet || qrStall) return;
    const t = setTimeout(() => setIndex(i => (i + 1) % stalls.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, stalls.length, paused, sheet, qrStall]);

  // Same origin logic as kiosk.tsx so QRs match
  const origin = (() => {
    try { if (typeof window !== 'undefined' && (window as any).location?.origin) return (window as any).location.origin; } catch {}
    if (health?.ip) return `http://${health.ip}:${health.port || 8081}`;
    return 'http://localhost:8081';
  })();
  const stallUrl = (id: string) => `${origin}/kiosk?stall=${id}`;
  const openStall = (id: string) => { setSheet(null); setQrStall(null); router.push(`/kiosk?stall=${id}` as any); };

  const current = stalls[index];
  const go = (dir: 1 | -1) => setIndex(i => (i + dir + stalls.length) % stalls.length);

  return (
    <View
      style={styles.root}
      onTouchStart={e => { touchX.current = e.nativeEvent.pageX; setPaused(true); }}
      onTouchEnd={e => {
        const start = touchX.current;
        touchX.current = null;
        setPaused(false);
        if (start == null || stalls.length < 2) return;
        const dx = e.nativeEvent.pageX - start;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      {/* Slides */}
      {stalls.map((s, i) => (
        <Image key={s.id} source={{ uri: heroImage(s) }} resizeMode="cover"
          style={[StyleSheet.absoluteFillObject, { opacity: i === index ? 1 : 0 }]} />
      ))}
      {/* Scrims for readability (and the offline fallback look) */}
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.30)' }]} />
      <View style={styles.scrimTop} />
      <View style={styles.scrimBottom} />

      {/* Top bar */}
      <View style={[styles.top, { paddingTop: insets.top + 20 }, isWide && styles.wide]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.greeting}>
            {user?.display_name ? `${greeting()}, ${user.display_name.split(' ')[0]}!` : 'Welcome to CampusBITE!'}
          </Text>
          <TouchableOpacity onPress={() => setSheet('stalls')} style={styles.chip}>
            <View style={styles.chipDot}><Store size={11} color="#fff" /></View>
            <Text style={styles.chipText}>{stalls.length} stall{stalls.length === 1 ? '' : 's'} open</Text>
            <ArrowRight size={16} color="#fff" />
          </TouchableOpacity>
        </View>
        <TouchableOpacity onPress={() => router.push((user ? '/pos' : '/login') as any)} style={styles.avatar}
          accessibilityLabel={user ? 'Open staff tools' : 'Stall owner log in'}>
          {user ? <Text style={styles.avatarText}>{initials(user.display_name)}</Text>
            : <Image source={require('../assets/CampusBITE_Logo.png')} style={{ width: 34, height: 34 }} resizeMode="contain" />}
        </TouchableOpacity>
      </View>

      {/* Slide copy */}
      <View style={[styles.copy, { bottom: 120 + insets.bottom }, isWide && styles.wide]}>
        {current ? (
          <>
            <Text style={styles.eyebrow}>Stall {index + 1} of {stalls.length} · Scan the QR at the counter</Text>
            <Text style={[styles.headline, isWide && { fontSize: 60, lineHeight: 62 }]}>{current.name}</Text>
            <Text style={styles.desc}>{current.description || 'Canteen favourite'}</Text>
            <View style={styles.metaRow}>
              <Star size={14} color="#F59E0B" fill="#F59E0B" />
              <Text style={styles.meta}>{current.rating != null ? Number(current.rating).toFixed(1) : '—'} ({current.rating_count ?? 0})</Text>
              <Text style={styles.metaDot}>·</Text>
              <Clock size={14} color="rgba(255,255,255,0.85)" />
              <Text style={styles.meta}>10–15 min</Text>
            </View>
            <View style={styles.ctaRow}>
              <TouchableOpacity onPress={() => openStall(current.id)} style={styles.cta}>
                <Text style={styles.ctaText}>Start Order</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setQrStall(current)} style={styles.ghost}>
                <QrCode size={16} color="#fff" />
                <Text style={styles.ghostText}>Stall QR</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <Text style={styles.desc}>Loading stalls…</Text>
        )}

        <View style={styles.dotsRow}>
          <View style={styles.dots}>
            {stalls.map((s, i) => (
              <Pressable key={s.id} onPress={() => setIndex(i)} accessibilityLabel={s.name} hitSlop={10}
                style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
          {current && (
            <TouchableOpacity onPress={() => setQrStall(current)} style={styles.fab} accessibilityLabel={`Show ${current.name} QR`}>
              <QrCode size={22} color="#fff" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Floating pill nav (shared with My Orders) */}
      <CustomerNav onHome={() => setIndex(0)} onStalls={() => setSheet('stalls')} onScan={() => setSheet('scan')} />

      {/* Bottom sheet: stalls list / all stall QRs */}
      <Modal visible={!!sheet} transparent animationType="slide" onRequestClose={() => setSheet(null)}>
        <Pressable style={styles.backdrop} onPress={() => setSheet(null)}>
          <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + 24 }]} onPress={() => {}}>
            <View style={styles.grabber} />
            <View style={styles.sheetHead}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>{sheet === 'scan' ? 'Scan a stall QR' : 'Campus stalls'}</Text>
                <Text style={styles.sheetSub}>
                  {sheet === 'scan'
                    ? 'Each stall has its own QR. Point your phone camera at it to open that stall’s menu.'
                    : 'Pick a stall to start your order.'}
                </Text>
              </View>
              <TouchableOpacity onPress={() => setSheet(null)} style={styles.close} accessibilityLabel="Close"><X size={16} color="#1C1917" /></TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 460 }} contentContainerStyle={{ gap: 10 }}>
              {sheet === 'scan' ? (
                <View style={styles.qrGrid}>
                  {stalls.map(s => (
                    <TouchableOpacity key={s.id} onPress={() => setQrStall(s)} style={styles.qrTile}>
                      <QrSvg value={stallUrl(s.id)} size={112} />
                      <Text style={styles.qrTileName} numberOfLines={1}>{s.name}</Text>
                      <Text style={styles.qrTileHint}>Tap to enlarge</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                stalls.map((s, i) => (
                  <View key={s.id} style={styles.row}>
                    <Image source={{ uri: heroImage(s) }} style={styles.rowImg} />
                    <TouchableOpacity style={{ flex: 1 }} onPress={() => { setIndex(i); setSheet(null); }}>
                      <Text style={styles.rowName} numberOfLines={1}>{s.name}</Text>
                      <Text style={styles.rowDesc} numberOfLines={1}>{s.description}</Text>
                      <View style={styles.metaRow}>
                        <Star size={11} color="#F59E0B" fill="#F59E0B" />
                        <Text style={styles.rowDesc}>{s.rating != null ? Number(s.rating).toFixed(1) : '—'}</Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setQrStall(s)} style={styles.close} accessibilityLabel={`${s.name} QR`}><QrCode size={16} color="#1C1917" /></TouchableOpacity>
                    <TouchableOpacity onPress={() => openStall(s.id)} style={styles.rowBtn}><Text style={styles.rowBtnText}>Order</Text></TouchableOpacity>
                  </View>
                ))
              )}
            </ScrollView>

            <View style={styles.sheetFoot}>
              <View style={styles.metaRow}><Wifi size={12} color="#78716C" /><Text style={styles.rowDesc}>{origin.replace(/^https?:\/\//, '')}</Text></View>
              <TouchableOpacity onPress={() => { setSheet(null); router.push('/login' as any); }}>
                <Text style={styles.footLink}>Stall owner log in</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Single stall QR */}
      <Modal visible={!!qrStall} transparent animationType="fade" onRequestClose={() => setQrStall(null)}>
        <Pressable style={[styles.backdrop, { justifyContent: 'center', padding: 16 }]} onPress={() => setQrStall(null)}>
          {qrStall && (
            <Pressable style={styles.qrCard} onPress={() => {}}>
              <View style={styles.sheetHead}>
                <Text style={[styles.sheetTitle, { flex: 1 }]}>{qrStall.name}</Text>
                <TouchableOpacity onPress={() => setQrStall(null)} style={styles.close} accessibilityLabel="Close"><X size={16} color="#1C1917" /></TouchableOpacity>
              </View>
              <View style={styles.qrBox}><QrSvg value={stallUrl(qrStall.id)} size={208} /></View>
              <Text style={styles.qrUrl} selectable>{stallUrl(qrStall.id)}</Text>
              <Text style={styles.qrHint}>Scan with any phone on the CampusBITE hotspot</Text>
              <TouchableOpacity onPress={() => openStall(qrStall.id)} style={styles.qrBtn}>
                <Text style={styles.rowBtnText}>Order here instead</Text>
              </TouchableOpacity>
            </Pressable>
          )}
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1C1917', overflow: 'hidden' },
  wide: { maxWidth: 760, width: '100%', alignSelf: 'center' },
  scrimTop: { position: 'absolute', top: 0, left: 0, right: 0, height: 200, backgroundColor: 'rgba(0,0,0,0.25)' },
  scrimBottom: { position: 'absolute', bottom: 0, left: 0, right: 0, height: '55%', backgroundColor: 'rgba(0,0,0,0.35)' },

  top: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, gap: 16 },
  greeting: { color: '#fff', fontSize: 24, fontWeight: '600', letterSpacing: -0.3 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10, alignSelf: 'flex-start' },
  chipDot: { width: 20, height: 20, borderRadius: 10, backgroundColor: GREEN, alignItems: 'center', justifyContent: 'center' },
  chipText: { color: '#fff', fontSize: 14, fontWeight: '500' },
  avatar: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#ECEBDD', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: GREEN, fontSize: 18, fontWeight: '800' },

  copy: { position: 'absolute', left: 0, right: 0, paddingHorizontal: 20 },
  eyebrow: { color: 'rgba(255,255,255,0.88)', fontSize: 14, fontWeight: '500' },
  headline: { color: '#fff', fontSize: 42, lineHeight: 44, fontWeight: '700', letterSpacing: -1, marginTop: 10 },
  desc: { color: 'rgba(255,255,255,0.92)', fontSize: 16, lineHeight: 22, marginTop: 10, maxWidth: 520 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  meta: { color: 'rgba(255,255,255,0.88)', fontSize: 13 },
  metaDot: { color: 'rgba(255,255,255,0.5)', marginHorizontal: 4 },
  ctaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 22 },
  cta: { borderWidth: 2, borderColor: 'rgba(255,255,255,0.92)', borderRadius: 999, paddingHorizontal: 28, paddingVertical: 12 },
  ctaText: { color: '#fff', fontSize: 17, fontWeight: '700' },
  ghost: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 13, backgroundColor: 'rgba(255,255,255,0.15)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' },
  ghostText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  dotsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 22 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.5)' },
  dotActive: { width: 32, backgroundColor: '#fff' },
  fab: { width: 56, height: 56, borderRadius: 28, backgroundColor: GREEN, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.3, shadowRadius: 10, shadowOffset: { width: 0, height: 4 } },

  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end', alignItems: 'center' },
  sheet: { width: '100%', maxWidth: 560, backgroundColor: '#fff', borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 20 },
  grabber: { width: 40, height: 6, borderRadius: 3, backgroundColor: '#E7E5E4', alignSelf: 'center', marginBottom: 14 },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 14 },
  sheetTitle: { fontSize: 20, fontWeight: '700', color: '#1C1917' },
  sheetSub: { fontSize: 13, color: '#78716C', marginTop: 4, lineHeight: 18 },
  close: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F4', alignItems: 'center', justifyContent: 'center' },
  qrGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'space-between' },
  qrTile: { width: '48%', borderWidth: 1, borderColor: '#E7E5E4', borderRadius: 18, padding: 12, alignItems: 'center' },
  qrTileName: { marginTop: 8, fontSize: 14, fontWeight: '700', color: '#1C1917' },
  qrTileHint: { fontSize: 11, color: '#78716C' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 8, borderRadius: 18, borderWidth: 1, borderColor: '#E7E5E4' },
  rowImg: { width: 56, height: 56, borderRadius: 12, backgroundColor: '#F5F5F4' },
  rowName: { fontSize: 15, fontWeight: '700', color: '#1C1917' },
  rowDesc: { fontSize: 12, color: '#78716C' },
  rowBtn: { backgroundColor: GREEN, borderRadius: 999, paddingHorizontal: 16, paddingVertical: 9 },
  rowBtnText: { color: '#fff', fontSize: 14, fontWeight: '700', textAlign: 'center' },
  sheetFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16, paddingTop: 14, borderTopWidth: 1, borderTopColor: '#F5F5F4' },
  footLink: { fontSize: 12, fontWeight: '600', color: '#44403C', textDecorationLine: 'underline' },

  qrCard: { width: '100%', maxWidth: 380, backgroundColor: '#fff', borderRadius: 28, padding: 22, alignItems: 'stretch' },
  qrBox: { alignSelf: 'center', padding: 14, borderRadius: 18, borderWidth: 1, borderColor: '#E7E5E4', backgroundColor: '#fff' },
  qrUrl: { marginTop: 14, fontSize: 11, fontFamily: 'monospace', color: '#44403C', backgroundColor: '#FAFAF9', borderWidth: 1, borderColor: '#E7E5E4', borderRadius: 12, padding: 8, textAlign: 'center' },
  qrHint: { fontSize: 12, color: '#78716C', textAlign: 'center', marginTop: 8 },
  qrBtn: { marginTop: 16, backgroundColor: GREEN, borderRadius: 999, paddingVertical: 13 },
});
