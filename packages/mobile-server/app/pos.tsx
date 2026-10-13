import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  useWindowDimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useWorkspaceAuth } from '../src/hooks/useStaffAuth';
import { Search, Banknote, Printer, CheckCircle } from 'lucide-react-native';
import { C, R, shadow } from '../constants/theme';
import { StaffScreen, StaffHero, StaffGate, HeroChip, STAFF_HERO_IMAGES } from '../src/components/StaffChrome';
import * as Print from 'expo-print';
import { apiGet, apiPatch, setToken } from '../constants/api';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type AuthUser = {
  id: string;
  username: string;
  role: 'ADMIN' | 'STALL_OWNER';
  stall_id: string | null;
  stall_name: string | null;
  display_name: string;
};

// ---------------------------------------------------------------------------
// useAuth — AsyncStorage for auth (via useAuth)
// Replaces web localStorage with React Native AsyncStorage
// Keys: campusbite_user / campusbite_token (same as web)
// ---------------------------------------------------------------------------
const useAuth = useWorkspaceAuth;



// ---------------------------------------------------------------------------
// Status colors — port of PosPage.tsx statusStyle Record<string,string>
// Tailwind -> React Native StyleSheet warm stone mapping
// ---------------------------------------------------------------------------
const STATUS_STYLES: Record<string, { bg: string; color: string; borderColor: string }> = {
  PENDING_PAYMENT: { bg: '#FFFBEB', color: '#B45309', borderColor: '#FDE68A' },
  CONFIRMED: { bg: '#F0F9FF', color: '#0369A1', borderColor: '#BAE6FD' },
  PREPARING: { bg: '#F5F3FF', color: '#6D28D9', borderColor: '#DDD6FE' },
  READY: { bg: '#ECFDF5', color: '#047857', borderColor: '#A7F3D0' },
  COMPLETED: { bg: '#0F4C4A', color: '#FFFFFF', borderColor: '#0F4C4A' },
  CANCELLED: { bg: '#FEF2F2', color: '#B91C1C', borderColor: '#FECACA' },
};
const STATUS_TEXT: Record<string, string> = {
  PENDING_PAYMENT: 'Awaiting payment',
  CONFIRMED: 'Paid',
  PREPARING: 'Preparing',
  READY: 'Ready',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
};
const statusText = (s: string) => STATUS_TEXT[s] || s;

function getStatusStyle(status: string) {
  return STATUS_STYLES[status] ?? { bg: '#F5F5F4', color: '#57534E', borderColor: '#E7E5E4' };
}

// ---------------------------------------------------------------------------
// API helpers — shared client sends Authorization: Bearer <session token>
// ---------------------------------------------------------------------------
const authedGet = (path: string, token: string | null) => apiGet(path, token);
const authedPatch = (path: string, body: any, token: string | null) => apiPatch(path, body, token);

// ---------------------------------------------------------------------------
// Receipt HTML builder for expo-print
// ---------------------------------------------------------------------------
function buildReceiptHtml(order: any, items: any[]): string {
  const date = new Date(order.created_at).toLocaleString();
  const rows = items
    .map(
      (it: any) =>
        `<div style="display:flex;justify-content:space-between;padding:5px 0;font-size:13px;color:#44403C;"><span>${String(
          it.menu_item_name ?? it.name ?? 'Item',
        ).replace(/</g, '&lt;')} x${it.quantity}</span><span style="font-weight:600;">₱${it.subtotal}</span></div>`,
    )
    .join('');
  return `<!doctype html>
<html><head><meta charset="utf-8" /><style>
  body{font-family:monospace;padding:24px;color:#1C1917;background:#fff;}
  h1{text-align:center;font-size:16px;margin:0;font-weight:800;letter-spacing:-0.2px;}
  .sub{text-align:center;font-size:11px;color:#78716C;margin-top:6px;}
  .dash{border-top:1px dashed #D6D3D1;margin:14px 0;}
  .thick{border-top:2px solid #1C1917;margin:14px 0;}
  .row{display:flex;justify-content:space-between;padding:5px 0;font-size:13px;}
  .total{display:flex;justify-content:space-between;font-weight:800;font-size:14px;padding-top:12px;border-top:2px solid #1C1917;margin-top:12px;}
  .foot{text-align:center;font-size:11px;color:#78716C;margin-top:16px;}
</style></head><body>
  <h1>CampusBITE Receipt</h1>
  <div class="sub">Order ${order.pickup_code} · ${date}</div>
  <div class="dash"></div>
  ${rows}
  <div class="total"><span>TOTAL</span><span>₱${order.total_amount}</span></div>
  <div class="foot">Thank you!</div>
</body></html>`;
}

// ---------------------------------------------------------------------------
// Main POS screen
// Keeps all logic: auth gate, 4-char uppercase code, GET by-code, recent GET
// limit 30 live via room='pos', status colors, PATCH buttons per status,
// receipt, Print via expo-print. Uses RN View/Text/TextInput/etc.
// ---------------------------------------------------------------------------
export default function PosPage() {
  const { user, token, loading } = useAuth();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<{ order: any; items: any[] } | null>(null);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<any[]>([]);
  const [printing, setPrinting] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      const o = await authedGet('/api/orders?limit=30', token);
      setOrders(Array.isArray(o) ? o : []);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [token]);

  useEffect(() => {
    if (!loading && token) refresh();
  }, [loading, token, refresh]);

  // Live updates: poll every 3s (the Expo server has no WebSocket)
  useEffect(() => {
    if (!token) return;
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, [token, refresh]);

  async function lookup() {
    setError('');
    setResult(null);
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return;
    try {
      const res = await authedGet(`/api/orders/by-code/${trimmed}`, token);
      setResult(res as any);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }

  async function updateStatus(orderId: string, status: string) {
    try {
      await authedPatch(`/api/orders/${orderId}/status`, { status }, token);
      const curId = result?.order?.id;
      setResult(null);
      setCode('');
      await refresh();
      if (curId === orderId) {
        try {
          const r = await authedGet(`/api/orders/${orderId}`, token);
          // GET /api/orders/:id returns { order, items }
          if (r && r.order) setResult(r as any);
        } catch {}
      }
    } catch (e: any) {
      Alert.alert('Update failed', e?.message ?? String(e));
    }
  }

  async function handlePrint() {
    if (!result) return;
    const html = buildReceiptHtml(result.order, result.items);
    setPrinting(true);
    try {
      await Print.printAsync({ html });
    } catch (e: any) {
      Alert.alert('Print failed', e?.message ?? String(e));
    } finally {
      setPrinting(false);
    }
  }

  // Auth loading
  if (loading) {
    return (
      <View style={[styles.safe, styles.centerScreen]}>
        <ActivityIndicator color="#1C1917" />
        <Text style={styles.loadingText}>Loading POS…</Text>
      </View>
    );
  }

  if (!user) return <StaffGate title="Cashier" image={STAFF_HERO_IMAGES.pos} />;

  const headerSubtitle = user.role === 'ADMIN' ? 'All stalls' : user.stall_name ?? '—';
  const statusBadge = result ? getStatusStyle(result.order.status) : null;
  const awaiting = orders.filter((o) => o.status === 'PENDING_PAYMENT').length;

  return (
    <StaffScreen
      hero={
        <StaffHero image={STAFF_HERO_IMAGES.pos} eyebrow={`POS · ${headerSubtitle}`} title="Cashier"
          subtitle="Enter the customer's pickup code to take payment." user={user}>
          <HeroChip icon={<View style={styles.liveDot} />} label="Live" />
          <HeroChip label={`${awaiting} awaiting payment`} />
        </StaffHero>
      }
    >
        {/* Cashier card — 4-char pickup code lookup + result */}
        <View style={styles.forkCard}>
          <Text style={styles.cardTitle}>Pickup code</Text>
          <View style={styles.lookupRow}>
            <TextInput
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase().slice(0, 4))}
              placeholder="A3X9"
              placeholderTextColor="#A8A29E"
              maxLength={4}
              autoCapitalize="characters"
              autoCorrect={false}
              style={styles.codeInput}
            />
            <TouchableOpacity onPress={lookup} style={styles.lookupBtn} activeOpacity={0.85}>
              <Search size={16} color="#fff" />
              <Text style={styles.lookupBtnText}>Lookup</Text>
            </TouchableOpacity>
          </View>

          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          {result ? (
            <View style={styles.resultCard}>
              <View style={styles.resultHeader}>
                <Text style={styles.pickupCode}>{result.order.pickup_code}</Text>
                <View
                  style={[
                    styles.statusBadge,
                    {
                      backgroundColor: statusBadge!.bg,
                      borderColor: statusBadge!.borderColor,
                    },
                  ]}
                >
                  <Text style={[styles.statusBadgeText, { color: statusBadge!.color }]}>{statusText(result.order.status)}</Text>
                </View>
              </View>

              <View style={styles.itemsList}>
                {result.items.map((it: any) => (
                  <View key={it.id} style={styles.itemRow}>
                    <Text style={styles.itemName}>
                      {it.menu_item_name}
                      <Text style={styles.itemQty}> ×{it.quantity}</Text>
                    </Text>
                    <Text style={styles.itemSubtotal}>₱{it.subtotal}</Text>
                  </View>
                ))}
              </View>

              <View style={styles.totalRow}>
                <Text style={styles.totalLabel}>Total</Text>
                <Text style={styles.totalValue}>₱{result.order.total_amount}</Text>
              </View>

              <View style={styles.actionGrid}>
                {result.order.status === 'PENDING_PAYMENT' ? (
                  <TouchableOpacity
                    onPress={() => updateStatus(result.order.id, 'CONFIRMED')}
                    style={[styles.btnBase, styles.btnEmerald, styles.btnFull]}
                    activeOpacity={0.9}
                  >
                    <Banknote size={16} color="#fff" />
                    <Text style={styles.btnTextWhite}>Confirm Cash</Text>
                  </TouchableOpacity>
                ) : null}
                {result.order.status === 'CONFIRMED' ? (
                  <TouchableOpacity
                    onPress={() => updateStatus(result.order.id, 'PREPARING')}
                    style={[styles.btnBase, styles.btnViolet, styles.btnHalf]}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.btnTextWhite}>Preparing</Text>
                  </TouchableOpacity>
                ) : null}
                {result.order.status === 'PREPARING' ? (
                  <TouchableOpacity
                    onPress={() => updateStatus(result.order.id, 'READY')}
                    style={[styles.btnBase, styles.btnSky, styles.btnHalf]}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.btnTextWhite}>Ready</Text>
                  </TouchableOpacity>
                ) : null}
                {result.order.status === 'READY' ? (
                  <TouchableOpacity
                    onPress={() => updateStatus(result.order.id, 'COMPLETED')}
                    style={[styles.btnBase, styles.btnDark, styles.btnHalf]}
                    activeOpacity={0.9}
                  >
                    <CheckCircle size={16} color="#fff" />
                    <Text style={styles.btnTextWhite}>Completed</Text>
                  </TouchableOpacity>
                ) : null}
                {['PENDING_PAYMENT', 'CONFIRMED', 'PREPARING', 'READY'].includes(result.order.status) ? (
                  <TouchableOpacity
                    onPress={() => updateStatus(result.order.id, 'CANCELLED')}
                    style={[styles.btnBase, styles.btnCancel, styles.btnHalf]}
                    activeOpacity={0.9}
                  >
                    <Text style={styles.btnCancelText}>Cancel</Text>
                  </TouchableOpacity>
                ) : null}
                {result.order.status !== 'PENDING_PAYMENT' ? (
                  <TouchableOpacity
                    onPress={handlePrint}
                    disabled={printing}
                    style={[styles.btnBase, styles.btnPrint, styles.btnHalf, printing && styles.btnDisabled]}
                    activeOpacity={0.9}
                  >
                    <Printer size={16} color={printing ? '#A8A29E' : '#44403C'} />
                    <Text style={[styles.btnPrintText, printing && styles.btnPrintTextDisabled]}>
                      {printing ? 'Printing…' : 'Print'}
                    </Text>
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>
          ) : null}
        </View>

        {/* Receipt fork-card — monospace CampusBITE Receipt */}
        {result ? (
          <View style={styles.forkCardMono}>
            <Text style={styles.receiptTitle}>CampusBITE Receipt</Text>
            <Text style={styles.receiptSub}>
              Order {result.order.pickup_code} · {new Date(result.order.created_at).toLocaleString()}
            </Text>
            <View style={styles.dashedLine} />
            {result.items.map((it: any) => (
              <View key={it.id} style={styles.receiptRow}>
                <Text style={styles.receiptItem}>
                  {it.menu_item_name} x{it.quantity}
                </Text>
                <Text style={styles.receiptPrice}>₱{it.subtotal}</Text>
              </View>
            ))}
            <View style={styles.thickLine} />
            <View style={styles.receiptTotalRow}>
              <Text style={styles.receiptTotalLabel}>TOTAL</Text>
              <Text style={styles.receiptTotalValue}>₱{result.order.total_amount}</Text>
            </View>
            <Text style={styles.receiptFoot}>Thank you!</Text>
          </View>
        ) : null}

        {/* Recent Orders fork-card — GET /api/orders?limit=30 live via pos room */}
        <View style={styles.recentCard}>
          <View style={styles.recentHeader}>
            <Text style={styles.recentTitle}>Recent Orders</Text>
            <View style={styles.livePill}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>Live</Text>
            </View>
          </View>

          <View style={styles.recentList}>
            {orders.map((o) => {
              const s = getStatusStyle(o.status);
              return (
                <TouchableOpacity
                  key={o.id}
                  activeOpacity={0.7}
                  onPress={async () => {
                    setCode(o.pickup_code);
                    try {
                      const res = await authedGet(`/api/orders/by-code/${o.pickup_code}`, token);
                      setResult(res as any);
                      setError('');
                    } catch {}
                  }}
                  style={styles.orderRow}
                >
                  <View style={styles.codeCircle}>
                    <Text style={styles.codeCircleText}>{o.pickup_code}</Text>
                  </View>
                  <View style={styles.orderMeta}>
                    <Text style={styles.orderPrimary}>
                      ₱{o.total_amount} · {new Date(o.created_at).toLocaleTimeString()}
                    </Text>
                    <Text style={styles.orderSecondary} numberOfLines={1}>
                      Tap to open · #{String(o.id).slice(0, 6)}
                    </Text>
                  </View>
                  <View style={[styles.statusBadgeSmall, { backgroundColor: s.bg, borderColor: s.borderColor }]}>
                    <Text style={[styles.statusBadgeSmallText, { color: s.color }]}>{statusText(o.status)}</Text>
                  </View>
                </TouchableOpacity>
              );
            })}
            {orders.length === 0 ? (
              <View style={styles.emptyWrap}>
                <Text style={styles.emptyText}>No orders yet</Text>
              </View>
            ) : null}
          </View>
        </View>

    </StaffScreen>
  );
}

// ---------------------------------------------------------------------------
// StyleSheet — CampusBITE theme (landing: deep green, warm cream, pills)
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.page },
  centerScreen: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, fontSize: 13, color: C.muted, fontWeight: '600' },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#34D399' },

  forkCard: { backgroundColor: C.card, borderRadius: R.card, padding: 20, borderWidth: 1, borderColor: C.line, ...shadow.card },
  cardTitle: { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: -0.4 },

  lookupRow: { flexDirection: 'row', gap: 8, marginTop: 14, alignItems: 'stretch', backgroundColor: C.cream, borderRadius: R.pill, padding: 6 },
  codeInput: { flex: 1, minWidth: 100 as any, borderRadius: R.pill, paddingHorizontal: 16, paddingVertical: 12, fontSize: 24, fontWeight: '800', letterSpacing: 8, textAlign: 'center', color: C.green, backgroundColor: '#fff', fontFamily: 'monospace' },
  lookupBtn: { backgroundColor: C.green, borderRadius: R.pill, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  lookupBtnText: { color: '#fff', fontWeight: '800', fontSize: 14 },

  errorBox: { marginTop: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 16, paddingHorizontal: 14, paddingVertical: 10 },
  errorText: { fontSize: 13, color: C.danger },

  resultCard: { marginTop: 18, backgroundColor: C.page, borderRadius: R.card, padding: 18, borderWidth: 1, borderColor: C.line },
  resultHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  pickupCode: { fontSize: 34, fontWeight: '800', letterSpacing: 6, color: C.ink, fontFamily: 'monospace' },
  statusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill, borderWidth: 1 },
  statusBadgeText: { fontSize: 12, fontWeight: '700' },

  itemsList: { marginTop: 14, gap: 8 },
  itemRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  itemName: { fontSize: 14, color: C.inkSoft, flex: 1, paddingRight: 8 },
  itemQty: { color: C.muted },
  itemSubtotal: { fontSize: 14, fontWeight: '700', color: C.ink },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingTop: 14, borderTopWidth: 1, borderTopColor: C.line },
  totalLabel: { fontSize: 16, fontWeight: '800', color: C.ink },
  totalValue: { fontSize: 20, fontWeight: '800', color: C.green },

  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  btnBase: { paddingVertical: 15, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  btnFull: { width: '100%' },
  btnHalf: { flexBasis: '48%', flexGrow: 1 },
  btnEmerald: { backgroundColor: C.green },
  btnViolet: { backgroundColor: C.green },
  btnSky: { backgroundColor: C.green },
  btnDark: { backgroundColor: C.green },
  btnCancel: { backgroundColor: C.card, borderWidth: 1, borderColor: '#FECACA' },
  btnPrint: { backgroundColor: C.cream, borderWidth: 1, borderColor: C.line },
  btnDisabled: { opacity: 0.6 },
  btnTextWhite: { color: '#fff', fontWeight: '800', fontSize: 15 },
  btnCancelText: { color: C.danger, fontWeight: '700', fontSize: 14 },
  btnPrintText: { color: C.green, fontWeight: '700', fontSize: 14 },
  btnPrintTextDisabled: { color: '#A8A29E' },

  // Receipt — paper ticket on cream
  forkCardMono: { backgroundColor: '#FFFDF7', borderRadius: R.card, padding: 22, borderWidth: 1, borderColor: C.line, borderStyle: 'dashed' },
  receiptTitle: { textAlign: 'center', fontWeight: '800', color: C.green, fontSize: 14, fontFamily: 'monospace' },
  receiptSub: { textAlign: 'center', fontSize: 11, color: C.muted, marginTop: 6, fontFamily: 'monospace' },
  dashedLine: { borderTopWidth: 1, borderStyle: 'dashed', borderColor: C.line, marginVertical: 12 },
  receiptRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 3 },
  receiptItem: { fontSize: 12, color: C.inkSoft, fontFamily: 'monospace' },
  receiptPrice: { fontSize: 12, color: C.ink, fontFamily: 'monospace', fontWeight: '600' },
  thickLine: { borderTopWidth: 1.5, borderColor: C.green, marginVertical: 12 },
  receiptTotalRow: { flexDirection: 'row', justifyContent: 'space-between' },
  receiptTotalLabel: { fontSize: 13, fontWeight: '800', color: C.ink, fontFamily: 'monospace' },
  receiptTotalValue: { fontSize: 13, fontWeight: '800', color: C.ink, fontFamily: 'monospace' },
  receiptFoot: { textAlign: 'center', fontSize: 11, color: C.muted, marginTop: 12, fontFamily: 'monospace' },

  // Recent orders
  recentCard: { backgroundColor: C.card, borderRadius: R.card, overflow: 'hidden', borderWidth: 1, borderColor: C.line, ...shadow.card },
  recentHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16 },
  recentTitle: { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: -0.4 },
  livePill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.greenSoft, paddingHorizontal: 12, paddingVertical: 6, borderRadius: R.pill },
  liveText: { fontSize: 12, fontWeight: '700', color: C.green },
  recentList: { paddingHorizontal: 10, paddingBottom: 10, gap: 6 },
  orderRow: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 10, borderRadius: 18, backgroundColor: C.page },
  codeCircle: { width: 64, height: 44, borderRadius: R.pill, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  codeCircleText: { color: C.green, fontWeight: '800', fontSize: 14, letterSpacing: 2, fontFamily: 'monospace' },
  orderMeta: { flex: 1, minWidth: 0 },
  orderPrimary: { fontSize: 14, fontWeight: '700', color: C.ink },
  orderSecondary: { fontSize: 11, color: C.muted, marginTop: 2 },
  statusBadgeSmall: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill, borderWidth: 1 },
  statusBadgeSmallText: { fontSize: 11, fontWeight: '700' },
  emptyWrap: { padding: 36, alignItems: 'center' },
  emptyText: { fontSize: 13, color: C.muted },
});
