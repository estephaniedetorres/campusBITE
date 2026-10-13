import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Image, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ShoppingBag, Store, ChefHat, Boxes, Wifi, LogIn, LogOut, Shield, Menu, X, ReceiptText } from 'lucide-react-native';
import { getApiBase, apiGet } from '../constants/api';

const nav = [
  { to: '/kiosk', label: 'Kiosk', Icon: ShoppingBag, public: true },
  { to: '/orders', label: 'My Orders', Icon: ReceiptText, public: true },
  { to: '/pos', label: 'POS', Icon: Store, auth: true },
  { to: '/kds', label: 'Kitchen', Icon: ChefHat, auth: true },
  { to: '/admin', label: 'Admin', Icon: Boxes, auth: true },
] as const;

function Header() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [health, setHealth] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const raw = await AsyncStorage.getItem('campusbite_user');
        if (raw) setUser(JSON.parse(raw));
        else setUser(null);
      } catch { setUser(null); }
    };
    load();
    const id = setInterval(load, 2000);
    return () => clearInterval(id);
  }, [pathname]);

  useEffect(() => {
    apiGet('/api/health').then(setHealth).catch(()=>{});
    const t = setInterval(()=> apiGet('/api/health').then(setHealth).catch(()=>{}), 8000);
    return ()=> clearInterval(t);
  }, []);

  const visibleNav = nav.filter(n => (n as any).public || !!user);

  // Customer screens are full-bleed with their own floating nav / back button.
  // Staff keep the header on Kiosk/My Orders so they can jump back to POS/KDS/Admin.
  const customerScreen = pathname === '/kiosk' || pathname === '/orders';
  if (pathname === '/' || (customerScreen && !user)) return null;

  return (
    <View style={hStyles.header}>
      <View style={hStyles.headerInner}>
        <TouchableOpacity onPress={() => router.push('/' as any)} style={hStyles.brand}>
          <Image source={require('../assets/CampusBITE_Logo.png')} style={hStyles.logo} resizeMode="contain" />
          <View style={hStyles.brandTextWrap}>
            <Text style={hStyles.brandTitle}>CampusBITE</Text>
            <Text style={hStyles.brandSub}>Canteen</Text>
          </View>
        </TouchableOpacity>

        <View style={hStyles.navDesktop}>
          {visibleNav.map(n => {
            const active = pathname?.startsWith(n.to);
            const Icon = n.Icon as any;
            return (
              <TouchableOpacity key={n.to} onPress={() => router.push(n.to as any)} style={[hStyles.navPill, active && hStyles.navPillActive]}>
                <Icon size={16} color={active ? '#fff' : '#57534E'} strokeWidth={active ? 2.2 : 1.8} />
                <Text style={[hStyles.navText, active && hStyles.navTextActive]}>{n.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={hStyles.actions}>
          {user ? (
            <>
              <View style={hStyles.userBox}>
                <View style={hStyles.userNameRow}>
                  <Shield size={12} color={user.role==='ADMIN' ? '#1C1917' : '#EA580C'} />
                  <Text style={hStyles.userName} numberOfLines={1}>{user.display_name}</Text>
                </View>
                <Text style={hStyles.userRole}>{user.role}{user.stall_name ? ` · ${user.stall_name}` : ''}</Text>
              </View>
              <TouchableOpacity onPress={async () => { await AsyncStorage.removeItem('campusbite_user'); await AsyncStorage.removeItem('campusbite_token'); setUser(null); router.push('/login' as any); }} style={hStyles.logoutBtn}>
                <LogOut size={14} color="#57534E" />
                <Text style={hStyles.logoutText}>Logout</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={async () => { await AsyncStorage.removeItem('campusbite_user'); await AsyncStorage.removeItem('campusbite_token'); setUser(null); router.push('/login' as any); }} style={hStyles.iconBtnSm}>
                <LogOut size={16} color="#57534E" />
              </TouchableOpacity>
            </>
          ) : null}
          <TouchableOpacity onPress={() => setMenuOpen(v => !v)} style={hStyles.menuBtn}>
            {menuOpen ? <X size={18} color="#1C1917" /> : <Menu size={18} color="#1C1917" />}
          </TouchableOpacity>
        </View>
      </View>
      {menuOpen && (
        <View style={hStyles.mobileNav}>
          <View style={[hStyles.mobileGrid, visibleNav.length===1 && hStyles.mobileGrid1]}>
            {visibleNav.map(n => {
              const active = pathname?.startsWith(n.to);
              const Icon = n.Icon as any;
              return (
                <TouchableOpacity key={n.to} onPress={() => { setMenuOpen(false); router.push(n.to as any); }} style={[hStyles.mobilePill, active && hStyles.mobilePillActive]}>
                  <Icon size={18} color={active ? '#fff' : '#1C1917'} />
                  <Text style={[hStyles.mobileText, active && hStyles.mobileTextActive]}>{n.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>
      )}

    </View>
  );
}

const hStyles = StyleSheet.create({
  header: { backgroundColor: 'rgba(255,255,255,0.95)', borderBottomWidth: 1, borderBottomColor: '#E7E5E4', zIndex: 40 },
  headerInner: { maxWidth: 1280, width: '100%', alignSelf: 'center', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14, gap: 16 },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 12, flexShrink: 1 },
  logo: { width: 36, height: 36, borderRadius: 12, backgroundColor: '#fff' },
  brandTextWrap: { minWidth: 0 },
  brandTitle: { fontSize: 18, fontWeight: '700', color: '#1C1917', letterSpacing: -0.4, lineHeight: 18 },
  brandSub: { fontSize: 11, color: '#78716C', marginTop: -2, letterSpacing: 0.5 },
  navDesktop: { flexDirection: 'row', alignItems: 'center', gap: 4, display: 'none' as any }, // hidden on mobile, lg:flex via width check would be flex
  navPill: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, backgroundColor: 'transparent' },
  navPillActive: { backgroundColor: '#0F4C4A' },
  navText: { fontSize: 14, fontWeight: '500', color: '#57534E' },
  navTextActive: { color: '#fff', fontWeight: '600' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  userBox: { alignItems: 'flex-end', maxWidth: 140, display: 'none' as any }, // hidden sm:block
  userNameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'flex-end' },
  userName: { fontSize: 14, fontWeight: '500', color: '#1C1917', lineHeight: 14 },
  userRole: { fontSize: 12, color: '#78716C', lineHeight: 12 },
  logoutBtn: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: 1, borderColor: '#E7E5E4', backgroundColor: '#fff', display: 'none' as any },
  logoutText: { fontSize: 14, fontWeight: '500', color: '#44403C' },
  iconBtnSm: { width: 36, height: 36, borderRadius: 999, borderWidth: 1, borderColor: '#E7E5E4', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  menuBtn: { width: 36, height: 36, borderRadius: 999, borderWidth: 1, borderColor: '#E7E5E4', backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  mobileNav: { borderTopWidth: 1, borderTopColor: '#F5F5F4', backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 16 },
  mobileGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  mobileGrid1: { flexDirection: 'column' as any },
  mobilePill: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 16, backgroundColor: '#fff', borderWidth: 1, borderColor: '#E7E5E4', flexBasis: '48%' as any, flexGrow: 1 },
  mobilePillActive: { backgroundColor: '#0F4C4A', borderColor: '#0F4C4A' },
  mobileText: { fontSize: 14, fontWeight: '500', color: '#44403C' },
  mobileTextActive: { color: '#fff' },
  healthBar: { backgroundColor: '#0F4C4A', flexDirection: 'row', alignItems: 'center', gap: 16, paddingHorizontal: 16, paddingVertical: 8 },
  healthDot: { width: 8, height: 8, borderRadius: 999, backgroundColor: '#10B981' },
  healthBarText: { fontSize: 12, color: '#F5F5F4', fontWeight: '600' },
  healthLive: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  healthLiveText: { fontSize: 12, color: '#A6A09B' },
  healthBarRight: { fontSize: 12, color: '#A6A09B', marginLeft: 'auto' as any, display: 'none' as any },
});

export default function RootLayout() {
  // Fonts: use System fallback (Cormorant Garamond via web @import, native uses System) — keeps design warm without extra bundle
  return (
    <>
      <StatusBar style="dark" />
      <View style={{ flex: 1, backgroundColor: '#F7F5EE' }}>
        {/* Global header retired: customer screens use CustomerNav, staff screens use StaffChrome */}
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: '#F7F5EE' },
            animation: 'fade',
          }}
        >
          <Stack.Screen name="index" options={{ title: 'CampusBITE' }} />
          <Stack.Screen name="kiosk" options={{ title: 'Kiosk' }} />
          <Stack.Screen name="pos" options={{ title: 'POS' }} />
          <Stack.Screen name="kds" options={{ title: 'KDS' }} />
          <Stack.Screen name="admin" options={{ title: 'Admin' }} />
          <Stack.Screen name="login" options={{ title: 'Log in' }} />
          <Stack.Screen name="orders" options={{ title: 'My Orders' }} />
        </Stack>
      </View>
    </>
  );
}
