import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ActivityIndicator, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { Eye, EyeOff, ArrowRight, Banknote, ChefHat, Boxes, User, KeyRound, ShieldCheck } from 'lucide-react-native';
import { ApiError, apiPost } from '../constants/api';
import { C, R, shadow } from '../constants/theme';
import { StaffScreen, StaffHero, STAFF_HERO_IMAGES } from '../src/components/StaffChrome';
import { useStaffAuth, saveSession, AuthUser } from '../src/hooks/useStaffAuth';

const MIN_PASSWORD = 8;

function PasswordField({ label, value, onChange, onSubmit, placeholder = '••••••••', autoFocus }: {
  label: string; value: string; onChange: (t: string) => void; onSubmit?: () => void; placeholder?: string; autoFocus?: boolean;
}) {
  const [show, setShow] = useState(false);
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.inputWrap}>
        <KeyRound size={18} color={C.muted} />
        <TextInput
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          placeholderTextColor="#A8A29E"
          secureTextEntry={!show}
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus={autoFocus}
          style={styles.input}
          textContentType="password"
          onSubmitEditing={onSubmit}
          accessibilityLabel={label}
        />
        <TouchableOpacity onPress={() => setShow((v) => !v)} style={styles.eyeBtn} accessibilityLabel={show ? `Hide ${label}` : `Show ${label}`}>
          {show ? <EyeOff size={18} color={C.muted} /> : <Eye size={18} color={C.muted} />}
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { user, loading: authLoading, logout, setUser, setTokenState } = useStaffAuth();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  // Change-password form (forced after an admin reset, or optional from the signed-in view)
  const [changing, setChanging] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [notice, setNotice] = useState('');

  async function handleLogin() {
    setErr('');
    const u = username.trim();
    if (!u || !password) { setErr('Enter your username and password'); return; }
    setBusy(true);
    try {
      const data: any = await apiPost('/api/auth/login', { username: u, password }, null);
      await saveSession(data.user, data.token);
      setTokenState(data.token);
      setUser(data.user);
      if (data.mustChangePassword) { setCurrent(password); setChanging(true); }
      setUsername('');
      setPassword('');
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 429) setErr(`Too many attempts. Wait ${e.retryAfter ?? 'a few'} seconds and try again.`);
      else if (e instanceof ApiError && e.status === 401) setErr(`Wrong username or password.${e.retryAfter ? ` Try again in ${e.retryAfter}s.` : ''}`);
      else setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleChangePassword() {
    setErr('');
    if (next.length < MIN_PASSWORD) { setErr(`New password must be at least ${MIN_PASSWORD} characters`); return; }
    if (next !== confirm) { setErr('New passwords do not match'); return; }
    setBusy(true);
    try {
      const data: any = await apiPost('/api/auth/change-password', { currentPassword: current, newPassword: next });
      setUser(data.user as AuthUser);
      setChanging(false);
      setCurrent(''); setNext(''); setConfirm('');
      setNotice('Password changed. Other devices were logged out.');
    } catch (e: any) {
      setErr(e?.message ?? String(e));
    } finally {
      setBusy(false);
    }
  }

  if (authLoading) {
    return (
      <View style={[styles.safe, styles.center]}>
        <ActivityIndicator color={C.green} />
        <Text style={styles.loadingText}>Loading…</Text>
      </View>
    );
  }

  // Forced (temporary password) or voluntary password change
  if (user && (changing || user.must_change_password)) {
    const forced = !!user.must_change_password;
    return (
      <StaffScreen
        nav={!forced}
        hero={
          <StaffHero image={STAFF_HERO_IMAGES.login} eyebrow={forced ? 'One more step' : 'Account'}
            title="Set a new password" subtitle={forced ? 'You signed in with a temporary password. Choose your own to continue.' : `Signed in as @${user.username}`} user={user} />
        }
      >
        <View style={styles.formCard}>
          <View style={styles.brandRow}>
            <ShieldCheck size={22} color={C.green} />
            <Text style={styles.brandText}>At least {MIN_PASSWORD} characters</Text>
          </View>
          <PasswordField label={forced ? 'Temporary password' : 'Current password'} value={current} onChange={setCurrent} autoFocus={!current} />
          <PasswordField label="New password" value={next} onChange={setNext} />
          <PasswordField label="Confirm new password" value={confirm} onChange={setConfirm} onSubmit={handleChangePassword} />
          {err ? <View style={styles.errorBox}><Text style={styles.errorText}>{err}</Text></View> : null}
          <TouchableOpacity onPress={handleChangePassword} disabled={busy} style={[styles.loginBtn, busy && styles.loginBtnDisabled]} activeOpacity={0.9}>
            <Text style={styles.loginBtnText}>{busy ? 'Saving…' : 'Save password'}</Text>
          </TouchableOpacity>
        </View>
        {forced ? (
          <TouchableOpacity onPress={logout} style={styles.btnGhost} activeOpacity={0.9}>
            <Text style={styles.btnGhostText}>Log out</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity onPress={() => { setChanging(false); setErr(''); }} style={styles.btnGhost} activeOpacity={0.9}>
            <Text style={styles.btnGhostText}>Cancel</Text>
          </TouchableOpacity>
        )}
      </StaffScreen>
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
            title={`Hi, ${(user.display_name || user.username).split(' ')[0]}!`} subtitle="Where are you working today?" user={user} />
        }
      >
        {notice ? <View style={styles.noticeBox}><Text style={styles.noticeText}>{notice}</Text></View> : null}
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
        <View style={styles.ghostRow}>
          <TouchableOpacity onPress={() => { setNotice(''); setErr(''); setChanging(true); }} style={styles.btnGhost} activeOpacity={0.9}>
            <Text style={styles.btnGhostText}>Change password</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={logout} style={styles.btnGhost} activeOpacity={0.9}>
            <Text style={styles.btnGhostText}>Log out @{user.username}</Text>
          </TouchableOpacity>
        </View>
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

        <PasswordField label="Password" value={password} onChange={setPassword} onSubmit={handleLogin} />

        {err ? <View style={styles.errorBox}><Text style={styles.errorText}>{err}</Text></View> : null}

        <TouchableOpacity onPress={handleLogin} disabled={busy} style={[styles.loginBtn, busy && styles.loginBtnDisabled]} activeOpacity={0.9}>
          <Text style={styles.loginBtnText}>{busy ? 'Logging in…' : 'Log in'}</Text>
          {!busy && <ArrowRight size={18} color="#fff" />}
        </TouchableOpacity>

        <Text style={styles.forgot}>
          Forgot your password? Ask the canteen manager to reset it in Admin → Users.
        </Text>
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
  noticeBox: { backgroundColor: C.greenSoft, borderRadius: 16, padding: 12 },
  noticeText: { fontSize: 14, color: C.green, fontWeight: '600' },
  loginBtn: { backgroundColor: C.green, borderRadius: R.pill, paddingVertical: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  loginBtnDisabled: { opacity: 0.6 },
  loginBtnText: { color: '#fff', fontWeight: '800', fontSize: 16 },
  forgot: { fontSize: 13, color: C.muted, textAlign: 'center', lineHeight: 18 },

  tile: { flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: C.card, borderRadius: R.card, padding: 18, borderWidth: 1, borderColor: C.line, ...shadow.card },
  tileIcon: { width: 52, height: 52, borderRadius: 26, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center' },
  tileTitle: { fontSize: 18, fontWeight: '700', color: C.ink, letterSpacing: -0.3 },
  tileSub: { fontSize: 13, color: C.muted, marginTop: 2 },
  ghostRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  btnGhost: { alignSelf: 'center', paddingHorizontal: 20, paddingVertical: 12, borderRadius: R.pill, borderWidth: 1, borderColor: C.line, backgroundColor: C.card },
  btnGhostText: { fontSize: 14, fontWeight: '700', color: C.green },
});
