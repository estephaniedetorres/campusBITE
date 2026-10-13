// My Orders — per-device tracker. Reads saved order IDs from AsyncStorage and
// polls public GET /api/orders/:id on the Expo server (:8081).
import { useCallback, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { ReceiptText, Clock, CheckCircle2, XCircle, Trash2, Store } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { apiGet } from '../constants/api';
import { C, R, shadow } from '../constants/theme';
import { CustomerNav, CUSTOMER_NAV_SPACE } from '../src/components/CustomerNav';
import { getMyOrders, updateMyOrders, removeMyOrder, clearFinishedOrders, DONE_STATUSES, SavedOrder } from '../lib/myOrders';

const GREEN = '#0F4C4A';
const POLL_MS = 5000;
const STEPS = ['PENDING_PAYMENT', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'];
const LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pay at the counter',
  CONFIRMED: 'Paid · in queue',
  PREPARING: 'Preparing',
  READY: 'Ready for pickup',
  COMPLETED: 'Picked up',
  CANCELLED: 'Cancelled',
};

type Row = SavedOrder & { items?: any[]; missing?: boolean };

export default function MyOrders() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [orders, setOrders] = useState<Row[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    const saved = await getMyOrders();
    const results = await Promise.all(saved.map(async (o): Promise<Row> => {
      try {
        const res: any = await apiGet(`/api/orders/${o.id}`);
        if (res?.order) return { ...o, ...res.order, stall_name: res.order.stall_name || o.stall_name, items: res.items };
      } catch (e: any) {
        if (String(e?.message || '').startsWith('404')) return { ...o, missing: true };
      }
      return o; // offline / server unreachable: show last known status
    }));
    await updateMyOrders(results.map(r => ({ id: r.id, status: r.status, stall_name: r.stall_name, total_amount: r.total_amount })));
    setOrders(results);
    setLoaded(true);
  }, []);

  // Refresh on focus and poll while the screen is visible
  useFocusEffect(useCallback(() => {
    refresh();
    const t = setInterval(refresh, POLL_MS);
    return () => clearInterval(t);
  }, [refresh]));

  const onPull = async () => { setRefreshing(true); await refresh(); setRefreshing(false); };
  const active = orders.filter(o => !DONE_STATUSES.includes(o.status || '') && !o.missing);
  const past = orders.filter(o => DONE_STATUSES.includes(o.status || '') || o.missing);

  return (
    <View style={styles.root}>
    <ScrollView contentContainerStyle={[styles.container, { paddingTop: insets.top + 20, paddingBottom: CUSTOMER_NAV_SPACE + insets.bottom }]}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onPull} tintColor={GREEN} />}>
      <View style={styles.head}>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>My Orders</Text>
          <Text style={styles.sub}>Saved on this device only. Show your pickup code at the counter.</Text>
        </View>
        {past.length > 0 && (
          <TouchableOpacity onPress={async () => { await clearFinishedOrders(); refresh(); }} style={styles.clearBtn}>
            <Text style={styles.clearText}>Clear finished</Text>
          </TouchableOpacity>
        )}
      </View>

      {loaded && orders.length === 0 && (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><ReceiptText size={26} color={GREEN} /></View>
          <Text style={styles.emptyTitle}>No orders yet</Text>
          <Text style={styles.sub}>Scan a stall’s QR or pick a stall to start.</Text>
          <TouchableOpacity onPress={() => router.push('/' as any)} style={styles.primary}>
            <Store size={16} color="#fff" /><Text style={styles.primaryText}>Browse stalls</Text>
          </TouchableOpacity>
        </View>
      )}

      {active.map(o => <OrderCard key={o.id} o={o} onRemove={async () => { await removeMyOrder(o.id); refresh(); }} />)}

      {past.length > 0 && <Text style={styles.section}>Earlier</Text>}
      {past.map(o => <OrderCard key={o.id} o={o} onRemove={async () => { await removeMyOrder(o.id); refresh(); }} />)}
    </ScrollView>
    <CustomerNav />
    </View>
  );
}

function OrderCard({ o, onRemove }: { o: Row; onRemove: () => void }) {
  const status = o.status || 'PENDING_PAYMENT';
  const cancelled = status === 'CANCELLED';
  const ready = status === 'READY';
  const done = DONE_STATUSES.includes(status) || o.missing;
  const stepIdx = STEPS.indexOf(status);
  const itemCount = (o.items || []).reduce((s: number, i: any) => s + (i.quantity || 0), 0);

  return (
    <View style={[styles.card, ready && styles.cardReady, done && { opacity: 0.7 }]}>
      <View style={styles.cardTop}>
        <View style={{ flex: 1 }}>
          <Text style={styles.stall}>{o.stall_name || o.stall_id}</Text>
          <Text style={styles.code} accessibilityLabel={`Pickup code ${o.pickup_code.split('').join(' ')}`}>{o.pickup_code}</Text>
        </View>
        <TouchableOpacity onPress={onRemove} style={styles.iconBtn} accessibilityLabel="Remove from this device">
          <Trash2 size={16} color="#78716C" />
        </TouchableOpacity>
      </View>

      <View style={styles.statusRow}>
        {cancelled || o.missing ? <XCircle size={16} color="#B91C1C" />
          : status === 'COMPLETED' || ready ? <CheckCircle2 size={16} color={ready ? '#047857' : GREEN} />
          : <Clock size={16} color={GREEN} />}
        <Text style={[styles.statusText, ready && { color: '#047857' }, (cancelled || o.missing) && { color: '#B91C1C' }]}>
          {o.missing ? 'Order no longer on server' : LABELS[status] || status}
        </Text>
      </View>

      {!cancelled && !o.missing && (
        <View style={styles.bar}>
          {STEPS.map((s, i) => <View key={s} style={[styles.seg, i <= stepIdx && styles.segOn]} />)}
        </View>
      )}

      <Text style={styles.meta}>
        {itemCount ? `${itemCount} item${itemCount === 1 ? '' : 's'} · ` : ''}
        {o.total_amount != null ? `₱${Number(o.total_amount).toFixed(2)} · ` : ''}
        {new Date(o.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.page },
  container: { paddingHorizontal: 16, gap: 12, maxWidth: 640, width: '100%', alignSelf: 'center' },
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 4 },
  title: { fontSize: 32, fontWeight: '700', color: C.ink, letterSpacing: -0.8 },
  sub: { fontSize: 13, color: '#78716C', marginTop: 4, lineHeight: 18 },
  clearBtn: { borderWidth: 1, borderColor: '#E7E5E4', borderRadius: 999, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#fff' },
  clearText: { fontSize: 12, fontWeight: '600', color: '#44403C' },
  section: { fontSize: 13, fontWeight: '700', color: '#78716C', marginTop: 12, textTransform: 'uppercase', letterSpacing: 1 },
  empty: { alignItems: 'center', paddingVertical: 48, gap: 6 },
  emptyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#E6F2F0', alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  emptyTitle: { fontSize: 17, fontWeight: '700', color: '#1C1917' },
  primary: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: GREEN, borderRadius: 999, paddingHorizontal: 20, paddingVertical: 12, marginTop: 14 },
  primaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  card: { backgroundColor: C.card, borderRadius: R.card, padding: 18, borderWidth: 1, borderColor: C.line, gap: 10, ...shadow.card },
  cardReady: { borderColor: '#10B981', borderWidth: 2, backgroundColor: '#F0FDF4' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start' },
  stall: { fontSize: 13, fontWeight: '600', color: '#57534E' },
  code: { fontSize: 40, fontWeight: '800', color: '#1C1917', letterSpacing: 6, fontFamily: 'monospace', marginTop: 2 },
  iconBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F4', alignItems: 'center', justifyContent: 'center' },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  statusText: { fontSize: 15, fontWeight: '700', color: GREEN },
  bar: { flexDirection: 'row', gap: 6 },
  seg: { flex: 1, height: 6, borderRadius: 3, backgroundColor: '#E7E5E4' },
  segOn: { backgroundColor: GREEN },
  meta: { fontSize: 12, color: '#78716C' },
});
