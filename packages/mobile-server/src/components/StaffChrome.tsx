// Staff UI kit — same visual language as the customer landing page:
// full-bleed photo hero, cream circle buttons, rounded sheet body, floating cream pill nav.
import React from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet, ScrollView, ScrollViewProps } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home, Banknote, ChefHat, Boxes, LogOut, LogIn, Shield } from 'lucide-react-native';
import { C, R, shadow } from '../../constants/theme';
import { resolveImageUrl } from '../../constants/api';
import { stockImage } from '../../lib/stockImages';
import { logoutSession } from '../hooks/useStaffAuth';

// Bundled offline photos (served by the API at /api/images/*)
export const STAFF_HERO_IMAGES = {
  pos: stockImage('staff-pos'),
  kds: stockImage('staff-kds'),
  admin: stockImage('canteen'),
  login: stockImage('staff-login'),
} as const;

/** Bottom padding a staff screen should reserve so content clears the floating nav. */
export const STAFF_NAV_SPACE = 120;

/** Revokes the session on the server, then clears it from this device. */
export const staffLogout = logoutSession;

function initials(name?: string | null) {
  if (!name) return 'CB';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');
}

// ---------------------------------------------------------------------------
// Hero
// ---------------------------------------------------------------------------
type HeroProps = {
  image: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  user?: { display_name?: string; role?: string; stall_name?: string | null } | null;
  /** Extra chips/actions rendered under the title (e.g. Live pill, sound toggle) */
  children?: React.ReactNode;
  compact?: boolean;
};

export function StaffHero({ image, eyebrow, title, subtitle, user, children, compact }: HeroProps) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.hero, { paddingTop: insets.top + 12, minHeight: compact ? 230 : 280 }]}>
      <Image source={{ uri: resolveImageUrl(image) }} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
      <View style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(0,0,0,0.40)' }]} />
      <View style={styles.heroScrim} />

      <View style={styles.topRow}>
        <TouchableOpacity onPress={() => router.push('/' as any)} style={styles.circle} accessibilityLabel="Customer home">
          <Home size={20} color={C.green} />
        </TouchableOpacity>
        {user ? (
          <View style={styles.userRow}>
            <View style={styles.userPill}>
              <View style={styles.avatar}><Text style={styles.avatarText}>{initials(user.display_name)}</Text></View>
              <View style={{ maxWidth: 150 }}>
                <Text style={styles.userName} numberOfLines={1}>{user.display_name}</Text>
                <Text style={styles.userRole} numberOfLines={1}>
                  {user.role === 'ADMIN' ? 'Admin' : 'Stall owner'}{user.stall_name ? ` · ${user.stall_name}` : ''}
                </Text>
              </View>
            </View>
            <TouchableOpacity
              onPress={async () => { await staffLogout(); router.replace('/login' as any); }}
              style={styles.circle} accessibilityLabel="Log out">
              <LogOut size={18} color={C.green} />
            </TouchableOpacity>
          </View>
        ) : null}
      </View>

      <View style={styles.copy}>
        {eyebrow ? <Text style={styles.eyebrow}>{eyebrow}</Text> : null}
        <Text style={styles.title} numberOfLines={2}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={2}>{subtitle}</Text> : null}
        {children ? <View style={styles.heroExtras}>{children}</View> : null}
      </View>
    </View>
  );
}

/** Translucent chip for use inside the hero (Live, counts, toggles). */
export function HeroChip({ icon, label, onPress, active }: { icon?: React.ReactNode; label: string; onPress?: () => void; active?: boolean }) {
  const Comp: any = onPress ? TouchableOpacity : View;
  return (
    <Comp onPress={onPress} style={[styles.heroChip, active && styles.heroChipActive]} accessibilityRole={onPress ? 'button' : undefined}>
      {icon}
      <Text style={[styles.heroChipText, active && { color: C.green }]}>{label}</Text>
    </Comp>
  );
}

// ---------------------------------------------------------------------------
// Screen + sheet
// ---------------------------------------------------------------------------
type ScreenProps = ScrollViewProps & { hero: React.ReactNode; children: React.ReactNode; nav?: boolean };

/** Full staff screen: scrollable hero + rounded sheet body + floating staff nav. */
export function StaffScreen({ hero, children, nav = true, contentContainerStyle, ...rest }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" {...rest}
        contentContainerStyle={{ paddingBottom: (nav ? STAFF_NAV_SPACE : 32) + insets.bottom }}>
        {hero}
        <View style={[styles.sheet, contentContainerStyle as any]}>{children}</View>
      </ScrollView>
      {nav ? <StaffNav /> : null}
    </View>
  );
}

/** Section title used inside sheets. */
export function SectionTitle({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Floating staff nav
// ---------------------------------------------------------------------------
const NAV = [
  { to: '/pos', label: 'POS', Icon: Banknote },
  { to: '/kds', label: 'Kitchen', Icon: ChefHat },
  { to: '/admin', label: 'Admin', Icon: Boxes },
] as const;

export function StaffNav() {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.navWrap, { paddingBottom: insets.bottom + 18 }]}>
      <View style={styles.nav}>
        <TouchableOpacity style={styles.navHome} onPress={() => router.push('/kiosk' as any)} accessibilityLabel="Open kiosk">
          <Image source={require('../../assets/CampusBITE_Logo.png')} style={{ width: 36, height: 36 }} resizeMode="contain" />
        </TouchableOpacity>
        {NAV.map(({ to, label, Icon }) => {
          const active = pathname === to;
          return (
            <TouchableOpacity key={to} onPress={() => !active && router.push(to as any)}
              style={[styles.navBtn, active && styles.navBtnActive]}
              accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={label}>
              <Icon size={20} color={active ? '#fff' : C.green} strokeWidth={active ? 2.4 : 2} />
              <Text style={[styles.navLabel, active && { color: '#fff' }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Login-required gate
// ---------------------------------------------------------------------------
export function StaffGate({ title, image }: { title: string; image: string }) {
  const router = useRouter();
  return (
    <StaffScreen nav={false} hero={<StaffHero image={image} eyebrow="Staff only" title={title} subtitle="Log in with your stall account to continue." />}>
      <View style={styles.gateCard}>
        <View style={styles.gateIcon}><Shield size={24} color={C.green} /></View>
        <Text style={styles.gateTitle}>Login required</Text>
        <Text style={styles.gateSub}>POS, Kitchen and Admin are for stall owners and the canteen manager.</Text>
        <TouchableOpacity onPress={() => router.push('/login' as any)} style={styles.primaryBtn}>
          <LogIn size={16} color="#fff" />
          <Text style={styles.primaryBtnText}>Log in</Text>
        </TouchableOpacity>
      </View>
    </StaffScreen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.page },

  hero: { backgroundColor: C.ink, justifyContent: 'space-between', paddingBottom: 46, overflow: 'hidden' },
  heroScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%', backgroundColor: 'rgba(0,0,0,0.25)' },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, gap: 10 },
  circle: { width: 44, height: 44, borderRadius: 22, backgroundColor: C.cream, alignItems: 'center', justifyContent: 'center', ...shadow.card },
  userRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 },
  userPill: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: R.pill, paddingVertical: 4, paddingLeft: 4, paddingRight: 14, flexShrink: 1 },
  avatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: '#ECEBDD', alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: C.green, fontWeight: '800', fontSize: 13 },
  userName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  userRole: { color: 'rgba(255,255,255,0.8)', fontSize: 11 },

  copy: { paddingHorizontal: 20, marginTop: 36, maxWidth: 760, width: '100%', alignSelf: 'center' },
  eyebrow: { color: 'rgba(255,255,255,0.88)', fontSize: 13, fontWeight: '500' },
  title: { color: '#fff', fontSize: 38, lineHeight: 40, fontWeight: '700', letterSpacing: -0.9, marginTop: 6 },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 20, marginTop: 6 },
  heroExtras: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 14 },
  heroChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(255,255,255,0.16)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)', borderRadius: R.pill, paddingHorizontal: 12, paddingVertical: 7 },
  heroChipActive: { backgroundColor: C.cream, borderColor: C.cream },
  heroChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },

  sheet: { marginTop: -24, backgroundColor: C.page, borderTopLeftRadius: R.sheet, borderTopRightRadius: R.sheet, padding: 16, paddingTop: 22, gap: 16, width: '100%', maxWidth: 1100, alignSelf: 'center' },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  sectionTitle: { fontSize: 20, fontWeight: '700', color: C.ink, letterSpacing: -0.4 },

  navWrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, alignItems: 'center' },
  nav: { flexDirection: 'row', width: '100%', maxWidth: 440, backgroundColor: C.cream, borderRadius: R.pill, padding: 6, gap: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', ...shadow.float },
  navHome: { width: 70, borderRadius: R.pill, backgroundColor: C.creamLight, alignItems: 'center', justifyContent: 'center', paddingVertical: 8 },
  navBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 7, borderRadius: R.pill },
  navBtnActive: { backgroundColor: C.green },
  navLabel: { color: C.green, fontSize: 12, fontWeight: '700' },

  gateCard: { backgroundColor: C.card, borderRadius: R.card, padding: 28, alignItems: 'center', borderWidth: 1, borderColor: C.line, ...shadow.card },
  gateIcon: { width: 56, height: 56, borderRadius: 28, backgroundColor: C.greenSoft, alignItems: 'center', justifyContent: 'center' },
  gateTitle: { fontSize: 20, fontWeight: '700', color: C.ink, marginTop: 12 },
  gateSub: { fontSize: 14, color: C.muted, marginTop: 6, textAlign: 'center', lineHeight: 19 },
  primaryBtn: { marginTop: 18, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: C.green, borderRadius: R.pill, paddingHorizontal: 26, paddingVertical: 14 },
  primaryBtnText: { color: '#fff', fontWeight: '800', fontSize: 15 },
});
