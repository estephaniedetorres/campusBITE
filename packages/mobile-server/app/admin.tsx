import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Pressable,
} from 'react-native';
import { Link, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Boxes,
  TriangleAlert as AlertTriangle,
  TrendingUp,
  ClipboardCheck,
  Plus,
  Trash2,
  Store,
  Utensils,
  SquarePen as Edit2,
  Users,
  Shield,
  LogIn,
  QrCode,
  Image as ImageIcon,
  Upload,
  Link as LinkIcon,
  X,
  Copy,
  Printer,
} from 'lucide-react-native';
import { getApiBase, setToken } from '../constants/api';
import { C, R, shadow } from '../constants/theme';
import { StaffScreen, StaffHero, StaffGate, STAFF_HERO_IMAGES } from '../src/components/StaffChrome';
import { SvgXml } from 'react-native-svg';
import QRCode from 'qrcode';

// ---------------------------------------------------------------------------
// Types — mirrors web AdminPage.tsx + auth
// ---------------------------------------------------------------------------
type Tab = 'menu' | 'inventory' | 'bom' | 'audits' | 'analytics' | 'users';

type AuthUser = {
  id: string;
  username: string;
  role: 'ADMIN' | 'STALL_OWNER';
  stall_id: string | null;
  stall_name: string | null;
  display_name: string;
};

// ---------------------------------------------------------------------------
// Auth hook — AsyncStorage hybrid auth (campusbite_user / campusbite_token)
// ---------------------------------------------------------------------------
function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const rawUser = await AsyncStorage.getItem('campusbite_user');
        const rawToken = await AsyncStorage.getItem('campusbite_token');
        if (!mounted) return;
        if (rawUser) {
          try {
            const parsed: AuthUser = JSON.parse(rawUser);
            setUser(parsed);
            if (!rawToken && parsed?.id) {
              setTokenState(parsed.id);
              setToken(parsed.id);
            }
          } catch {}
        }
        if (rawToken) {
          setTokenState(rawToken);
          setToken(rawToken);
        }
      } catch {
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { user, token, loading };
}

// ---------------------------------------------------------------------------
// Authed fetch helpers — mirrors packages/web-client/src/lib/api.ts
// Uses getApiBase() + x-user-id header (hybrid auth)
// ---------------------------------------------------------------------------
  async function fallbackFetch(path: string, init?: RequestInit): Promise<Response> {
    const base = getApiBase();
    let url = `${base}${path}`;
    if (!base && typeof window === 'undefined') url = `http://localhost:3000${path}`;
    try {
      const res = await fetch(url, init as any);
      const ct = res.headers.get('content-type') || '';
      const t = await res.clone().text().catch(()=> '');
      if (!ct.includes('application/json') && (t.trim().startsWith('<!') || t.trim().startsWith('<html'))) {
        const fb = `http://localhost:3000${path}`;
        const r2 = await fetch(fb, init as any);
        if (r2.headers.get('content-type')?.includes('application/json') || r2.ok) return r2;
      }
      return res;
    } catch {
      const fb = `http://localhost:3000${path}`;
      return fetch(fb, init as any);
    }
  }
  async function authedGet(path: string, token: string | null): Promise<any> {
    const headers: Record<string, string> = {};
    if (token) headers['x-user-id'] = token;
    const res = await fallbackFetch(path, { headers });
    if (!res.ok) {
      const text = await res.text();
      let body: any;
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
      throw new Error(typeof body === 'string' ? body : body.error || JSON.stringify(body));
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  }
  async function authedPost(path: string, body: any, token: string | null): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['x-user-id'] = token;
    const res = await fallbackFetch(path, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    } as any);
    if (!res.ok) {
      const text = await res.text();
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
      throw new Error(typeof payload === 'string' ? payload : payload.error || JSON.stringify(payload));
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  }
  async function authedPatch(path: string, body: any, token: string | null): Promise<any> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) headers['x-user-id'] = token;
    const res = await fallbackFetch(path, {
      method: 'PATCH',
      headers,
      body: JSON.stringify(body),
    } as any);
    if (!res.ok) {
      const text = await res.text();
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
      throw new Error(typeof payload === 'string' ? payload : payload.error || JSON.stringify(payload));
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  }
  async function authedDel(path: string, token: string | null): Promise<any> {
    const headers: Record<string, string> = {};
    if (token) headers['x-user-id'] = token;
    const res = await fallbackFetch(path, { method: 'DELETE', headers } as any);
    if (!res.ok) {
      const text = await res.text();
      let payload: any;
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
      throw new Error(typeof payload === 'string' ? payload : payload.error || JSON.stringify(payload));
    }
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('application/json')) return res.json();
    return res.text();
  }

// ---------------------------------------------------------------------------
// QrSvg — react-native-svg + qrcode (same as kiosk.tsx)
// ---------------------------------------------------------------------------
function QrSvg({ value, size }: { value: string; size: number }) {
  const [xml, setXml] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    const opts: any = { type: 'svg', margin: 1, width: size, errorCorrectionLevel: 'M' };
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
      <View style={{ width: size, height: size, backgroundColor: '#F5F5F4', borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#E7E5E4' }}>
        <ActivityIndicator color="#57534E" />
      </View>
    );
  }
  return <SvgXml xml={xml} width={size} height={size} />;
}

// ---------------------------------------------------------------------------
// AdminOnly
// ---------------------------------------------------------------------------
function AdminOnly() {
  return (
    <View style={styles.forkCard}>
      <View style={styles.adminOnlyIcon}>
        <Shield size={22} color="#A8A29E" />
      </View>
      <Text style={styles.adminOnlyTitle}>Restricted</Text>
      <Text style={styles.adminOnlySub}>Admin access required</Text>
    </View>
  );
}

// ===========================================================================
// Main AdminPage — port of web AdminPage.tsx
// Keeps all logic: hybrid auth, 6 tabs (menu/inventory/bom/audits/analytics/users),
// menu: stall/category/menu CRUD + QR + imageUrl + toggleAvail + edit modal,
// inventory/BOM/audits/analytics/users each preserved. RN components,
// lucide-react-native, AsyncStorage, StyleSheet Fork UI, expo-router, getApiBase.
// ===========================================================================
export default function AdminPage() {
  const { user, token, loading } = useAuth();
  const [tab, setTab] = useState<Tab>('menu');
  const isAdmin = user?.role === 'ADMIN';
  const tabs: { k: Tab; l: string; adminOnly?: boolean }[] = [
    { k: 'menu', l: 'Menu' },
    { k: 'inventory', l: 'Ingredients', adminOnly: true },
    { k: 'bom', l: 'Recipe BOM', adminOnly: true },
    { k: 'audits', l: 'EOD Audits', adminOnly: true },
    { k: 'analytics', l: 'Analytics', adminOnly: true },
    { k: 'users', l: 'Users', adminOnly: true },
  ];
  const visibleTabs = tabs.filter((t) => !t.adminOnly || isAdmin);
  const icons: Record<Tab, any> = {
    menu: Utensils,
    inventory: Boxes,
    bom: ClipboardCheck,
    audits: AlertTriangle,
    analytics: TrendingUp,
    users: Users,
  };

  // Keep STALL_OWNER on menu if they switch away then auth changes — must be before early returns (hooks order)
  useEffect(() => {
    if (!isAdmin && tab !== 'menu') setTab('menu');
  }, [isAdmin, tab]);

  if (loading) {
    return (
      <View style={[styles.safe, styles.center]}>
        <ActivityIndicator color="#1C1917" />
        <Text style={styles.loadingText}>Loading Admin…</Text>
      </View>
    );
  }

  if (!user) return <StaffGate title="Admin" image={STAFF_HERO_IMAGES.admin} />;

  const tabTitle = visibleTabs.find((t) => t.k === tab)?.l ?? 'Menu';

  return (
    <StaffScreen
      hero={
        <StaffHero image={STAFF_HERO_IMAGES.admin} eyebrow={isAdmin ? 'Admin · All stalls' : `Admin · ${user.stall_name ?? '—'}`}
          title={tabTitle} subtitle={isAdmin ? 'Manage stalls, menus, stock and staff.' : 'Manage your menu, prices and stall QR.'} user={user} compact />
      }
    >
      {/* Tabs — cream segmented pill, same as the floating nav */}
      {visibleTabs.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
          {visibleTabs.map((t) => {
            const Icon: any = icons[t.k];
            const active = tab === t.k;
            return (
              <TouchableOpacity key={t.k} onPress={() => setTab(t.k)} activeOpacity={0.85}
                style={[styles.tabPill, active ? styles.tabPillActive : styles.tabPillIdle]}
                accessibilityRole="tab" accessibilityState={{ selected: active }}>
                <Icon size={16} color={active ? '#fff' : C.green} />
                <Text style={[styles.tabText, active ? styles.tabTextActive : styles.tabTextIdle]}>{t.l}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      ) : null}

      {tab === 'menu' && <MenuManagementTab token={token} user={user} />}
      {tab === 'inventory' && (isAdmin ? <InventoryTab token={token} /> : <AdminOnly />)}
      {tab === 'bom' && (isAdmin ? <BomTab token={token} /> : <AdminOnly />)}
      {tab === 'audits' && (isAdmin ? <AuditTab token={token} /> : <AdminOnly />)}
      {tab === 'analytics' && (isAdmin ? <AnalyticsTab token={token} /> : <AdminOnly />)}
      {tab === 'users' && (isAdmin ? <UsersTab token={token} /> : <AdminOnly />)}
    </StaffScreen>
  );
}

// ===========================================================================
// MENU MANAGEMENT TAB
// ===========================================================================
function MenuManagementTab({ token, user }: { token: string | null; user: AuthUser }) {
  const isAdmin = user?.role === 'ADMIN';
  const [stalls, setStalls] = useState<any[]>([]);
  const [selectedStall, setSelectedStall] = useState<string>('');
  const [categories, setCategories] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const [newStall, setNewStall] = useState({ name: '', description: '' });
  const [newCat, setNewCat] = useState({ name: '', displayOrder: '0' });
  const [newItem, setNewItem] = useState({ name: '', price: '', description: '', categoryId: '', isAvailable: '1', imageUrl: '' });
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [error, setError] = useState('');
  const [health, setHealth] = useState<any>(null);

  const loadStalls = useCallback(async () => {
    try {
      const s = await authedGet('/api/stalls', token);
      setStalls(Array.isArray(s) ? s : []);
      if (user?.role === 'STALL_OWNER' && user.stall_id) {
        setSelectedStall(user.stall_id);
      } else if (!selectedStall && s[0]) setSelectedStall(s[0].id);
    } catch {}
  }, [token, user?.role, user?.stall_id, selectedStall]);

  const loadDetails = useCallback(
    async (stId: string) => {
      if (!stId) return;
      try {
        const [cats, items] = await Promise.all([
          authedGet(`/api/categories?stallId=${stId}`, token),
          authedGet(`/api/menu?stallId=${stId}&includeUnavailable=1`, token),
        ]);
        setCategories(Array.isArray(cats) ? cats : []);
        setMenu(Array.isArray(items) ? items : []);
        if (Array.isArray(cats) && cats[0] && !newItem.categoryId) setNewItem((prev) => ({ ...prev, categoryId: cats[0].id }));
      } catch {}
    },
    [token, newItem.categoryId]
  );

  useEffect(() => {
    loadStalls();
  }, [loadStalls]);
  useEffect(() => {
    authedGet('/api/health', token).then(setHealth).catch(() => {});
  }, [token]);
  useEffect(() => {
    if (selectedStall) loadDetails(selectedStall);
  }, [selectedStall, loadDetails]);

  const visibleStalls = isAdmin ? stalls : stalls.filter((s) => s.id === user?.stall_id);

  async function createStall() {
    setError('');
    if (!newStall.name.trim()) {
      setError('Stall name required');
      return;
    }
    try {
      await authedPost('/api/stalls', { name: newStall.name.trim(), description: newStall.description.trim() }, token);
      setNewStall({ name: '', description: '' });
      await loadStalls();
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }
  async function createCat() {
    setError('');
    if (!newCat.name.trim()) {
      setError('Category name required');
      return;
    }
    try {
      await authedPost('/api/categories', { stallId: selectedStall, name: newCat.name.trim(), displayOrder: Number(newCat.displayOrder) || 0 }, token);
      setNewCat({ name: '', displayOrder: '0' });
      await loadDetails(selectedStall);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }
  async function createItem() {
    setError('');
    if (!newItem.name.trim() || !newItem.price || !newItem.categoryId) {
      setError('Name, price and category required');
      return;
    }
    try {
      await authedPost(
        '/api/menu',
        {
          stallId: selectedStall,
          categoryId: newItem.categoryId,
          name: newItem.name.trim(),
          description: newItem.description.trim(),
          price: Number(newItem.price),
          isAvailable: Number(newItem.isAvailable),
          imageUrl: newItem.imageUrl || null,
        },
        token
      );
      setNewItem({ name: '', price: '', description: '', categoryId: categories[0]?.id || '', isAvailable: '1', imageUrl: '' });
      await loadDetails(selectedStall);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }
  async function toggleAvailability(item: any) {
    try {
      await authedPatch(`/api/menu/${item.id}`, { isAvailable: item.is_available ? 0 : 1 }, token);
      await loadDetails(selectedStall);
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? String(e));
    }
  }
  async function deleteItem(id: string) {
    Alert.alert('Delete menu item?', 'This also removes its recipe BOM.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await authedDel(`/api/menu/${id}`, token);
            await loadDetails(selectedStall);
          } catch (e: any) {
            Alert.alert('Failed', e?.message ?? String(e));
          }
        },
      },
    ]);
  }
  async function deleteCat(id: string) {
    Alert.alert('Delete category?', 'Only works if empty.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await authedDel(`/api/categories/${id}`, token);
            await loadDetails(selectedStall);
          } catch (e: any) {
            Alert.alert('Failed', e?.message ?? String(e));
          }
        },
      },
    ]);
  }
  async function saveEdit() {
    if (!editingItem) return;
    try {
      await authedPatch(
        `/api/menu/${editingItem.id}`,
        {
          name: editingItem.name,
          price: Number(editingItem.price),
          description: editingItem.description,
          categoryId: editingItem.category_id,
          isAvailable: Number(editingItem.is_available),
          imageUrl: editingItem.image_url || null,
        },
        token
      );
      setEditingItem(null);
      await loadDetails(selectedStall);
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? String(e));
    }
  }

  return (
    <View style={styles.tabContent}>
      {/* Stalls */}
      <View style={styles.forkCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Store size={14} color="#fff" />
          </View>
          <Text style={styles.sectionTitle}>Stalls</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.stallChips}>
          {visibleStalls.map((s) => (
            <TouchableOpacity
              key={s.id}
              onPress={() => setSelectedStall(s.id)}
              activeOpacity={0.85}
              style={[styles.stallChip, selectedStall === s.id ? styles.stallChipActive : styles.stallChipIdle]}
            >
              {s.logo_url ? <Image source={{ uri: s.logo_url }} style={styles.stallChipLogo} /> : null}
              <Text style={[styles.stallChipText, selectedStall === s.id ? styles.stallChipTextActive : null]} numberOfLines={1}>
                {s.name}
              </Text>
              <Text style={[styles.stallChipId, selectedStall === s.id ? { color: 'rgba(255,255,255,0.6)' } : null]}>({s.id})</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        {visibleStalls.length === 0 ? <Text style={styles.emptySmall}>No stalls</Text> : null}

        {isAdmin && (
          <View style={styles.rowInputs}>
            <TextInput
              value={newStall.name}
              onChangeText={(t) => setNewStall({ ...newStall, name: t })}
              placeholder="New stall name"
              placeholderTextColor="#A8A29E"
              style={[styles.input, { flex: 1 }]}
            />
            <TextInput
              value={newStall.description}
              onChangeText={(t) => setNewStall({ ...newStall, description: t })}
              placeholder="Description"
              placeholderTextColor="#A8A29E"
              style={[styles.input, { flex: 1 }]}
            />
            <TouchableOpacity onPress={createStall} style={styles.btnDarkSmall} activeOpacity={0.85}>
              <Plus size={14} color="#fff" />
              <Text style={styles.btnDarkSmallText}>Add Stall</Text>
            </TouchableOpacity>
          </View>
        )}
        {error ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}
      </View>

      {/* QR Codes */}
      <View style={styles.forkCard}>
        <View style={styles.sectionHeader}>
          <View style={[styles.sectionIcon, { backgroundColor: '#0F766E' }]}>
            <QrCode size={14} color="#fff" />
          </View>
          <Text style={styles.sectionTitle}>QR Codes</Text>
        </View>
        <View style={styles.qrGrid}>
          {visibleStalls.map((s: any) => {
            const base = getApiBase();
            const url = `${base}/kiosk?stall=${s.id}`;
            return (
              <View key={s.id} style={styles.qrCard}>
                <View style={styles.qrImageWrap}>
                  <QrSvg value={url} size={96} />
                </View>
                <View style={styles.qrMeta}>
                  <View style={styles.qrMetaRow}>
                    {s.logo_url ? <Image source={{ uri: s.logo_url }} style={styles.qrLogo} /> : null}
                    <Text style={styles.qrName}>{s.name}</Text>
                  </View>
                  <Text style={styles.qrUrl} numberOfLines={2} selectable>
                    {url}
                  </Text>
                  <View style={styles.qrActions}>
                    <TouchableOpacity
                      onPress={() => Alert.alert('QR URL', url, [{ text: 'OK' }])}
                      style={styles.qrBtnGhost}
                      activeOpacity={0.85}
                    >
                      <Copy size={12} color="#44403C" />
                      <Text style={styles.qrBtnGhostText}>Show URL</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => Alert.alert('Print', 'Use screenshot to print QR in Expo Go')} style={styles.qrBtnDark} activeOpacity={0.85}>
                      <Printer size={12} color="#fff" />
                      <Text style={styles.qrBtnDarkText}>Print</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })}
        </View>
        {visibleStalls.length === 0 ? <Text style={styles.emptySmall}>No stalls</Text> : null}
      </View>

      {/* Categories + Add Menu */}
      <View style={styles.twoCol}>
        <View style={[styles.forkCard, { flex: 1, minWidth: 280 }]}>
          <Text style={styles.sectionTitle}>Categories — {stalls.find((s) => s.id === selectedStall)?.name || ''}</Text>
          <ScrollView style={{ maxHeight: 260 }} showsVerticalScrollIndicator={false}>
            <View style={styles.catList}>
              {categories.map((cat) => (
                <View key={cat.id} style={styles.catRow}>
                  <View style={styles.catMeta}>
                    <Text style={styles.catName}>{cat.name}</Text>
                    <Text style={styles.catSub}>order {cat.display_order} · {cat.id}</Text>
                  </View>
                  <TouchableOpacity onPress={() => deleteCat(cat.id)} style={styles.iconBtn} activeOpacity={0.85}>
                    <Trash2 size={14} color="#A8A29E" />
                  </TouchableOpacity>
                </View>
              ))}
              {categories.length === 0 ? (
                <View style={styles.emptyDashed}>
                  <Text style={styles.emptyDashedText}>No categories</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
          <View style={styles.rowInputs}>
            <TextInput
              value={newCat.name}
              onChangeText={(t) => setNewCat({ ...newCat, name: t })}
              placeholder="Category name"
              placeholderTextColor="#A8A29E"
              style={[styles.input, { flex: 1 }]}
            />
            <TextInput
              value={newCat.displayOrder}
              onChangeText={(t) => setNewCat({ ...newCat, displayOrder: t })}
              placeholder="Order"
              placeholderTextColor="#A8A29E"
              keyboardType="number-pad"
              style={[styles.input, { width: 72, textAlign: 'center' }]}
            />
            <TouchableOpacity onPress={createCat} style={styles.btnDarkSmall} activeOpacity={0.85}>
              <Text style={styles.btnDarkSmallText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.forkCard, { flex: 1, minWidth: 280 }]}>
          <Text style={styles.sectionTitle}>Add Menu Item — {stalls.find((s) => s.id === selectedStall)?.name || ''}</Text>
          <View style={styles.stack}>
            <TextInput
              value={newItem.name}
              onChangeText={(t) => setNewItem({ ...newItem, name: t })}
              placeholder="Item name (e.g. Spicy Burger)"
              placeholderTextColor="#A8A29E"
              style={styles.input}
            />
            <View style={styles.row2}>
              <TextInput
                value={newItem.price}
                onChangeText={(t) => setNewItem({ ...newItem, price: t })}
                placeholder="Price ₱"
                placeholderTextColor="#A8A29E"
                keyboardType="number-pad"
                style={[styles.input, { flex: 1 }]}
              />
              <View style={[styles.pickerWrap, { flex: 1 }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flex: 1 }}>
                  <View style={styles.pickerChips}>
                    <TouchableOpacity
                      onPress={() => {}}
                      style={[styles.pickerChip, !newItem.categoryId ? styles.pickerChipActive : null]}
                      activeOpacity={0.85}
                    >
                      <Text style={[styles.pickerText, !newItem.categoryId ? styles.pickerTextActive : null]}>Category</Text>
                    </TouchableOpacity>
                    {categories.map((c) => (
                      <TouchableOpacity
                        key={c.id}
                        onPress={() => setNewItem({ ...newItem, categoryId: c.id })}
                        style={[styles.pickerChip, newItem.categoryId === c.id ? styles.pickerChipActive : null]}
                        activeOpacity={0.85}
                      >
                        <Text style={[styles.pickerText, newItem.categoryId === c.id ? styles.pickerTextActive : null]}>{c.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </ScrollView>
              </View>
            </View>
            <TextInput
              value={newItem.description}
              onChangeText={(t) => setNewItem({ ...newItem, description: t })}
              placeholder="Description"
              placeholderTextColor="#A8A29E"
              style={styles.input}
            />
            <View style={styles.rowInputs}>
              <View style={styles.inputIconWrap}>
                <LinkIcon size={14} color="#A8A29E" />
                <TextInput
                  value={newItem.imageUrl}
                  onChangeText={(t) => setNewItem({ ...newItem, imageUrl: t })}
                  placeholder="Image URL (https://...)"
                  placeholderTextColor="#A8A29E"
                  autoCapitalize="none"
                  autoCorrect={false}
                  style={styles.inputIconInput}
                />
              </View>
              <View style={styles.uploadHint}>
                <Upload size={14} color="#57534E" />
                <Text style={styles.uploadHintText}>Paste URL</Text>
              </View>
            </View>
            {newItem.imageUrl ? (
              <View style={styles.previewWrap}>
                <Image source={{ uri: newItem.imageUrl }} style={styles.previewImage} />
                <TouchableOpacity onPress={() => setNewItem({ ...newItem, imageUrl: '' })} style={styles.previewRemove} activeOpacity={0.85}>
                  <Text style={styles.previewRemoveText}>Remove</Text>
                </TouchableOpacity>
              </View>
            ) : null}
            <View style={styles.rowInputs}>
              <View style={styles.availChips}>
                <TouchableOpacity onPress={() => setNewItem({ ...newItem, isAvailable: '1' })} style={[styles.availChip, newItem.isAvailable === '1' ? styles.availChipActive : null]} activeOpacity={0.85}>
                  <Text style={[styles.availText, newItem.isAvailable === '1' ? styles.availTextActive : null]}>Available</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setNewItem({ ...newItem, isAvailable: '0' })} style={[styles.availChip, newItem.isAvailable === '0' ? styles.availChipActive : null]} activeOpacity={0.85}>
                  <Text style={[styles.availText, newItem.isAvailable === '0' ? styles.availTextActive : null]}>Hidden</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={createItem} style={[styles.btnDark, { flex: 1 }]} activeOpacity={0.85}>
                <Plus size={16} color="#fff" />
                <Text style={styles.btnDarkText}>Add Item</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>

      {/* Menu table */}
      <View style={[styles.forkCard, { padding: 0, overflow: 'hidden' }]}>
        <View style={styles.tableHeader}>
          <Text style={styles.tableTitle}>Menu Items — {menu.length} items</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: 640 }}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { width: 70 }]}>Image</Text>
              <Text style={[styles.th, { flex: 1, minWidth: 140 }]}>Item</Text>
              <Text style={[styles.th, { width: 100 }]}>Category</Text>
              <Text style={[styles.th, { width: 80 }]}>Price</Text>
              <Text style={[styles.th, { width: 90 }]}>Avail</Text>
              <Text style={[styles.th, { width: 90 }]}></Text>
            </View>
            {menu.map((it: any) => (
              <View key={it.id} style={styles.tr}>
                <View style={{ width: 70, alignItems: 'center' }}>
                  <View style={styles.thumb}>
                    {it.image_url ? (
                      <Image source={{ uri: it.image_url }} style={styles.thumbImage} />
                    ) : (
                      <View style={styles.thumbPlaceholder}>
                        <ImageIcon size={20} color="#A8A29E" />
                      </View>
                    )}
                  </View>
                </View>
                <View style={{ flex: 1, minWidth: 140, paddingRight: 8 }}>
                  <Text style={styles.tdName}>{it.name}</Text>
                  <Text style={styles.tdDesc} numberOfLines={1}>
                    {it.description || ''}
                  </Text>
                  <Text style={styles.tdMono}>{it.id}</Text>
                </View>
                <Text style={[styles.td, { width: 100 }]}>{it.category_name}</Text>
                <Text style={[styles.tdBold, { width: 80 }]}>₱{it.price}</Text>
                <View style={{ width: 90 }}>
                  <TouchableOpacity
                    onPress={() => toggleAvailability(it)}
                    activeOpacity={0.85}
                    style={[styles.badge, it.is_available ? styles.badgeGreen : styles.badgeStone]}
                  >
                    <Text style={[styles.badgeText, it.is_available ? { color: '#047857' } : { color: '#78716C' }]}>
                      {it.is_available ? 'Available' : 'Hidden'}
                    </Text>
                  </TouchableOpacity>
                </View>
                <View style={{ width: 90, flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity onPress={() => setEditingItem({ ...it })} style={styles.iconBtn} activeOpacity={0.85}>
                    <Edit2 size={14} color="#57534E" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => deleteItem(it.id)} style={[styles.iconBtn, { borderColor: '#FECACA' }]} activeOpacity={0.85}>
                    <Trash2 size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
        {menu.length === 0 ? <Text style={styles.emptyLarge}>No items</Text> : null}
      </View>

      {/* Edit modal */}
      <Modal visible={!!editingItem} transparent animationType="fade" onRequestClose={() => setEditingItem(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditingItem(null)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Edit — {editingItem?.id}</Text>
              <TouchableOpacity onPress={() => setEditingItem(null)} style={styles.modalClose} activeOpacity={0.85}>
                <X size={16} color="#57534E" />
              </TouchableOpacity>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.modalBody}>
              <TextInput value={editingItem?.name ?? ''} onChangeText={(t) => setEditingItem((p: any) => ({ ...p, name: t }))} placeholder="Name" placeholderTextColor="#A8A29E" style={styles.input} />
              <TextInput
                value={String(editingItem?.price ?? '')}
                onChangeText={(t) => setEditingItem((p: any) => ({ ...p, price: t }))}
                placeholder="Price"
                placeholderTextColor="#A8A29E"
                keyboardType="number-pad"
                style={styles.input}
              />
              <TextInput
                value={editingItem?.description ?? ''}
                onChangeText={(t) => setEditingItem((p: any) => ({ ...p, description: t }))}
                placeholder="Description"
                placeholderTextColor="#A8A29E"
                style={styles.input}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerChips}>
                {categories.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setEditingItem((p: any) => ({ ...p, category_id: c.id }))}
                    style={[styles.pickerChip, editingItem?.category_id === c.id ? styles.pickerChipActive : null]}
                    activeOpacity={0.85}
                  >
                    <Text style={[styles.pickerText, editingItem?.category_id === c.id ? styles.pickerTextActive : null]}>{c.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.inputIconWrap}>
                <LinkIcon size={14} color="#A8A29E" />
                <TextInput
                  value={editingItem?.image_url ?? ''}
                  onChangeText={(t) => setEditingItem((p: any) => ({ ...p, image_url: t }))}
                  placeholder="Image URL (https://...)"
                  placeholderTextColor="#A8A29E"
                  autoCapitalize="none"
                  style={styles.inputIconInput}
                />
              </View>
              <View style={styles.rowInputs}>
                <View style={styles.uploadHint}>
                  <Upload size={14} color="#57534E" />
                  <Text style={styles.uploadHintText}>{editingItem?.image_url ? 'Change URL' : 'Paste URL'}</Text>
                </View>
                {editingItem?.image_url ? (
                  <TouchableOpacity onPress={() => setEditingItem((p: any) => ({ ...p, image_url: '' }))} style={styles.btnGhost} activeOpacity={0.85}>
                    <Text style={styles.btnGhostText}>Clear</Text>
                  </TouchableOpacity>
                ) : null}
              </View>
              {editingItem?.image_url ? (
                <View style={styles.previewWrapLarge}>
                  <Image source={{ uri: editingItem.image_url }} style={styles.previewImageLarge} />
                </View>
              ) : null}
              <View style={styles.availChips}>
                <TouchableOpacity onPress={() => setEditingItem((p: any) => ({ ...p, is_available: 1 }))} style={[styles.availChip, editingItem?.is_available === 1 ? styles.availChipActive : null]} activeOpacity={0.85}>
                  <Text style={[styles.availText, editingItem?.is_available === 1 ? styles.availTextActive : null]}>Available</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setEditingItem((p: any) => ({ ...p, is_available: 0 }))} style={[styles.availChip, editingItem?.is_available === 0 ? styles.availChipActive : null]} activeOpacity={0.85}>
                  <Text style={[styles.availText, editingItem?.is_available === 0 ? styles.availTextActive : null]}>Hidden</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.modalActions}>
                <TouchableOpacity onPress={() => setEditingItem(null)} style={[styles.btnGhost, { flex: 1 }]} activeOpacity={0.85}>
                  <Text style={styles.btnGhostText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={saveEdit} style={[styles.btnDark, { flex: 1 }]} activeOpacity={0.85}>
                  <Text style={styles.btnDarkText}>Save</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

// ===========================================================================
// INVENTORY TAB
// ===========================================================================
function InventoryTab({ token }: { token: string | null }) {
  const [ings, setIngs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [showIn, setShowIn] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const [showOut, setShowOut] = useState<string | null>(null);
  const [qtyOut, setQtyOut] = useState('');

  const load = useCallback(async () => {
    try {
      const a = await authedGet('/api/inventory', token);
      const b = await authedGet('/api/stock-logs?limit=50', token);
      setIngs(Array.isArray(a) ? a : []);
      setLogs(Array.isArray(b) ? b : []);
    } catch {}
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function stockIn(id: string) {
    const n = Number(qty);
    if (!n) {
      Alert.alert('Invalid quantity', 'Enter a valid number');
      return;
    }
    try {
      await authedPost(`/api/inventory/${id}/stock-in`, { quantity: n, reason: 'Admin stock-in' }, token);
      setShowIn(null);
      setQty('');
      load();
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? String(e));
    }
  }
  async function stockOut(id: string) {
    const n = Number(qtyOut);
    if (!n) {
      Alert.alert('Invalid quantity', 'Enter wastage quantity');
      return;
    }
    try {
      await authedPost(`/api/inventory/${id}/stock-out`, { quantity: n, reason: 'Wastage' }, token);
      setShowOut(null);
      setQtyOut('');
      load();
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? String(e));
    }
  }

  return (
    <View style={styles.tabContent}>
      <View style={styles.invGrid}>
        {ings.map((ing) => (
          <View key={ing.id} style={[styles.invCard, ing.is_low ? styles.invCardLow : null]}>
            <View style={styles.invTop}>
              <View style={styles.invMeta}>
                <Text style={styles.invName}>{ing.name}</Text>
                <Text style={styles.invSub}>
                  {ing.id} · {ing.unit} · ₱{ing.cost_per_unit}/unit
                </Text>
              </View>
              {ing.is_low ? (
                <View style={styles.lowPill}>
                  <AlertTriangle size={12} color="#fff" />
                  <Text style={styles.lowText}>LOW</Text>
                </View>
              ) : null}
            </View>
            <View style={styles.invStockRow}>
              <Text style={styles.invStock}>{ing.current_stock}</Text>
              <Text style={styles.invUnit}>{ing.unit}</Text>
              <View style={styles.minPill}>
                <Text style={styles.minText}>min {ing.min_threshold}</Text>
              </View>
            </View>
            <View style={styles.progressTrack}>
              <View
                style={[
                  styles.progressFill,
                  { width: `${Math.min(100, (ing.current_stock / Math.max(ing.min_threshold * 2, 1)) * 100)}%` },
                  ing.is_low ? { backgroundColor: '#F59E0B' } : null,
                ]}
              />
            </View>
            <View style={styles.invActions}>
              {showIn === ing.id ? (
                <View style={styles.inlineAdd}>
                  <TextInput
                    value={qty}
                    onChangeText={setQty}
                    placeholder="Qty"
                    placeholderTextColor="#A8A29E"
                    keyboardType="number-pad"
                    style={[styles.input, { flex: 1 }]}
                  />
                  <TouchableOpacity onPress={() => stockIn(ing.id)} style={styles.btnDarkSmall} activeOpacity={0.85}>
                    <Text style={styles.btnDarkSmallText}>Add</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowIn(null)} style={styles.btnGhost} activeOpacity={0.85}>
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : showOut === ing.id ? (
                <View style={styles.inlineAdd}>
                  <TextInput
                    value={qtyOut}
                    onChangeText={setQtyOut}
                    placeholder="Wastage qty"
                    placeholderTextColor="#A8A29E"
                    keyboardType="number-pad"
                    style={[styles.input, { flex: 1 }]}
                  />
                  <TouchableOpacity onPress={() => stockOut(ing.id)} style={[styles.btnDarkSmall, { backgroundColor: '#DC2626' }]} activeOpacity={0.85}>
                    <Text style={styles.btnDarkSmallText}>Waste</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowOut(null)} style={styles.btnGhost} activeOpacity={0.85}>
                    <Text style={styles.btnGhostText}>Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TouchableOpacity onPress={() => setShowIn(ing.id)} style={[styles.btnDark, { flex: 1 }]} activeOpacity={0.85}>
                    <Plus size={14} color="#fff" />
                    <Text style={styles.btnDarkText}>Stock In</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowOut(ing.id)} style={styles.btnGhost} activeOpacity={0.85}>
                    <Text style={styles.btnGhostText}>Wastage</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        ))}
        {ings.length === 0 ? (
          <View style={[styles.forkCard, { alignItems: 'center' }]}>
            <Text style={styles.emptyLarge}>No ingredients</Text>
          </View>
        ) : null}
      </View>

      <View style={[styles.forkCard, { padding: 0, overflow: 'hidden' }]}>
        <Text style={styles.tableTitleOuter}>Recent Stock Logs</Text>
        <View style={styles.divider} />
        <ScrollView style={{ maxHeight: 320 }} showsVerticalScrollIndicator={false}>
          {logs.map((l) => (
            <View key={l.id} style={styles.logRow}>
              <View
                style={[
                  styles.logBadge,
                  l.change_type === 'STOCK_IN'
                    ? styles.logIn
                    : l.change_type === 'BOM_DEDUCTION'
                      ? styles.logBom
                      : l.change_type === 'WASTAGE'
                        ? styles.logWaste
                        : styles.logOther,
                ]}
              >
                <Text style={styles.logBadgeText}>{l.change_type}</Text>
              </View>
              <Text style={styles.logName} numberOfLines={1}>
                {l.ingredient_name}
              </Text>
              <Text style={[styles.logDelta, l.quantity_delta > 0 ? { color: '#059669' } : { color: '#DC2626' }]}>
                {l.quantity_delta > 0 ? '+' : ''}
                {l.quantity_delta}
              </Text>
              <Text style={styles.logDate}>{new Date(l.created_at).toLocaleString()}</Text>
            </View>
          ))}
          {logs.length === 0 ? <Text style={styles.emptyLarge}>No logs yet</Text> : null}
        </ScrollView>
      </View>
    </View>
  );
}

// ===========================================================================
// BOM TAB
// ===========================================================================
function BomTab({ token }: { token: string | null }) {
  const [boms, setBoms] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const [ings, setIngs] = useState<any[]>([]);
  const [form, setForm] = useState({ menuItemId: '', ingredientId: '', quantityRequired: '' });

  const load = useCallback(async () => {
    try {
      const [a, b, c] = await Promise.all([
        authedGet('/api/recipe-bom', token),
        authedGet('/api/menu?includeUnavailable=1', token),
        authedGet('/api/ingredients', token),
      ]);
      setBoms(Array.isArray(a) ? a : []);
      setMenu(Array.isArray(b) ? b : []);
      setIngs(Array.isArray(c) ? c : []);
    } catch {}
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function add() {
    if (!form.menuItemId || !form.ingredientId || !form.quantityRequired) {
      Alert.alert('Missing', 'Select menu item, ingredient and quantity');
      return;
    }
    try {
      await authedPost('/api/recipe-bom', { menuItemId: form.menuItemId, ingredientId: form.ingredientId, quantityRequired: Number(form.quantityRequired) }, token);
      setForm({ menuItemId: '', ingredientId: '', quantityRequired: '' });
      load();
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? String(e));
    }
  }
  async function del(id: string) {
    Alert.alert('Delete BOM?', 'Remove this ingredient from recipe?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await authedDel(`/api/recipe-bom/${id}`, token);
            load();
          } catch (e: any) {
            Alert.alert('Failed', e?.message ?? String(e));
          }
        },
      },
    ]);
  }

  return (
    <View style={styles.tabContent}>
      <View style={styles.forkCard}>
        <Text style={styles.sectionTitle}>Add Recipe BOM</Text>
        <View style={styles.bomForm}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerChips}>
            <View style={[styles.pickerChip, !form.menuItemId ? styles.pickerChipActive : null]}>
              <Text style={[styles.pickerText, !form.menuItemId ? styles.pickerTextActive : null]}>Menu item</Text>
            </View>
            {menu.map((m: any) => (
              <TouchableOpacity
                key={m.id}
                onPress={() => setForm({ ...form, menuItemId: m.id })}
                style={[styles.pickerChip, form.menuItemId === m.id ? styles.pickerChipActive : null]}
                activeOpacity={0.85}
              >
                <Text style={[styles.pickerText, form.menuItemId === m.id ? styles.pickerTextActive : null]} numberOfLines={1}>
                  {m.name} ({m.stall_id})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerChips}>
            <View style={[styles.pickerChip, !form.ingredientId ? styles.pickerChipActive : null]}>
              <Text style={[styles.pickerText, !form.ingredientId ? styles.pickerTextActive : null]}>Ingredient</Text>
            </View>
            {ings.map((i: any) => (
              <TouchableOpacity
                key={i.id}
                onPress={() => setForm({ ...form, ingredientId: i.id })}
                style={[styles.pickerChip, form.ingredientId === i.id ? styles.pickerChipActive : null]}
                activeOpacity={0.85}
              >
                <Text style={[styles.pickerText, form.ingredientId === i.id ? styles.pickerTextActive : null]} numberOfLines={1}>
                  {i.name} ({i.unit})
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.rowInputs}>
            <TextInput
              value={form.quantityRequired}
              onChangeText={(t) => setForm({ ...form, quantityRequired: t })}
              placeholder="Qty per 1 serving (e.g. 150)"
              placeholderTextColor="#A8A29E"
              keyboardType="number-pad"
              style={[styles.input, { flex: 1 }]}
            />
            <TouchableOpacity onPress={add} style={styles.btnDarkSmall} activeOpacity={0.85}>
              <Text style={styles.btnDarkSmallText}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <View style={[styles.forkCard, { padding: 0, overflow: 'hidden' }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: 640 }}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 1 }]}>Menu Item</Text>
              <Text style={[styles.th, { flex: 1 }]}>Ingredient</Text>
              <Text style={[styles.th, { width: 120 }]}>Qty / serving</Text>
              <Text style={[styles.th, { width: 70 }]}></Text>
            </View>
            {boms.map((b: any) => (
              <View key={b.id} style={styles.tr}>
                <Text style={[styles.td, { flex: 1, fontWeight: '600', color: '#1C1917' }]}>{b.menu_item_name}</Text>
                <Text style={[styles.td, { flex: 1 }]}>{b.ingredient_name}</Text>
                <Text style={[styles.tdBold, { width: 120 }]}>{b.quantity_required}</Text>
                <View style={{ width: 70 }}>
                  <TouchableOpacity onPress={() => del(b.id)} style={styles.iconBtn} activeOpacity={0.85}>
                    <Trash2 size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
        {boms.length === 0 ? <Text style={styles.emptyLarge}>No BOMs</Text> : null}
      </View>
    </View>
  );
}

// ===========================================================================
// AUDIT TAB
// ===========================================================================
function AuditTab({ token }: { token: string | null }) {
  const [ings, setIngs] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));

  const load = useCallback(async () => {
    try {
      const a = await authedGet('/api/inventory', token);
      setIngs(Array.isArray(a) ? a : []);
    } catch {}
    try {
      const b = await authedGet(`/api/audits?date=${date}`, token);
      setAudits(Array.isArray(b) ? b : []);
    } catch {
      setAudits([]);
    }
  }, [token, date]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit() {
    const entries = Object.entries(counts)
      .filter(([, v]) => v !== '')
      .map(([id, v]) => ({ ingredientId: id, physicalActualStock: Number(v) }));
    if (entries.length === 0) {
      Alert.alert('No counts', 'Enter at least one count');
      return;
    }
    try {
      await authedPost('/api/audits/bulk', { auditDate: date, entries }, token);
      setCounts({});
      load();
      Alert.alert('Submitted', 'EOD audit saved');
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? String(e));
    }
  }

  return (
    <View style={styles.tabContent}>
      <View style={styles.forkCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <ClipboardCheck size={14} color="#fff" />
          </View>
          <Text style={styles.sectionTitle}>Audit</Text>
        </View>
        <View style={styles.rowInputs}>
          <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#A8A29E" style={[styles.input, { flex: 1 }]} />
          <TouchableOpacity onPress={submit} style={styles.btnDarkSmall} activeOpacity={0.85}>
            <Text style={styles.btnDarkSmallText}>Submit</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.forkCard, { padding: 0, overflow: 'hidden' }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: 640 }}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 1 }]}>Ingredient</Text>
              <Text style={[styles.th, { width: 120 }]}>System Expected</Text>
              <Text style={[styles.th, { width: 140 }]}>Physical Count</Text>
              <Text style={[styles.th, { width: 80 }]}>Unit</Text>
            </View>
            {ings.map((ing: any) => (
              <View key={ing.id} style={styles.tr}>
                <Text style={[styles.td, { flex: 1, fontWeight: '600', color: '#1C1917' }]}>{ing.name}</Text>
                <Text style={[styles.td, { width: 120 }]}>{ing.current_stock}</Text>
                <View style={{ width: 140 }}>
                  <TextInput
                    value={counts[ing.id] || ''}
                    onChangeText={(t) => setCounts({ ...counts, [ing.id]: t })}
                    placeholder="actual"
                    placeholderTextColor="#A8A29E"
                    keyboardType="number-pad"
                    style={styles.inputSmall}
                  />
                </View>
                <Text style={[styles.td, { width: 80 }]}>{ing.unit}</Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </View>

      <View style={[styles.forkCard, { padding: 0, overflow: 'hidden' }]}>
        <Text style={styles.tableTitleOuter}>Audits for {date}</Text>
        <View style={styles.divider} />
        {audits.length === 0 ? (
          <Text style={styles.emptyLarge}>No audits yet</Text>
        ) : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={{ minWidth: 640 }}>
              <View style={styles.tableHead}>
                <Text style={[styles.th, { flex: 1 }]}>Ingredient</Text>
                <Text style={[styles.th, { width: 100 }]}>Expected</Text>
                <Text style={[styles.th, { width: 100 }]}>Actual</Text>
                <Text style={[styles.th, { width: 100 }]}>Variance</Text>
              </View>
              {audits.map((a: any) => (
                <View key={a.id} style={styles.tr}>
                  <Text style={[styles.td, { flex: 1 }]}>{a.ingredient_name}</Text>
                  <Text style={[styles.td, { width: 100 }]}>{a.system_expected_stock}</Text>
                  <Text style={[styles.td, { width: 100 }]}>{a.physical_actual_stock}</Text>
                  <Text style={[styles.tdBold, { width: 100 }, a.variance === 0 ? { color: '#059669' } : a.variance < 0 ? { color: '#DC2626' } : { color: '#D97706' }]}>
                    {a.variance > 0 ? '+' : ''}
                    {a.variance}
                  </Text>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    </View>
  );
}

// ===========================================================================
// ANALYTICS TAB
// ===========================================================================
function AnalyticsTab({ token }: { token: string | null }) {
  const [data, setData] = useState<any>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dailyData, setDailyData] = useState<any>(null);

  const load = useCallback(async () => {
    try {
      const d = await authedGet(`/api/reports/summary?from=${date}&to=${date}`, token);
      setData(d);
    } catch {
      setData(null);
    }
    try {
      const dd = await authedGet(`/api/orders/analytics/daily?date=${date}`, token);
      setDailyData(dd);
    } catch {
      setDailyData(null);
    }
  }, [token, date]);

  useEffect(() => {
    load();
  }, [load]);

  const summary = data?.daily?.[0] || (dailyData?.revenue as any) || { revenue: 0, orderCount: 0, orders: 0 };
  const topItems: any[] = data?.lowStocks ? [] : dailyData?.topItems || [];
  const hourly: any[] = dailyData?.hourly || [];

  return (
    <View style={styles.tabContent}>
      <View style={styles.rowInputs}>
        <TextInput value={date} onChangeText={setDate} placeholder="YYYY-MM-DD" placeholderTextColor="#A8A29E" style={[styles.input, { flex: 1 }]} />
        <TouchableOpacity onPress={load} style={styles.btnGhost} activeOpacity={0.85}>
          <Text style={styles.btnGhostText}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsGrid}>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Revenue ({date})</Text>
          <Text style={styles.statValue}>₱{Number(summary.revenue || summary.orders || 0).toFixed(2)}</Text>
          <Text style={styles.statSub}>{summary.orders || summary.orderCount || 0} orders · live</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Top Item</Text>
          <Text style={styles.statValueSmall}>{topItems?.[0]?.name || '—'}</Text>
          <Text style={styles.statSub}>{topItems?.[0]?.qty || 0} sold</Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statLabel}>Hourly Peak</Text>
          <Text style={styles.statValueSmall}>{hourly?.length ? `${hourly.reduce((m: any, c: any) => (c.orders > m.orders ? c : m), hourly[0]).hour}:00` : '—'}</Text>
          <Text style={styles.statSub}>{hourly?.length || 0} active hours</Text>
        </View>
      </View>

      <View style={styles.twoCol}>
        <View style={[styles.forkCard, { flex: 1 }]}>
          <Text style={styles.sectionTitle}>Top 5 Items</Text>
          <View style={styles.stack}>
            {topItems.map((t: any) => (
              <View key={t.name} style={styles.topRow}>
                <Text style={styles.topName}>{t.name}</Text>
                <Text style={styles.topMeta}>
                  {t.qty} × ₱{t.revenue}
                </Text>
              </View>
            ))}
            {(!topItems || topItems.length === 0) ? (
              <View style={styles.emptyDashed}>
                <Text style={styles.emptyDashedText}>No sales yet</Text>
              </View>
            ) : null}
          </View>
        </View>
        <View style={[styles.forkCard, { flex: 1 }]}>
          <Text style={styles.sectionTitle}>Hourly Breakdown</Text>
          <ScrollView style={{ maxHeight: 240 }} showsVerticalScrollIndicator={false}>
            <View style={styles.stack}>
              {hourly.map((h: any) => (
                <View key={h.hour} style={styles.hourRow}>
                  <Text style={styles.hourLabel}>{h.hour}:00</Text>
                  <View style={styles.hourTrack}>
                    <View style={[styles.hourFill, { width: `${Math.min(100, (h.orders / 10) * 100)}%` }]} />
                  </View>
                  <Text style={styles.hourOrders}>{h.orders} orders</Text>
                </View>
              ))}
              {(!hourly || hourly.length === 0) ? (
                <View style={styles.emptyDashed}>
                  <Text style={styles.emptyDashedText}>No data</Text>
                </View>
              ) : null}
            </View>
          </ScrollView>
        </View>
      </View>
    </View>
  );
}

// ===========================================================================
// USERS TAB
// ===========================================================================
function UsersTab({ token }: { token: string | null }) {
  const [users, setUsers] = useState<any[]>([]);
  const [stalls, setStalls] = useState<any[]>([]);
  const [form, setForm] = useState({ username: '', pin: '', role: 'STALL_OWNER' as 'ADMIN' | 'STALL_OWNER', stallId: '', displayName: '' });

  const load = useCallback(async () => {
    try {
      const [u, s] = await Promise.all([authedGet('/api/users', token), authedGet('/api/stalls', token)]);
      setUsers(Array.isArray(u) ? u : []);
      setStalls(Array.isArray(s) ? s : []);
    } catch {}
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  async function create() {
    if (!form.username.trim() || !form.pin.trim()) {
      Alert.alert('Missing', 'Username and PIN required');
      return;
    }
    if (form.role === 'STALL_OWNER' && !form.stallId) {
      Alert.alert('Missing stall', 'Stall owner requires a stall');
      return;
    }
    try {
      await authedPost(
        '/api/users',
        { username: form.username.trim(), pin: form.pin.trim(), role: form.role, stallId: form.role === 'STALL_OWNER' ? form.stallId : null, displayName: form.displayName || form.username.trim() },
        token
      );
      setForm({ username: '', pin: '', role: 'STALL_OWNER', stallId: '', displayName: '' });
      load();
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? String(e));
    }
  }
  async function remove(id: string) {
    Alert.alert('Delete user?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await authedDel(`/api/users/${id}`, token);
            load();
          } catch (e: any) {
            Alert.alert('Failed', e?.message ?? String(e));
          }
        },
      },
    ]);
  }
  async function toggleActive(u: any) {
    try {
      await authedPatch(`/api/users/${u.id}`, { is_active: u.is_active ? 0 : 1 }, token);
      load();
    } catch (e: any) {
      Alert.alert('Failed', e?.message ?? String(e));
    }
  }

  return (
    <View style={styles.tabContent}>
      <View style={styles.forkCard}>
        <View style={styles.sectionHeader}>
          <View style={styles.sectionIcon}>
            <Users size={14} color="#fff" />
          </View>
          <Text style={styles.sectionTitle}>Create User</Text>
        </View>
        <View style={styles.userFormGrid}>
          <TextInput value={form.username} onChangeText={(t) => setForm({ ...form, username: t })} placeholder="username" placeholderTextColor="#A8A29E" autoCapitalize="none" style={styles.input} />
          <TextInput value={form.pin} onChangeText={(t) => setForm({ ...form, pin: t })} placeholder="PIN" placeholderTextColor="#A8A29E" style={styles.input} />
          <TextInput value={form.displayName} onChangeText={(t) => setForm({ ...form, displayName: t })} placeholder="Display name" placeholderTextColor="#A8A29E" style={styles.input} />
          <View style={styles.roleChips}>
            <TouchableOpacity
              onPress={() => setForm({ ...form, role: 'STALL_OWNER' })}
              style={[styles.roleChip, form.role === 'STALL_OWNER' ? styles.roleChipActive : null]}
              activeOpacity={0.85}
            >
              <Text style={[styles.roleChipText, form.role === 'STALL_OWNER' ? styles.roleChipTextActive : null]}>STALL_OWNER</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setForm({ ...form, role: 'ADMIN' })} style={[styles.roleChip, form.role === 'ADMIN' ? styles.roleChipActive : null]} activeOpacity={0.85}>
              <Text style={[styles.roleChipText, form.role === 'ADMIN' ? styles.roleChipTextActive : null]}>ADMIN</Text>
            </TouchableOpacity>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pickerChips}>
            <View style={[styles.pickerChip, !form.stallId ? styles.pickerChipActive : null, form.role === 'ADMIN' ? { opacity: 0.45 } : null]}>
              <Text style={[styles.pickerText, !form.stallId ? styles.pickerTextActive : null]}>Stall (if owner)</Text>
            </View>
            {stalls.map((s: any) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => (form.role === 'ADMIN' ? null : setForm({ ...form, stallId: s.id }))}
                disabled={form.role === 'ADMIN'}
                style={[styles.pickerChip, form.stallId === s.id ? styles.pickerChipActive : null, form.role === 'ADMIN' ? { opacity: 0.45 } : null]}
                activeOpacity={0.85}
              >
                <Text style={[styles.pickerText, form.stallId === s.id ? styles.pickerTextActive : null]}>{s.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
        <TouchableOpacity onPress={create} style={[styles.btnDark, { marginTop: 12, alignSelf: 'flex-start', paddingHorizontal: 22 }]} activeOpacity={0.85}>
          <Text style={styles.btnDarkText}>Create User</Text>
        </TouchableOpacity>
      </View>

      <View style={[styles.forkCard, { padding: 0, overflow: 'hidden' }]}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{ minWidth: 640 }}>
            <View style={styles.tableHead}>
              <Text style={[styles.th, { flex: 1.2 }]}>User</Text>
              <Text style={[styles.th, { width: 110 }]}>Role</Text>
              <Text style={[styles.th, { width: 120 }]}>Stall</Text>
              <Text style={[styles.th, { width: 110 }]}>Active</Text>
              <Text style={[styles.th, { width: 70 }]}></Text>
            </View>
            {users.map((u: any) => (
              <View key={u.id} style={styles.tr}>
                <View style={{ flex: 1.2 }}>
                  <Text style={styles.tdName}>{u.username}</Text>
                  <Text style={styles.tdDesc}>
                    {u.display_name} · {u.id}
                  </Text>
                </View>
                <View style={{ width: 110 }}>
                  <View style={[styles.badge, u.role === 'ADMIN' ? styles.badgeDark : styles.badgeWhite]}>
                    <Text style={[styles.badgeText, u.role === 'ADMIN' ? { color: '#fff' } : { color: '#44403C' }]}>{u.role}</Text>
                  </View>
                </View>
                <Text style={[styles.td, { width: 120 }]}>{u.stall_name || u.stall_id || '-'}</Text>
                <View style={{ width: 110 }}>
                  <TouchableOpacity onPress={() => toggleActive(u)} activeOpacity={0.85} style={[styles.badge, u.is_active ? styles.badgeGreen : styles.badgeStone]}>
                    <Text style={[styles.badgeText, u.is_active ? { color: '#047857' } : { color: '#78716C' }]}>{u.is_active ? 'Active' : 'Disabled'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ width: 70 }}>
                  <TouchableOpacity onPress={() => remove(u.id)} style={styles.iconBtn} activeOpacity={0.85}>
                    <Trash2 size={14} color="#EF4444" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        </ScrollView>
        {users.length === 0 ? <Text style={styles.emptyLarge}>No users yet</Text> : null}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// StyleSheet — Fork UI warm stone
// stone-50 #FAFAF9, stone-100 #F5F5F4, stone-200 #E7E5E4, stone-300 #D6D3D1,
// stone-400 #A8A29E, stone-500 #78716C, stone-900 #1C1917
// fork-card: bg #fff border #E7E5E4 radius 20 shadow 0/2 0.06 elevation 3
// ---------------------------------------------------------------------------
const baseStyles: Record<string, any> = {
  safe: { flex: 1, backgroundColor: '#F7F5EE' },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, fontSize: 12, color: '#78716C', fontWeight: '600' },
  authContainer: { flexGrow: 1, padding: 16, justifyContent: 'center' },
  authCard: {
    backgroundColor: '#fff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
    maxWidth: 560,
    alignSelf: 'center',
    width: '100%',
  },
  authIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#0F4C4A', alignItems: 'center', justifyContent: 'center' },
  authTitle: { fontSize: 18, fontWeight: '800', color: '#1C1917', marginTop: 14, fontFamily: 'System' },
  authSub: { fontSize: 13, color: '#78716C', marginTop: 6 },
  authRow: { flexDirection: 'row', gap: 10, marginTop: 20 },

  btnDark: {
    backgroundColor: '#0F4C4A',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  btnDarkText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  btnGhost: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnGhostText: { color: '#44403C', fontWeight: '600', fontSize: 13 },
  btnDarkSmall: {
    backgroundColor: '#0F4C4A',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  btnDarkSmallText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  container: { padding: 16, gap: 16, paddingBottom: 28 },
  headerCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderColor: '#E7E2D6',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  headerIcon: { width: 36, height: 36, borderRadius: 16, backgroundColor: '#0F4C4A', alignItems: 'center', justifyContent: 'center' },
  headerMeta: { flex: 1, minWidth: 0 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' },
  headerName: { fontSize: 14, fontWeight: '800', color: '#1C1917' },
  rolePill: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999, borderWidth: 1 },
  roleAdmin: { backgroundColor: '#0F4C4A', borderColor: '#0F4C4A' },
  roleOwner: { backgroundColor: '#E6F2F0', borderColor: '#D1FAE5' },
  rolePillText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  rolePillTextAdmin: { color: '#fff' },
  rolePillTextOwner: { color: '#0F766E' },
  headerDot: { color: '#D6D3D1', fontSize: 12 },
  headerCampus: { fontSize: 11, color: '#78716C', fontWeight: '600' },
  headerSub: { fontSize: 12, color: '#78716C', marginTop: 2 },

  tabsRow: { gap: 8, paddingRight: 16 },
  tabPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    borderWidth: 1,
  },
  tabPillActive: { backgroundColor: '#0F4C4A', borderColor: '#0F4C4A' },
  tabPillIdle: { backgroundColor: '#fff', borderColor: '#E7E2D6' },
  tabText: { fontSize: 13, fontWeight: '700' },
  tabTextActive: { color: '#fff' },
  tabTextIdle: { color: '#44403C' },

  forkCard: {
    backgroundColor: '#fff',
    borderRadius: 22,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E7E2D6',
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  tabContent: { gap: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: '#0F4C4A', alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: '#1C1917' },

  adminOnlyIcon: { width: 48, height: 48, borderRadius: 16, backgroundColor: '#F1EDE2', borderWidth: 1, borderColor: '#E7E2D6', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  adminOnlyTitle: { textAlign: 'center', fontSize: 14, fontWeight: '800', color: '#1C1917', marginTop: 12 },
  adminOnlySub: { textAlign: 'center', fontSize: 13, color: '#78716C', marginTop: 4 },

  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#1C1917',
  },
  inputSmall: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 7,
    fontSize: 13,
    color: '#1C1917',
  },
  inputIconWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    borderRadius: 16,
    paddingHorizontal: 10,
  },
  inputIconInput: { flex: 1, paddingVertical: 10, fontSize: 13, color: '#1C1917' },

  rowInputs: { flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center', flexWrap: 'wrap' },
  row2: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  stack: { gap: 8, marginTop: 12 },

  errorBox: { marginTop: 12, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 16, padding: 10 },
  errorText: { fontSize: 13, color: '#B91C1C' },

  stallChips: { gap: 8, marginTop: 12, paddingRight: 8 },
  stallChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  stallChipActive: { backgroundColor: '#0F4C4A', borderColor: '#0F4C4A' },
  stallChipIdle: { backgroundColor: '#fff', borderColor: '#E7E2D6' },
  stallChipLogo: { width: 20, height: 20, borderRadius: 999, backgroundColor: '#fff' },
  stallChipText: { fontSize: 13, fontWeight: '600', color: '#44403C' },
  stallChipTextActive: { color: '#fff' },
  stallChipId: { fontSize: 11, color: '#A8A29E' },
  emptySmall: { textAlign: 'center', fontSize: 13, color: '#A8A29E', paddingVertical: 12 },

  qrGrid: { gap: 12, marginTop: 14 },
  qrCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: '#F7F5EE',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
  },
  qrImageWrap: { backgroundColor: '#fff', padding: 8, borderRadius: 16, borderWidth: 1, borderColor: '#E7E2D6' },
  qrMeta: { flex: 1, minWidth: 0, gap: 4 },
  qrMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  qrLogo: { width: 20, height: 20, borderRadius: 999, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E7E2D6' },
  qrName: { fontSize: 13, fontWeight: '800', color: '#1C1917' },
  qrUrl: { fontSize: 10, color: '#78716C', fontFamily: 'monospace' },
  qrActions: { flexDirection: 'row', gap: 8, marginTop: 6 },
  qrBtnGhost: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  qrBtnGhostText: { fontSize: 11, fontWeight: '600', color: '#44403C' },
  qrBtnDark: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#0F4C4A',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  qrBtnDarkText: { fontSize: 11, fontWeight: '700', color: '#fff' },

  twoCol: { flexDirection: 'row', gap: 12, flexWrap: 'wrap' },
  catList: { gap: 8, marginTop: 12 },
  catRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#F7F5EE',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  catMeta: { flex: 1, minWidth: 0 },
  catName: { fontSize: 13, fontWeight: '600', color: '#1C1917' },
  catSub: { fontSize: 11, color: '#A8A29E', marginTop: 2 },
  iconBtn: {
    width: 34,
    height: 34,
    borderRadius: 999,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyDashed: { borderWidth: 1, borderColor: '#E7E2D6', borderStyle: 'dashed', borderRadius: 16, padding: 16, alignItems: 'center', backgroundColor: '#F7F5EE' },
  emptyDashedText: { fontSize: 13, color: '#A8A29E' },
  emptyLarge: { textAlign: 'center', fontSize: 13, color: '#A8A29E', padding: 24 },

  pickerWrap: { backgroundColor: '#fff', borderWidth: 1, borderColor: '#E7E2D6', borderRadius: 16, padding: 6 },
  pickerChips: { gap: 6, flexDirection: 'row', alignItems: 'center' },
  pickerChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#E7E2D6',
    backgroundColor: '#fff',
  },
  pickerChipActive: { backgroundColor: '#0F4C4A', borderColor: '#0F4C4A' },
  pickerText: { fontSize: 12, fontWeight: '600', color: '#44403C' },
  pickerTextActive: { color: '#fff' },

  uploadHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#F7F5EE',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 16,
  },
  uploadHintText: { fontSize: 12, fontWeight: '600', color: '#44403C' },
  previewWrap: { height: 128, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E7E2D6', backgroundColor: '#F7F5EE', marginTop: 8 },
  previewImage: { width: '100%', height: '100%' },
  previewRemove: { position: 'absolute', top: 8, right: 8, backgroundColor: 'rgba(28,25,23,0.8)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  previewRemoveText: { color: '#fff', fontSize: 11, fontWeight: '600' },
  previewWrapLarge: { height: 160, borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: '#E7E2D6', backgroundColor: '#F7F5EE' },
  previewImageLarge: { width: '100%', height: '100%' },

  availChips: { flexDirection: 'row', gap: 6 },
  availChip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#E7E2D6', backgroundColor: '#fff' },
  availChipActive: { backgroundColor: '#0F4C4A', borderColor: '#0F4C4A' },
  availText: { fontSize: 12, fontWeight: '600', color: '#44403C' },
  availTextActive: { color: '#fff' },

  tableHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1EDE2' },
  tableTitle: { fontSize: 14, fontWeight: '800', color: '#1C1917' },
  tableTitleOuter: { fontSize: 14, fontWeight: '800', color: '#1C1917', padding: 16 },
  tableHead: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F7F5EE',
    borderBottomWidth: 1,
    borderBottomColor: '#F1EDE2',
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  th: { fontSize: 10, fontWeight: '700', color: '#78716C', textTransform: 'uppercase', letterSpacing: 0.5 },
  tr: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: '#F1EDE2',
    paddingVertical: 10,
    paddingHorizontal: 8,
    gap: 6,
  },
  thumb: { width: 56, height: 56, borderRadius: 16, overflow: 'hidden', backgroundColor: '#F1EDE2', borderWidth: 1, borderColor: '#E7E2D6' },
  thumbImage: { width: '100%', height: '100%' },
  thumbPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  td: { fontSize: 12, color: '#44403C' },
  tdName: { fontSize: 13, fontWeight: '600', color: '#1C1917' },
  tdDesc: { fontSize: 11, color: '#78716C', marginTop: 2 },
  tdMono: { fontSize: 10, color: '#A8A29E', fontFamily: 'monospace', marginTop: 2 },
  tdBold: { fontSize: 13, fontWeight: '700', color: '#1C1917' },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, borderWidth: 1, alignSelf: 'flex-start' },
  badgeGreen: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  badgeStone: { backgroundColor: '#F1EDE2', borderColor: '#E7E2D6' },
  badgeWhite: { backgroundColor: '#fff', borderColor: '#E7E2D6' },
  badgeDark: { backgroundColor: '#0F4C4A', borderColor: '#0F4C4A' },
  badgeText: { fontSize: 11, fontWeight: '700' },
  divider: { height: 1, backgroundColor: '#F1EDE2' },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(28,25,23,0.4)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '88%', paddingBottom: 16 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, borderBottomWidth: 1, borderBottomColor: '#F1EDE2' },
  modalTitle: { fontSize: 15, fontWeight: '800', color: '#1C1917', flex: 1 },
  modalClose: { width: 32, height: 32, borderRadius: 999, backgroundColor: '#F1EDE2', borderWidth: 1, borderColor: '#E7E2D6', alignItems: 'center', justifyContent: 'center' },
  modalBody: { padding: 16, gap: 12 },
  modalActions: { flexDirection: 'row', gap: 10, marginTop: 8 },

  invGrid: { gap: 12 },
  invCard: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  invCardLow: { borderColor: '#FDE68A', backgroundColor: '#FFFBEB' },
  invTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' },
  invMeta: { flex: 1, minWidth: 0 },
  invName: { fontSize: 14, fontWeight: '800', color: '#1C1917' },
  invSub: { fontSize: 11, color: '#78716C', marginTop: 2 },
  lowPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#F59E0B', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  lowText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  invStockRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 12 },
  invStock: { fontSize: 22, fontWeight: '800', color: '#1C1917' },
  invUnit: { fontSize: 12, color: '#78716C' },
  minPill: { marginLeft: 'auto', backgroundColor: '#fff', borderWidth: 1, borderColor: '#E7E2D6', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  minText: { fontSize: 11, color: '#78716C' },
  progressTrack: { height: 6, backgroundColor: '#F1EDE2', borderRadius: 999, overflow: 'hidden', marginTop: 10 },
  progressFill: { height: '100%', backgroundColor: '#0F4C4A', borderRadius: 999 },
  invActions: { flexDirection: 'row', gap: 8, marginTop: 12 },
  inlineAdd: { flexDirection: 'row', gap: 8, flex: 1, alignItems: 'center' },

  logRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F1EDE2' },
  logBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999, borderWidth: 1 },
  logBadgeText: { fontSize: 10, fontWeight: '700', color: '#44403C' },
  logIn: { backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' },
  logBom: { backgroundColor: '#EFF6FF', borderColor: '#BAE6FD' },
  logWaste: { backgroundColor: '#FEF2F2', borderColor: '#FECACA' },
  logOther: { backgroundColor: '#F7F5EE', borderColor: '#E7E2D6' },
  logName: { flex: 1, fontSize: 12, fontWeight: '600', color: '#1C1917', minWidth: 0 },
  logDelta: { fontSize: 12, fontWeight: '700', width: 50, textAlign: 'right' },
  logDate: { fontSize: 10, color: '#A8A29E', width: 140, textAlign: 'right' },

  bomForm: { gap: 10, marginTop: 12 },
  statsGrid: { flexDirection: 'row', gap: 10, flexWrap: 'wrap' },
  statCard: {
    flex: 1,
    minWidth: 110,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#E7E2D6',
    borderRadius: 16,
    padding: 14,
    shadowColor: '#1C1917',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 1,
  },
  statLabel: { fontSize: 10, fontWeight: '700', color: '#78716C', textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { fontSize: 18, fontWeight: '800', color: '#1C1917', marginTop: 6 },
  statValueSmall: { fontSize: 15, fontWeight: '800', color: '#1C1917', marginTop: 6 },
  statSub: { fontSize: 11, color: '#78716C', marginTop: 4 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#F7F5EE', borderWidth: 1, borderColor: '#E7E2D6', borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10 },
  topName: { fontSize: 13, fontWeight: '600', color: '#1C1917', flex: 1, paddingRight: 8 },
  topMeta: { fontSize: 12, fontWeight: '700', color: '#1C1917' },
  hourRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  hourLabel: { width: 44, fontSize: 12, fontWeight: '600', color: '#44403C', fontFamily: 'monospace' },
  hourTrack: { flex: 1, height: 6, backgroundColor: '#F1EDE2', borderRadius: 999, overflow: 'hidden' },
  hourFill: { height: '100%', backgroundColor: '#0F4C4A', borderRadius: 999 },
  hourOrders: { width: 80, textAlign: 'right', fontSize: 11, color: '#78716C' },

  userFormGrid: { gap: 8, marginTop: 12 },
  roleChips: { flexDirection: 'row', gap: 8 },
  roleChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#E7E2D6', backgroundColor: '#fff' },
  roleChipActive: { backgroundColor: '#0F4C4A', borderColor: '#0F4C4A' },
  roleChipText: { fontSize: 12, fontWeight: '700', color: '#44403C' },
  roleChipTextActive: { color: '#fff' },
};

// ---------------------------------------------------------------------------
// Theme overrides — landing look (deep green, warm cream, pills, big headings)
// ---------------------------------------------------------------------------
const themeOverrides: Record<string, any> = {
  safe: { flex: 1, backgroundColor: C.page },

  // Tabs: cream segmented pill like the floating nav
  tabsRow: { gap: 4, padding: 5, backgroundColor: C.cream, borderRadius: R.pill },
  tabPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 10, borderRadius: R.pill, borderWidth: 0 },
  tabPillActive: { backgroundColor: C.green },
  tabPillIdle: { backgroundColor: 'transparent' },
  tabText: { fontSize: 13, fontWeight: '700' },
  tabTextIdle: { color: C.green },

  // Cards + section headings
  forkCard: { backgroundColor: C.card, borderRadius: R.card, padding: 18, borderWidth: 1, borderColor: C.line, ...shadow.card },
  tabContent: { gap: 16 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  sectionIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: C.green, alignItems: 'center', justifyContent: 'center' },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: -0.4 },
  tableTitle: { fontSize: 18, fontWeight: '700', color: C.ink, letterSpacing: -0.3 },
  tableTitleOuter: { fontSize: 18, fontWeight: '700', color: C.ink, letterSpacing: -0.3, padding: 16 },
  adminOnlyIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  adminOnlyTitle: { textAlign: 'center', fontSize: 18, fontWeight: '700', color: C.ink, marginTop: 12 },

  // Buttons
  btnDark: { backgroundColor: C.green, paddingHorizontal: 22, paddingVertical: 14, borderRadius: R.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  btnDarkText: { color: '#fff', fontWeight: '800', fontSize: 14 },
  btnDarkSmall: { backgroundColor: C.green, paddingHorizontal: 16, paddingVertical: 11, borderRadius: R.pill, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  btnGhost: { backgroundColor: C.cream, borderWidth: 1, borderColor: C.line, paddingHorizontal: 18, paddingVertical: 13, borderRadius: R.pill, alignItems: 'center', justifyContent: 'center' },
  btnGhostText: { color: C.green, fontWeight: '700', fontSize: 14 },
  qrBtnGhost: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.cream, paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill },
  qrBtnGhostText: { fontSize: 12, fontWeight: '700', color: C.green },
  qrBtnDark: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: C.green, paddingHorizontal: 12, paddingVertical: 8, borderRadius: R.pill },
  qrBtnDarkText: { fontSize: 12, fontWeight: '700', color: '#fff' },
  iconBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },

  // Inputs
  input: { backgroundColor: C.page, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: C.ink },
  inputSmall: { backgroundColor: C.page, borderWidth: 1, borderColor: C.line, borderRadius: R.pill, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14, color: C.ink, minWidth: 80 },
  inputIconWrap: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.page, borderWidth: 1, borderColor: C.line, borderRadius: 16, paddingHorizontal: 14 },
  inputIconInput: { flex: 1, paddingVertical: 12, fontSize: 15, color: C.ink },
  pickerWrap: { backgroundColor: C.cream, borderRadius: R.pill, padding: 5 },
  pickerChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: R.pill, borderWidth: 0, backgroundColor: 'transparent' },
  pickerChipActive: { backgroundColor: C.green },
  pickerText: { fontSize: 13, fontWeight: '700', color: C.green },

  // Chips
  stallChip: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill, borderWidth: 1 },
  stallChipActive: { backgroundColor: C.green, borderColor: C.green },
  stallChipIdle: { backgroundColor: C.card, borderColor: C.line },
  availChip: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  availChipActive: { backgroundColor: C.green, borderColor: C.green },
  roleChip: { paddingHorizontal: 16, paddingVertical: 9, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  roleChipActive: { backgroundColor: C.green, borderColor: C.green },
  badgeGreen: { backgroundColor: C.greenSoft, borderColor: C.greenSoft },
  badgeDark: { backgroundColor: C.green, borderColor: C.green },

  // QR / list rows
  qrCard: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.page, borderRadius: R.card, padding: 14, borderWidth: 1, borderColor: C.line, flexWrap: 'wrap' },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.page, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  thumb: { width: 60, height: 60, borderRadius: 16, overflow: 'hidden', backgroundColor: C.cream },

  // Modal sheet
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: C.card, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, maxHeight: '88%', paddingBottom: 24 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.ink, flex: 1, letterSpacing: -0.3 },
  modalClose: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#F1EDE2', alignItems: 'center', justifyContent: 'center' },

  // Inventory + analytics
  invCard: { backgroundColor: C.card, borderRadius: R.card, padding: 18, borderWidth: 1, borderColor: C.line, ...shadow.card },
  invStock: { fontSize: 28, fontWeight: '800', color: C.ink, letterSpacing: -0.5 },
  progressFill: { height: '100%', backgroundColor: C.green, borderRadius: R.pill },
  statCard: { flexGrow: 1, flexBasis: '46%', backgroundColor: C.card, borderRadius: R.card, padding: 16, borderWidth: 1, borderColor: C.line, ...shadow.card },
  statValue: { fontSize: 26, fontWeight: '800', color: C.green, marginTop: 6, letterSpacing: -0.5 },
  statValueSmall: { fontSize: 18, fontWeight: '800', color: C.green, marginTop: 6 },
  topRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: C.page, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 12 },
  hourFill: { height: '100%', backgroundColor: C.green, borderRadius: R.pill },
};

const styles: any = StyleSheet.create({ ...baseStyles, ...themeOverrides } as any);
