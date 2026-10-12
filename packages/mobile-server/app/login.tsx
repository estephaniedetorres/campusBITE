import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  Image,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Eye, EyeOff, ArrowRight, Banknote, ChefHat, Boxes, User, KeyRound } from 'lucide-react-native';
import { setToken, apiPost } from '../constants/api';
import { C, R, shadow } from '../constants/theme';
import { StaffScreen, StaffHero, STAFF_HERO_IMAGES } from '../src/components/StaffChrome';

type AuthUser = {
  id: string;
  username: string;
  role: 'ADMIN' | 'STALL_OWNER';
  stall_id: string | null;
  stall_name: string | null;
  display_name: string;
};

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

  const logout = async () => {
    try {
      await AsyncStorage.removeItem('campusbite_user');
      await AsyncStorage.removeItem('campusbite_token');
    } catch {}
    setUser(null);
    setTokenState(null);
    setToken(null);
  };

  return { user, token, loading, setUser, setTokenState, logout };
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout, setUser, setTokenState } = useAuth();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    setErr('');
    const u = username.trim();
    const p = pin.trim();
    if (!u || !p) {
      setErr('Username and PIN required');
      return;
    }
    setLoading(true);
    try {
      const data: any = await apiPost('/api/auth/login', { username: u, pin: p });
      const loggedUser: AuthUser = data.user;
      const tok: string = data.token || loggedUser.id;
      await AsyncStorage.setItem('campusbite_user', JSON.stringify(loggedUser));
      await AsyncStorage.setItem('campusbite_token', tok);
      setToken(tok);
      setUser(loggedUser);
      setTokenState(tok);
      setUsername('');
      setPin('');
      // Stay here: the signed-in view shows the Cashier / Kitchen / Admin picker
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    await logout();
  }

  if (authLoading) {
    return (
      <View style={[styles.safe, styles.center]}>
        <ActivityIndicator color={C.green} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  // Signed in — pick a workspace
  if (user) {
    const tiles = [
      { to: '/pos', label: 'Cashier', sub: 'Take payment by pickup code', Icon: Banknote },
      { to: '/kds', label: 'Kitchen', sub: 'Live tickets, start → ready', Icon: ChefHat },
      { to: '/admin', label: 'Admin', sub: user.role === 'ADMIN' ? 'Menu, stock, reports, users' : 'Your menu and QR codes', Icon: Boxes },
    ];
    return (
      <StaffScreen
        hero={
          <StaffHero image={STAFF_HERO_IMAGES.login} eyebrow={user.role === 'ADMIN' ? 'Canteen manager' : user.stall_name || 'Stall owner'}
            title={`Hi, ${user.display_name.split(' ')[0]}!`} subtitle="Where are you working today?" user={user} />
        }
      >
        {tiles.map(({ to, label, sub, Icon }) => (
          <TouchableOpacity key={to} onPress={() => router.push(to as any)} style={styles.tile} activeOpacity={0.9}>
            <View style={styles.tileIcon}><Icon size={22} color={C.green} /></View>
            <View style={{ flex: 1 }}>
              <Text style={styles.tileTitle}>{label}</Text>
              <Text style={styles.tileSub}>{sub}</Text>
            </View>
            <ArrowRight size={18} color={C.green} />
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={handleLogout} style={styles.btnGhost} activeOpacity={0.9}>
          <Text style={styles.btnGhostText}>Log out @{user.username}</Text>
        </TouchableOpacity>
      </StaffScreen>
    );
  }

  return (
    <StaffScreen
      nav={false}
      hero={
        <StaffHero image={STAFF_HERO_IMAGES.login} eyebrow="For stall owners" title="Welcome back"
          subtitle="Log in to manage orders, the kitchen and your menu." />
      }
    >
      <View style={styles.formCard}>
        <View style={styles.brandRow}>
          <Image source={require('../assets/CampusBITE_Logo.png')} style={styles.brandLogo} resizeMode="contain" />
          <Text style={styles.brandText}>CampusBITE Staff</Text>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>Username</Text>
          <View style={styles.inputWrap}>
            <User size={18} color={C.muted} />
            <TextInput
              value={username}
              onChangeText={setUsername}
              placeholder="e.g. potato"
              placeholderTextColor="#A8A29E"
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              textContentType="username"
              accessibilityLabel="Username"
            />
          </View>
        </View>

        <View style={styles.field}>
          <Text style={styles.label}>PIN</Text>
          <View style={styles.inputWrap}>
            <KeyRound size={18} color={C.muted} />
            <TextInput
              value={pin}
              onChangeText={setPin}
              placeholder="••••••••"
              placeholderTextColor="#A8A29E"
              secureTextEntry={!showPin}
              autoCapitalize="none"
              autoCorrect={false}
              style={styles.input}
              textContentType="password"
              onSubmitEditing={handleLogin}
              accessibilityLabel="PIN"
            />
            <TouchableOpacity onPress={() => setShowPin((v) => !v)} style={styles.eyeBtn}
              accessibilityLabel={showPin ? 'Hide PIN' : 'Show PIN'}>
              {showPin ? <EyeOff size={18} color={C.muted} /> : <Eye size={18} color={C.muted} />}
            </TouchableOpacity>
          </View>
        </View>

        {err ? (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{err}</Text>
          </View>
        ) : null}

        <TouchableOpacity onPress={handleLogin} disabled={loading}
          style={[styles.loginBtn, loading && styles.loginBtnDisabled]} activeOpacity={0.9}>
          <Text style={styles.loginBtnText}>{loading ? 'Logging in…' : 'Log in'}</Text>
          {!loading && <ArrowRight size={18} color="#fff" />}
        </TouchableOpacity>
      </View>

      <TouchableOpacity onPress={() => router.push('/' as any)} style={styles.btnGhost} activeOpacity={0.9}>
        <Text style={styles.btnGhostText}>I'm a student — order food</Text>
      </TouchableOpacity>
    </StaffScreen>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.page },
  center: { alignItems: 'center', justifyContent: 'center' },
  loadingText: { marginTop: 10, fontSize: 13, color: C.muted, fontWeight: '600' },

  formCard: { backgroundColor: C.card, borderRadius: R.card, padding: 22, gap: 16, borderWidth: 1, borderColor: C.line, ...shadow.card, width: '100%', maxWidth: 520, alignSelf: 'center' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandLogo: { width: 36, height: 36 },
  brandText: { fontSize: 18, fontWeight: '700', color: C.green, letterSpacing: -0.3 },
  field: { gap: 6 },
  label: { fontSize: 13, fontWeight: '700', color: C.inkSoft },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: C.page, borderWidth: 1, borderColor: C.line, borderRadius: R.pill, paddingLeft: 16, paddingRight: 6 },
  input: { flex: 1, paddingVertical: 14, fontSize: 16, color: C.ink },
  eyeBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  errorBox: { backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FECACA', borderRadius: 16, padding: 12 },
  errorText: { fontSize: 14, color: C.danger, lineHeight: 20 },
  loginBtn: { backgroundColor: C.green, borderRadius: R.pill, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },

  tile: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: R.card, padding: 18, borderWidth: 1, borderColor: C.line, ...shadow.card },
  tileIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 18, fontWeight: '700', color: C.ink, letterSpacing: -0.3 },
  tileSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  btnGhost: { alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: C.green },
});
