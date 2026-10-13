import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getApiBase, apiGet, apiPost, initApiBase, publicOrigin } from '../constants/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { saveMyOrder, updateMyOrders } from '../lib/myOrders';
import { stallHeroImage, menuItemImage } from '../lib/stallImages';
import { C, R, shadow } from '../constants/theme';
import { ShoppingCart, Plus, Minus, Star, Clock, QrCode, Heart, X, AlertTriangle, RefreshCw, Copy, Check, ArrowLeft, ChevronRight, ReceiptText } from 'lucide-react-native';
import { SvgXml } from 'react-native-svg';
import QRCode from 'qrcode';
import * as Clipboard from 'expo-clipboard';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type MenuItem = {
  id: string;
  name: string;
  price: number;
  description: string;
  stall_id: string;
  category_id: string;
  image_url?: string | null;
  category_name?: string;
  rating?: number;
  rating_count?: number;
  variants?: { id: string; name: string; price: number }[];
};

type Stall = {
  id: string;
  name: string;
  description?: string;
  logo_url?: string | null;
  rating?: number | string | null;
  rating_count?: number;
};

type Category = { id: string; name: string };

const STATUS_LABELS: Record<string, string> = {
  PENDING_PAYMENT: 'Pay at the counter',
  CONFIRMED: 'Paid · in queue',
  PREPARING: 'Preparing',
  READY: 'Ready for pickup',
  COMPLETED: 'Picked up',
  CANCELLED: 'Cancelled',
};
const statusLabel = (s?: string) => (s ? STATUS_LABELS[s] || s : '');

const FAVS_KEY = 'campusbite_favs';
const LAST_ORDER_KEY = 'campusbite_last_order';

// Offline photos (bundled or uploaded) — see lib/stallImages.ts
const getMenuImage = (item: MenuItem) => menuItemImage(item);



// ---------------------------------------------------------------------------
// QR Svg component — uses qrcode (npm) + react-native-svg (SvgXml)
// ---------------------------------------------------------------------------
function QrSvg({ value, size }: { value: string; size: number }) {
  const [xml, setXml] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const opts: any = { type: 'svg', margin: 1, width: size, errorCorrectionLevel: 'M' };
    // qrcode@1.5 types: toString(text, opts, cb) — we wrap callback as Promise via any cast
    const maybePromise: any = (QRCode as any).toString(value, opts);
    if (maybePromise && typeof maybePromise.then === 'function') {
      maybePromise
        .then((svg: string) => {
          if (!mounted) return;
          setXml(svg);
        })
        .catch(() => {
          if (mounted) setXml(null);
        });
    } else {
      (QRCode as any).toString(value, opts, (err: any, svg: string) => {
        if (!mounted) return;
        if (err || !svg) setXml(null);
        else setXml(svg);
      });
    }
    return () => {
      mounted = false;
    };
  }, [value, size]);

  if (!xml) {
    return (
      <View
        style={{
          width: size,
          height: size,
          backgroundColor: '#F5F5F4',
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
          borderWidth: 1,
          borderColor: '#E7E5E4',
        }}
      >
        <ActivityIndicator color="#57534E" />
        <Text style={{ fontSize: 10, color: '#78716C', marginTop: 6 }}>Generating QR…</Text>
      </View>
    );
  }
  return <SvgXml xml={xml} width={size} height={size} />;
}

// ---------------------------------------------------------------------------
// Main Kiosk screen — port of web KioskPage.tsx to Expo Go
// Keeps all logic: QR stall lock, stall switcher, categories, menu grid,
// variants (Small/Medium/Large), favorites via AsyncStorage, cart Map with
// variantId, size modal (McDo style), checkout POST /api/orders,
// live tracker via useMobileWebSocket, star ratings, heart toggle.
// ---------------------------------------------------------------------------
export default function KioskPage() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const isMobile412 = width < 640; // 412x915
  const isTablet712 = width >= 640 && width < 1024; // 712x1138
  const cardWidth = isMobile412 ? '100%' as const : isTablet712 ? '48%' as const : '31%' as const;
  // QR stall lock via expo-router useLocalSearchParams (replaces useSearchParams)
  const params = useLocalSearchParams<{
    stall?: string;
    stallId?: string;
    stall_id?: string;
    table?: string;
  }>();
  const qrStall =
    (params.stall as string | undefined) ||
    (params.stallId as string | undefined) ||
    (params.stall_id as string | undefined) ||
    undefined;
  const qrTable = (params.table as string | undefined) || undefined;

  const [stalls, setStalls] = useState<Stall[]>([]);
  const [stallId, setStallId] = useState<string>('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [activeCat, setActiveCat] = useState<string>('all');
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [liveStatus, setLiveStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [selectedVariantItem, setSelectedVariantItem] = useState<(MenuItem & { variants?: any[] }) | null>(null);
  const [apiBase, setApiBaseState] = useState<string>(getApiBase() || 'same-origin');
  const [loadErr, setLoadErr] = useState<string>('');
  const [loadingStalls, setLoadingStalls] = useState(true);
  const [authUser, setAuthUser] = useState<any>(null);
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('campusbite_user');
        if (raw) setAuthUser(JSON.parse(raw));
        else setAuthUser(null);
      } catch { setAuthUser(null); }
    })();
    const id = setInterval(async () => {
      try {
        const raw = await AsyncStorage.getItem('campusbite_user');
        setAuthUser(raw ? JSON.parse(raw) : null);
      } catch {}
    }, 2000);
    return () => clearInterval(id);
  }, []);

  // Persisted last order — survives refresh, live updates via WS
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(LAST_ORDER_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.order?.id) {
            setLastOrder(parsed);
            saveMyOrder(parsed.order).catch(() => {}); // carry pre-existing last order into My Orders
            setLiveStatus(parsed.order.status || '');
            // Re-validate from server (in case status changed while away)
            try {
              const fresh = await apiGet(`/api/orders/${parsed.order.id}`);
              if (fresh?.order) {
                const merged = { order: fresh.order, items: fresh.items || parsed.items };
                setLastOrder(merged);
                setLiveStatus(fresh.order.status);
                await AsyncStorage.setItem(LAST_ORDER_KEY, JSON.stringify(merged));
              }
            } catch {}
          }
        }
      } catch {}
    })();
  }, []);
  useEffect(() => {
    if (lastOrder?.order?.id) {
      AsyncStorage.setItem(LAST_ORDER_KEY, JSON.stringify(lastOrder)).catch(()=>{});
      if (lastOrder.order.status) setLiveStatus(lastOrder.order.status);
    }
  }, [lastOrder]);

  // Favorites persisted via AsyncStorage (replaces localStorage)
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FAVS_KEY);
        if (raw) {
          const arr: string[] = JSON.parse(raw);
          setFavorites(new Set(arr));
        }
      } catch {}
    })();
  }, []);

  useEffect(() => {
    // persist favorites — mirrors web: localStorage.setItem('campusbite_favs', ...)
    AsyncStorage.setItem(FAVS_KEY, JSON.stringify([...favorites])).catch(() => {});
  }, [favorites]);

  const toggleFav = (id: string) =>
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Init persisted API base then fetch
  useEffect(() => {
    initApiBase().then((b) => setApiBaseState(b || 'same-origin')).catch(() => {});
  }, []);

  // Fetch stalls — respects QR stall lock + stall-owner filter (only own stall when logged in as STALL_OWNER)
  useEffect(() => {
    setLoadingStalls(true);
    setLoadErr('');
    apiGet('/api/stalls')
      .then((s: any[]) => {
        let filtered = s;
        // Stall owner sees only own stall in Kiosk (per request)
        if (authUser?.role === 'STALL_OWNER' && authUser.stall_id) {
          filtered = s.filter((x) => x.id === authUser.stall_id);
          if (filtered.length === 0) {
            setLoadErr(`No stall found for owner ${authUser.username} (${authUser.stall_id})`);
          }
        }
        setStalls(filtered);
        // QR lock takes precedence, but for stall owner, QR must match own stall or is ignored
        const effectiveQrStall = authUser?.role === 'STALL_OWNER' && authUser.stall_id ? authUser.stall_id : qrStall;
        if (effectiveQrStall && filtered.find((x) => x.id === effectiveQrStall)) setStallId(effectiveQrStall);
        else if (qrStall && filtered.find((x) => x.id === qrStall)) setStallId(qrStall);
        else if (filtered[0]) setStallId(filtered[0].id);
        else setLoadErr(`No stalls returned from ${getApiBase() || 'same-origin'}/api/stalls`);
      })
      .catch((e: any) => {
        setLoadErr(`Stalls fetch failed: ${e?.message ?? String(e)} (API ${getApiBase() || 'same-origin'})`);
      })
      .finally(() => setLoadingStalls(false));
  }, [qrStall, apiBase, authUser]);

  // Fetch categories + menu when stall changes
  useEffect(() => {
    if (!stallId) return;
    setLoadErr('');
    apiGet(`/api/categories?stallId=${stallId}`)
      .then((c) => setCategories(c as Category[]))
      .catch((e: any) => {
        setCategories([]);
        setLoadErr((prev) => prev || `Categories failed: ${e?.message ?? String(e)}`);
      });
    apiGet(`/api/menu?stallId=${stallId}`)
      .then((m) => {
        setMenu(m as MenuItem[]);
        if ((m as any[]).length === 0) setLoadErr((prev) => prev || `No menu items for stall ${stallId} from ${getApiBase() || 'same-origin (Expo 8081)'} — seed may be empty. Check Expo API logs.`);
      })
      .catch((e: any) => {
        setMenu([]);
        setLoadErr(`Menu failed: ${e?.message ?? String(e)} (API ${getApiBase() || 'same-origin'})`);
      });
  }, [stallId]);

  // Live tracker: poll the order every 4s until it's finished (the Expo server has no WebSocket)
  const trackedId: string | undefined = lastOrder?.order?.id;
  const trackedDone = ['COMPLETED', 'CANCELLED'].includes(liveStatus || lastOrder?.order?.status);
  useEffect(() => {
    if (!trackedId || trackedDone) return;
    const t = setInterval(async () => {
      try {
        const fresh: any = await apiGet(`/api/orders/${trackedId}`, null);
        if (!fresh?.order) return;
        setLiveStatus(fresh.order.status);
        setLastOrder((prev: any) => (prev?.order?.id === trackedId ? { ...prev, order: fresh.order } : prev));
        updateMyOrders([{ id: trackedId, status: fresh.order.status }]).catch(() => {});
      } catch {}
    }, 4000);
    return () => clearInterval(t);
  }, [trackedId, trackedDone]);

  const currentStall = stalls.find((s) => s.id === stallId);

  const handleStallChange = (newStallId: string) => {
    if (newStallId === stallId) return;
    if (cart.size > 0) {
      Alert.alert(
        'Checkout first',
        `Checkout cart from "${currentStall?.name ?? 'current stall'}" before switching.`,
      );
      return;
    }
    setStallId(newStallId);
    setActiveCat('all');
  };

  // Cart helpers — Map with variantId (key = "itemId::variantId")
  const add = (id: string, variant?: any) => {
    const item: any = menu.find((i) => i.id === id);
    // McDo style: if item has variants and no variant selected, open modal
    if (item?.variants?.length && !variant) {
      setSelectedVariantItem(item);
      return;
    }
    const key = variant ? `${id}::${variant.id}` : id;
    setCart((m) => new Map(m).set(key, (m.get(key) || 0) + 1));
    if (variant) setSelectedVariantItem(null);
  };

  const sub = (key: string) =>
    setCart((m) => {
      const n = new Map(m);
      const v = (n.get(key) || 0) - 1;
      if (v <= 0) n.delete(key);
      else n.set(key, v);
      return n;
    });

  const addByKey = (key: string) => setCart((m) => new Map(m).set(key, (m.get(key) || 0) + 1));

  // Derived cart items — mirrors web cartItems mapping
  const cartItems = [...cart.entries()]
    .map(([key, qty]) => {
      const [id, variantId] = key.split('::');
      const item: any = menu.find((i) => i.id === id);
      if (!item) return null;
      const variant = variantId ? (item.variants || []).find((v: any) => v.id === variantId) : null;
      const price = variant ? variant.price : item.price;
      return {
        ...item,
        variantId,
        variantName: variant?.name,
        price,
        qty,
        subtotal: price * qty,
        cartKey: key,
      };
    })
    .filter(Boolean) as (MenuItem & {
    qty: number;
    subtotal: number;
    variantId?: string;
    variantName?: string;
    cartKey: string;
    price: number;
  })[];

  const total = cartItems.reduce((s, i) => s + i.subtotal, 0);
  const filteredBase = activeCat === 'all' ? menu : menu.filter((m) => m.category_id === activeCat);
  // Favorites first for easy checkout — same sort as web
  const filtered = [...filteredBase].sort((a: any, b: any) => {
    const fa = favorites.has(a.id) ? 1 : 0;
    const fb = favorites.has(b.id) ? 1 : 0;
    return fb - fa;
  });

  async function checkout() {
    if (cartItems.length === 0) return;
    setLoading(true);
    try {
      const res: any = await apiPost('/api/orders', {
        stallId,
        items: cartItems.map((i) => ({
          menuItemId: i.id,
          variantId: (i as any).variantId || undefined,
          quantity: i.qty,
        })),
      });
      setLastOrder(res);
      setLiveStatus(res.order.status);
      setCart(new Map());
      // Per-device tracking: remember this order so "My Orders" can follow it
      saveMyOrder(res.order, currentStall?.name).catch(() => {});
    } catch (e: any) {
      Alert.alert('Checkout failed', e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  const [health, setHealth] = useState<any>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => { apiGet('/api/health').then(setHealth).catch(()=>{}); }, [apiBase]);
  // Absolute QR URL for scanning from another device — use window.origin or health.ip:8081
  const qrOrigin = publicOrigin(health);
  // Every stall has its own QR: owner → own stall, QR link → that stall, otherwise the stall being viewed
  const effectiveQrStall = (authUser?.role === 'STALL_OWNER' && authUser.stall_id ? authUser.stall_id : qrStall) || stallId;
  const qrValue = effectiveQrStall ? `${qrOrigin}/kiosk?stall=${effectiveQrStall}${qrTable ? `&table=${qrTable}` : ''}` : '';

  async function handleCopyQr() {
    if (!qrValue) return;
    try {
      await Clipboard.setStringAsync(qrValue);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert('Copy failed', qrValue);
    }
  }

  const ORDER_STEPS = ['PENDING_PAYMENT', 'CONFIRMED', 'PREPARING', 'READY', 'COMPLETED'] as const;

  return (
    <View style={styles.safe}>
      <ScrollView
        contentContainerStyle={styles.container}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Full-bleed stall hero — same visual language as the landing carousel */}
        <View style={[styles.hero, { paddingTop: insets.top + 12 }]}>
          {currentStall ? (
            <Image source={{ uri: stallHeroImage(currentStall) }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : null}
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.35)' }]} />
          <View style={styles.heroScrimBottom} />
          <View style={styles.heroTopRow}>
            <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.push('/' as any))}
              style={styles.heroCircle} accessibilityLabel="Back to stalls">
              <ArrowLeft size={20} color={C.green} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowQr(true)} style={styles.heroCircle}
              disabled={!effectiveQrStall} accessibilityLabel="Show this stall's QR code">
              <QrCode size={20} color={C.green} />
            </TouchableOpacity>
          </View>
          {currentStall ? (
            <View style={styles.heroCopy}>
              <Text style={styles.heroEyebrow}>
                {authUser?.role === 'STALL_OWNER' ? 'Your stall' : 'Ordering from'}
                {qrTable ? ` · Table ${qrTable}` : ''}
              </Text>
              <Text style={styles.heroTitle} numberOfLines={2}>{currentStall.name}</Text>
              <Text style={styles.heroDesc} numberOfLines={2}>{currentStall.description || 'Canteen favourite'}</Text>
              <View style={styles.heroMetaRow}>
                <Star size={14} color={C.star} fill={C.star} />
                <Text style={styles.heroMeta}>
                  {currentStall.rating != null ? Number(currentStall.rating).toFixed(1) : '—'} ({currentStall.rating_count ?? 0})
                </Text>
                <Text style={styles.heroMetaDot}>·</Text>
                <Clock size={14} color="rgba(255,255,255,0.85)" />
                <Text style={styles.heroMeta}>10–15 min</Text>
              </View>
            </View>
          ) : null}
        </View>

        <View style={styles.body}>

        {/* QR Modal — functional SVG + selectable URL + Copy button (expo-clipboard) */}
        <Modal visible={showQr} transparent animationType="fade" onRequestClose={() => setShowQr(false)}>
          <Pressable style={styles.modalOverlay} onPress={() => setShowQr(false)}>
            <Pressable style={styles.qrModalCard} onPress={(e) => e.stopPropagation()}>
              <View style={styles.qrModalHeader}>
                <Text style={styles.qrModalTitle}>
                  {stalls.find((s) => s.id === (effectiveQrStall || qrStall))?.name || effectiveQrStall || qrStall} QR
                </Text>
                <TouchableOpacity onPress={() => setShowQr(false)} style={styles.qrModalClose}>
                  <X size={16} color="#57534E" />
                </TouchableOpacity>
              </View>
              <View style={styles.qrBox}>
                <QrSvg value={qrValue || qrOrigin} size={180} />
              </View>
              <View style={styles.qrMonoBox}>
                <Text style={styles.qrMonoText} selectable>
                  {qrValue}
                </Text>
              </View>
              <TouchableOpacity onPress={handleCopyQr} style={[styles.copyBtn, copied && styles.copyBtnActive]} activeOpacity={0.85}>
                {copied ? <Check size={14} color="#fff" /> : <Copy size={14} color="#1C1917" />}
                <Text style={[styles.copyBtnText, copied && styles.copyBtnTextActive]}>{copied ? 'Copied!' : 'Copy URL'}</Text>
              </TouchableOpacity>
              <Text style={styles.qrHint}>Scan to open this stall on another device — URL copied to clipboard</Text>
            </Pressable>
          </Pressable>
        </Modal>

        {/* Stall switcher — hidden when QR locks or stall owner (only own stall) */}
        {(!qrStall && !(authUser?.role === 'STALL_OWNER' && authUser.stall_id)) ? (
          <View style={styles.stallSwitcherRow}>
            {stalls.map((s) => {
              const active = s.id === stallId;
              const locked = cart.size > 0 && !active;
              return (
                <TouchableOpacity
                  key={s.id}
                  onPress={() => handleStallChange(s.id)}
                  disabled={!!locked}
                  activeOpacity={0.8}
                  style={[
                    styles.stallPill,
                    active ? styles.stallPillActive : locked ? styles.stallPillLocked : styles.stallPillIdle,
                  ]}
                >
                  {s.logo_url ? (
                    <Image source={{ uri: stallHeroImage(s) }} style={styles.stallLogo} />
                  ) : null}
                  <Text
                    style={[
                      styles.stallPillText,
                      active ? styles.stallPillTextActive : locked ? styles.stallPillTextLocked : null,
                    ]}
                  >
                    {s.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {/* Live order badge on desktop-style row */}
          </View>
        ) : null}

        {lastOrder ? (
          <TouchableOpacity onPress={() => router.push('/orders' as any)} style={styles.orderBadgeRow}
            accessibilityLabel={`Order ${lastOrder.order.pickup_code}, ${liveStatus || lastOrder.order.status}. Open My Orders`}>
            <View style={styles.dotPulse} />
            <Text style={styles.orderBadgeText} numberOfLines={1}>
              Order <Text style={styles.orderBadgeBold}>{lastOrder.order.pickup_code}</Text> · {statusLabel(liveStatus || lastOrder.order.status)}
            </Text>
            <ChevronRight size={16} color={C.green} />
          </TouchableOpacity>
        ) : null}

        {/* Diagnostic — fixes "no products" silent failure */}
        {loadErr ? (
          <View style={styles.diagCard}>
            <View style={styles.diagHeader}>
              <AlertTriangle size={14} color="#B91C1C" />
              <Text style={styles.diagTitle}>Heads up</Text>
            </View>
            <Text style={styles.diagText}>{loadErr}</Text>
            <Text style={styles.diagMono}>API {apiBase || 'same-origin (Expo 8081)'}</Text>
            <TouchableOpacity
              onPress={() => {
                // retry with current apiBase
                setLoadErr('');
                setApiBaseState(getApiBase());
                apiGet('/api/stalls')
                  .then((s: any[]) => {
                    setStalls(s);
                    if (s[0] && !stallId) setStallId(s[0].id);
                  })
                  .catch((e: any) => setLoadErr(`Retry failed: ${e?.message ?? String(e)}`));
              }}
              style={styles.diagBtn}
            >
              <RefreshCw size={12} color="#fff" />
              <Text style={styles.diagBtnText}>Retry</Text>
            </TouchableOpacity>
          </View>
        ) : null}
        {loadingStalls ? (
          <View style={styles.loadingRow}>
            <ActivityIndicator color="#1C1917" size="small" />
            <Text style={styles.loadingText}>Loading stalls from {apiBase || 'Expo 8081 same-origin'}…</Text>
          </View>
        ) : null}

        {/* Stall hero card — fork-card with warm stone */}
        {/* Categories — horizontal ScrollView (replaces overflow-x-auto) */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesRow}
        >
          <TouchableOpacity
            onPress={() => setActiveCat('all')}
            style={[styles.catPill, activeCat === 'all' ? styles.catPillActive : styles.catPillIdle]}
          >
            <Text style={[styles.catPillText, activeCat === 'all' ? styles.catPillTextActive : null]}>All</Text>
          </TouchableOpacity>
          {categories.map((c) => (
            <TouchableOpacity
              key={c.id}
              onPress={() => setActiveCat(c.id)}
              style={[styles.catPill, activeCat === c.id ? styles.catPillActive : styles.catPillIdle]}
            >
              <Text style={[styles.catPillText, activeCat === c.id ? styles.catPillTextActive : null]}>
                {c.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Menu grid — 2 columns with fork-card shadows, rounded-2xl */}
        <View style={styles.grid}>
          {filtered.map((item: any) => {
            const hasVariants = item.variants && item.variants.length > 0;
            const qty = hasVariants
              ? [...cart.entries()].filter(([k]) => k.startsWith(item.id + '::') || k === item.id).reduce((s, [, v]) => s + v, 0)
              : cart.get(item.id) || 0;
            const isFav = favorites.has(item.id);
            return (
              <View key={item.id} style={[styles.card, { width: cardWidth } as any]}>
                <Pressable
                  onPress={() => hasVariants && setSelectedVariantItem(item)}
                  style={styles.cardImageWrap}
                >
                  <Image source={{ uri: getMenuImage(item) }} style={styles.cardImage} />
                  {/* Heart toggle — lucide-react-native Heart */}
                  <TouchableOpacity
                    onPress={() => toggleFav(item.id)}
                    activeOpacity={0.8}
                    style={[styles.heartBtn, isFav ? styles.heartBtnFav : styles.heartBtnIdle]}
                  >
                    <Heart
                      size={14}
                      color={isFav ? '#fff' : '#A8A29E'}
                      fill={isFav ? '#fff' : 'transparent'}
                    />
                  </TouchableOpacity>
                  {/* Price badge */}
                  <View style={styles.priceBadge}>
                    <Text style={styles.priceBadgeText}>
                      ₱{item.price}
                      {hasVariants ? ' ›' : ''}
                    </Text>
                  </View>
                  {hasVariants ? (
                    <View style={styles.sizesBadge}>
                      <Text style={styles.sizesBadgeText}>Sizes</Text>
                    </View>
                  ) : null}
                </Pressable>
                <View style={styles.cardBody}>
                  <Text style={styles.cardTitle} numberOfLines={1}>
                    {item.name}
                  </Text>
                  <Text style={styles.cardDesc} numberOfLines={2}>
                    {item.description}
                  </Text>
                  <View style={styles.cardFooter}>
                    <View style={styles.ratingRow}>
                      <Star size={12} color="#F59E0B" fill="#F59E0B" />
                      <Text style={styles.ratingText}>
                        {item.rating != null ? Number(item.rating).toFixed(1) : '—'} · {item.category_name || 'Popular'} ·{' '}
                        {item.rating_count ?? 0}
                      </Text>
                    </View>
                    {hasVariants ? (
                      <TouchableOpacity
                        onPress={() => setSelectedVariantItem(item)}
                        style={styles.chooseBtn}
                        activeOpacity={0.85}
                      >
                        <Text style={styles.chooseBtnText}>Choose size</Text>
                      </TouchableOpacity>
                    ) : qty === 0 ? (
                      <TouchableOpacity onPress={() => add(item.id)} style={styles.addBtn} activeOpacity={0.85}>
                        <Plus size={16} color="#fff" />
                      </TouchableOpacity>
                    ) : (
                      <View style={styles.stepper}>
                        <TouchableOpacity onPress={() => sub(item.id)} style={styles.stepperBtn}>
                          <Minus size={14} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.stepperQty}>{qty}</Text>
                        <TouchableOpacity onPress={() => add(item.id)} style={styles.stepperBtn}>
                          <Plus size={14} color="#fff" />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                  {/* Variant qty summary inline (when hasVariants, show per-size counts) */}
                  {hasVariants && qty > 0 ? (
                    <View style={styles.variantSummaryRow}>
                      {([...cart.entries()] as [string, number][])
                        .filter(([k]) => k.startsWith(item.id + '::'))
                        .map(([k, v]) => {
                          const variantId = k.split('::')[1];
                          const variant = (item.variants || []).find((vv: any) => vv.id === variantId);
                          return (
                            <View key={k} style={styles.variantChip}>
                              <Text style={styles.variantChipText}>
                                {variant?.name ?? variantId} ×{v}
                              </Text>
                              <TouchableOpacity onPress={() => sub(k)} style={styles.variantChipMinus}>
                                <Minus size={10} color="#57534E" />
                              </TouchableOpacity>
                              <TouchableOpacity onPress={() => addByKey(k)} style={styles.variantChipPlus}>
                                <Plus size={10} color="#fff" />
                              </TouchableOpacity>
                            </View>
                          );
                        })}
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>

        {filtered.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No items</Text>
            <Text style={styles.emptyDesc}>
              {activeCat === 'all' ? 'Menu is empty for this stall.' : 'No items in this category.'}
            </Text>
          </View>
        ) : null}

        {/* Last order live tracker — fork-card */}
        {lastOrder ? (
          <View style={styles.trackerCard}>
            <View style={styles.trackerHeader}>
              <Clock size={16} color={C.green} />
              <Text style={styles.trackerTitle}>
                {lastOrder.order.pickup_code} · {statusLabel(liveStatus || lastOrder.order.status)}
              </Text>
            </View>
            <View style={styles.trackerBarRow}>
              {ORDER_STEPS.map((step) => {
                const idx = ORDER_STEPS.indexOf((liveStatus || lastOrder.order.status) as any);
                const sIdx = ORDER_STEPS.indexOf(step);
                const done = sIdx <= idx;
                return <View key={step} style={[styles.trackerBar, done ? styles.trackerBarDone : styles.trackerBarIdle]} />;
              })}
            </View>
            <View style={styles.trackerLabels}>
              <Text style={styles.trackerLabel}>Ordered</Text>
              <Text style={styles.trackerLabel}>Paid</Text>
              <Text style={styles.trackerLabel}>Preparing</Text>
              <Text style={styles.trackerLabel}>Ready</Text>
              <Text style={styles.trackerLabel}>Done</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/orders' as any)} style={styles.trackerLink}>
              <ReceiptText size={14} color={C.green} />
              <Text style={styles.trackerLinkText}>View all in My Orders</Text>
              <ChevronRight size={14} color={C.green} />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Spacer for floating cart pill */}
        <View style={{ height: 24 + insets.bottom }} />
        </View>
      </ScrollView>

      {/* Floating cart pill — cream surface + green checkout, mirrors landing nav */}
      <View pointerEvents="box-none" style={[styles.cartBar, { paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.cartBarInner}>
          <View style={styles.cartBarLeft}>
            <View style={styles.cartBarTitleRow}>
              <ShoppingCart size={16} color={C.green} />
              <Text style={styles.cartBarTitle}>
                {cartItems.reduce((s, i) => s + i.qty, 0)} item{cartItems.reduce((s, i) => s + i.qty, 0) === 1 ? '' : 's'} · ₱{total.toFixed(2)}
                {currentStall && cartItems.length > 0 ? (
                  <Text style={styles.cartBarStall}> · {currentStall.name}</Text>
                ) : null}
              </Text>
            </View>
            <Text style={styles.cartBarDesc} numberOfLines={1}>
              {cartItems.map((i) => `${i.name}${(i as any).variantName ? ` (${(i as any).variantName})` : ''} ×${i.qty}`).join(' · ') ||
                'Add items to start your order'}
            </Text>
          </View>
          <TouchableOpacity
            disabled={cartItems.length === 0 || loading}
            onPress={checkout}
            activeOpacity={0.9}
            style={[styles.checkoutBtn, (cartItems.length === 0 || loading) && styles.checkoutBtnDisabled]}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={[styles.checkoutBtnText, (cartItems.length === 0 || loading) && styles.checkoutBtnTextDisabled]}>
                Checkout
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* McDo size modal — Small/Medium/Large for Matees/Potato Corner */}
      <Modal
        visible={!!selectedVariantItem}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedVariantItem(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setSelectedVariantItem(null)}>
          <Pressable style={styles.variantModalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.dragHandle} />
            <View style={styles.variantModalHeader}>
              <Image
                source={{ uri: selectedVariantItem ? getMenuImage(selectedVariantItem) : '' }}
                style={styles.variantModalImage}
              />
              <View style={styles.variantModalHeaderText}>
                <Text style={styles.variantModalTitle}>{selectedVariantItem?.name}</Text>
                <Text style={styles.variantModalDesc} numberOfLines={2}>
                  {selectedVariantItem?.description}
                </Text>
                <View style={styles.variantModalRatingRow}>
                  <Star size={12} color="#F59E0B" fill="#F59E0B" />
                  <Text style={styles.variantModalRatingText}>
                    {(selectedVariantItem as any)?.rating?.toFixed
                      ? (selectedVariantItem as any).rating.toFixed(1)
                      : (selectedVariantItem?.rating != null ? Number(selectedVariantItem.rating).toFixed(1) : '4.9')}{' '}
                    · {(selectedVariantItem as any)?.rating_count ?? selectedVariantItem?.rating_count ?? 0}
                  </Text>
                </View>
              </View>
            </View>

            <View style={styles.variantList}>
              <Text style={styles.variantListTitle}>Choose size</Text>
              {(selectedVariantItem?.variants || []).map((v: any) => (
                <TouchableOpacity
                  key={v.id}
                  onPress={() => add(selectedVariantItem!.id, v)}
                  activeOpacity={0.85}
                  style={styles.variantOption}
                >
                  <View>
                    <Text style={styles.variantOptionName}>{v.name}</Text>
                    <Text style={styles.variantOptionPrice}>₱{v.price}</Text>
                  </View>
                  <View style={styles.variantOptionPlus}>
                    <Plus size={14} color="#fff" />
                  </View>
                </TouchableOpacity>
              ))}
              {(!selectedVariantItem?.variants || selectedVariantItem.variants.length === 0) && (
                <View style={styles.noSizes}>
                  <Text style={styles.noSizesText}>No sizes — add directly</Text>
                </View>
              )}
            </View>

            <View style={styles.variantModalFooter}>
              <TouchableOpacity onPress={() => setSelectedVariantItem(null)} style={styles.closeBtn}>
                <Text style={styles.closeBtnText}>Close</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ---------------------------------------------------------------------------
// StyleSheet — CampusBITE theme (matches landing: deep green, warm cream, pills)
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.page },
  container: { paddingBottom: 110 },
  body: { padding: 16, gap: 14, marginTop: -22, backgroundColor: C.page, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet },

  // Full-bleed hero
  hero: { minHeight: 300, backgroundColor: C.ink, justifyContent: 'space-between', paddingBottom: 44, overflow: 'hidden' },
  heroScrimBottom: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%', backgroundColor: 'rgba(0,0,0,0.30)' },
  heroTopRow: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 16 },
  heroCircle: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  heroCopy: { paddingHorizontal: 20, marginTop: 40 },
  heroEyebrow: { color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '500' },
  heroTitle: { color: '#fff', fontSize: 36, lineHeight: 38, fontWeight: '700', letterSpacing: -0.8, marginTop: 6 },
  heroDesc: { color: 'rgba(255,255,255,0.92)', fontSize: 15, lineHeight: 20, marginTop: 6 },
  heroMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 8 },
  heroMeta: { color: 'rgba(255,255,255,0.88)', fontSize: 13 },
  heroMetaDot: { color: 'rgba(255,255,255,0.5)', marginHorizontal: 4 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  qrModalCard: { backgroundColor: C.card, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, padding: 22, paddingBottom: 32, alignItems: 'center' },
  qrModalHeader: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  qrModalTitle: { fontSize: 20, fontWeight: '700', color: C.ink },
  qrModalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F5F5F4', alignItems: 'center', justifyContent: 'center' },
  qrBox: { backgroundColor: '#fff', padding: 14, borderRadius: 18, borderWidth: 1, borderColor: C.line, alignItems: 'center', justifyContent: 'center' },
  qrMonoBox: { marginTop: 14, backgroundColor: C.page, borderWidth: 1, borderColor: C.line, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 8, width: '100%' },
  qrMonoText: { fontSize: 11, color: C.inkSoft, fontFamily: 'monospace', textAlign: 'center' },
  qrHint: { fontSize: 12, color: C.muted, marginTop: 8, textAlign: 'center' },
  copyBtn: { marginTop: 12, width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: C.card, borderWidth: 1, borderColor: C.line, paddingVertical: 13, borderRadius: R.pill },
  copyBtnActive: { backgroundColor: C.green, borderColor: C.green },
  copyBtnText: { fontSize: 14, fontWeight: '700', color: C.ink },
  copyBtnTextActive: { color: '#fff' },

  // Stall switcher
  stallSwitcherRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  stallPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill, borderWidth: 1 },
  stallPillActive: { backgroundColor: C.green, borderColor: C.green },
  stallPillIdle: { backgroundColor: C.card, borderColor: C.line },
  stallPillLocked: { backgroundColor: C.page, borderColor: C.line, opacity: 0.5 },
  stallLogo: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
  stallPillText: { fontSize: 13, fontWeight: '600', color: C.inkSoft },
  stallPillTextActive: { color: '#fff' },
  stallPillTextLocked: { color: '#A8A29E' },

  // Live order pill
  orderBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.greenSoft, borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 10 },
  dotPulse: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981' },
  orderBadgeText: { flex: 1, fontSize: 13, fontWeight: '600', color: C.green },
  orderBadgeBold: { fontWeight: '800', letterSpacing: 1 },

  // Categories
  categoriesRow: { gap: 8, paddingRight: 16 },
  catPill: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: R.pill, borderWidth: 1 },
  catPillActive: { backgroundColor: C.green, borderColor: C.green },
  catPillIdle: { backgroundColor: C.card, borderColor: C.line },
  catPillText: { fontSize: 13, fontWeight: '600', color: C.inkSoft },
  catPillTextActive: { color: '#fff' },

  // Menu grid
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: { width: '48%', backgroundColor: C.card, borderRadius: R.card, overflow: 'hidden', borderWidth: 1, borderColor: C.line, ...shadow.card },
  cardImageWrap: { height: 160, backgroundColor: '#F5F5F4', overflow: 'hidden' },
  cardImage: { width: '100%', height: '100%' },
  heartBtn: { position: 'absolute', top: 10, right: 10, width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  heartBtnFav: { backgroundColor: '#EF4444', borderColor: '#EF4444' },
  heartBtnIdle: { backgroundColor: 'rgba(255,255,255,0.92)', borderColor: 'rgba(255,255,255,0.6)' },
  priceBadge: { position: 'absolute', bottom: 10, left: 10, backgroundColor: C.cream, paddingHorizontal: 10, paddingVertical: 5, borderRadius: R.pill },
  priceBadgeText: { fontSize: 13, fontWeight: '800', color: C.green },
  sizesBadge: { position: 'absolute', top: 10, left: 10, backgroundColor: 'rgba(255,255,255,0.92)', paddingHorizontal: 8, paddingVertical: 3, borderRadius: R.pill },
  sizesBadgeText: { fontSize: 10, fontWeight: '700', color: C.ink },
  cardBody: { padding: 14 },
  cardTitle: { fontSize: 16, fontWeight: '700', color: C.ink, letterSpacing: -0.3 },
  cardDesc: { fontSize: 12, color: C.muted, marginTop: 4, minHeight: 30, lineHeight: 15 },
  cardFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 },
  ratingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 1, minWidth: 0, marginRight: 8 },
  ratingText: { fontSize: 11, color: C.muted, flex: 1 },
  chooseBtn: { backgroundColor: C.green, paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill },
  chooseBtnText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  stepper: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.green, borderRadius: R.pill, padding: 4, gap: 2 },
  stepperBtn: { width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(255,255,255,0.18)', alignItems: 'center', justifyContent: 'center' },
  stepperQty: { width: 24, textAlign: 'center', fontSize: 14, fontWeight: '800', color: '#fff' },

  variantSummaryRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  variantChip: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: C.greenSoft, borderRadius: R.pill, paddingLeft: 10, paddingRight: 3, paddingVertical: 3 },
  variantChipText: { fontSize: 11, fontWeight: '700', color: C.green },
  variantChipMinus: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  variantChipPlus: { width: 24, height: 24, borderRadius: 12, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },

  emptyCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: R.card, padding: 24, alignItems: 'center' },
  emptyTitle: { fontSize: 15, fontWeight: '700', color: C.ink },
  emptyDesc: { fontSize: 13, color: C.muted, marginTop: 4, textAlign: 'center' },

  // Tracker
  trackerCard: { backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: R.card, padding: 18, ...shadow.card },
  trackerHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  trackerTitle: { fontSize: 16, fontWeight: '800', color: C.ink },
  trackerBarRow: { flexDirection: 'row', gap: 6, marginTop: 14 },
  trackerBar: { flex: 1, height: 6, borderRadius: 3 },
  trackerBarDone: { backgroundColor: C.green },
  trackerBarIdle: { backgroundColor: C.line },
  trackerLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  trackerLabel: { fontSize: 10, fontWeight: '600', color: C.muted },
  trackerLink: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 14, alignSelf: 'flex-start' },
  trackerLinkText: { fontSize: 13, fontWeight: '700', color: C.green },

  // Floating cart pill
  cartBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, alignItems: 'center' },
  cartBarInner: { width: '100%', maxWidth: 560, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.cream, borderRadius: R.pill, padding: 6, paddingLeft: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', ...shadow.float },
  cartBarLeft: { flex: 1, minWidth: 0 },
  cartBarTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cartBarTitle: { fontSize: 14, fontWeight: '800', color: C.green },
  cartBarStall: { fontWeight: '500', color: C.muted },
  cartBarDesc: { fontSize: 11, color: C.muted, marginTop: 2 },
  checkoutBtn: { backgroundColor: C.green, paddingHorizontal: 24, paddingVertical: 15, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center', minWidth: 120 },
  checkoutBtnDisabled: { backgroundColor: '#DDD8CB' },
  checkoutBtnText: { fontSize: 15, fontWeight: '800', color: '#fff' },
  checkoutBtnTextDisabled: { color: '#A8A29E' },

  // Size sheet
  variantModalCard: { backgroundColor: C.card, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, maxHeight: '80%', paddingBottom: 24 },
  dragHandle: { width: 40, height: 6, borderRadius: 3, backgroundColor: C.line, alignSelf: 'center', marginTop: 10, marginBottom: 14 },
  variantModalHeader: { flexDirection: 'row', gap: 14, paddingHorizontal: 20 },
  variantModalImage: { width: 80, height: 80, borderRadius: 16, backgroundColor: '#F5F5F4' },
  variantModalHeaderText: { flex: 1, minWidth: 0 },
  variantModalTitle: { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: -0.3 },
  variantModalDesc: { fontSize: 13, color: C.muted, marginTop: 4, lineHeight: 17 },
  variantModalRatingRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6 },
  variantModalRatingText: { fontSize: 12, color: C.muted, fontWeight: '600' },
  variantList: { paddingHorizontal: 20, marginTop: 18, gap: 10 },
  variantListTitle: { fontSize: 14, fontWeight: '700', color: C.ink },
  variantOption: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 12, paddingHorizontal: 16, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  variantOptionName: { fontSize: 15, fontWeight: '700', color: C.ink },
  variantOptionPrice: { fontSize: 12, color: C.muted, marginTop: 2 },
  variantOptionPlus: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  noSizes: { paddingVertical: 16, alignItems: 'center' },
  noSizesText: { fontSize: 13, color: C.muted },
  variantModalFooter: { paddingHorizontal: 20, paddingTop: 14, marginTop: 16, borderTopWidth: 1, borderTopColor: '#F5F5F4' },
  closeBtn: { paddingVertical: 14, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, alignItems: 'center', backgroundColor: C.card },
  closeBtnText: { fontSize: 14, fontWeight: '700', color: C.ink },

  // Diagnostics / loading
  diagCard: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 18, padding: 14 },
  diagHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  diagTitle: { fontSize: 13, fontWeight: '800', color: '#991B1B' },
  diagText: { fontSize: 12, color: '#7F1D1D', marginTop: 6, lineHeight: 16 },
  diagMono: { fontSize: 10, color: '#57534E', fontFamily: 'monospace', marginTop: 6 },
  diagBtn: { marginTop: 10, backgroundColor: C.green, paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill, flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
  diagBtnText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  loadingRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  loadingText: { fontSize: 12, color: C.muted },
});
