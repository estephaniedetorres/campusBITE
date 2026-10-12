// Floating cream pill nav shared by customer screens (landing, My Orders).
// Stalls / Scan open the landing page sheets via ?sheet=… so behaviour stays in one place.
import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useRouter, useFocusEffect, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Store, ScanLine, ReceiptText } from 'lucide-react-native';
import { C, R, shadow } from '../../constants/theme';
import { getMyOrders, activeCount } from '../../lib/myOrders';

type Props = {
  onHome?: () => void;
  onStalls?: () => void;
  onScan?: () => void;
};

export function CustomerNav({ onHome, onStalls, onScan }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const insets = useSafeAreaInsets();
  const [badge, setBadge] = useState(0);

  useFocusEffect(useCallback(() => {
    let alive = true;
    const load = () => getMyOrders().then(l => alive && setBadge(activeCount(l))).catch(() => {});
    load();
    const t = setInterval(load, 4000);
    return () => { alive = false; clearInterval(t); };
  }, []));

  const goHome = onHome || (() => router.push('/' as any));
  const goStalls = onStalls || (() => router.push('/?sheet=stalls' as any));
  const goScan = onScan || (() => router.push('/?sheet=scan' as any));

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { paddingBottom: insets.bottom + 18 }]}>
      <View style={styles.nav}>
        <TouchableOpacity style={styles.home} onPress={goHome} accessibilityLabel="Home">
          <Image source={require('../../assets/CampusBITE_Logo.png')} style={{ width: 36, height: 36 }} resizeMode="contain" />
        </TouchableOpacity>
        <NavBtn Icon={Store} label="Stalls" onPress={goStalls} />
        <NavBtn Icon={ScanLine} label="Scan" onPress={goScan} />
        <NavBtn Icon={ReceiptText} label="Orders" badge={badge} active={pathname === '/orders'}
          onPress={() => pathname !== '/orders' && router.push('/orders' as any)} />
      </View>
    </View>
  );
}

function NavBtn({ Icon, label, onPress, badge = 0, active = false }: { Icon: any; label: string; onPress: () => void; badge?: number; active?: boolean }) {
  return (
    <TouchableOpacity onPress={onPress} style={[styles.btn, active && styles.btnActive]}
      accessibilityRole="button" accessibilityState={{ selected: active }}
      accessibilityLabel={badge ? `${label}, ${badge} active` : label}>
      <View>
        <Icon size={20} color={C.green} strokeWidth={active ? 2.4 : 2} />
        {badge > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{badge}</Text></View>}
      </View>
      <Text style={styles.label}>{label}</Text>
    </TouchableOpacity>
  );
}

/** Bottom padding a screen should reserve so content clears the floating nav. */
export const CUSTOMER_NAV_SPACE = 110;

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, alignItems: 'center' },
  nav: { flexDirection: 'row', width: '100%', maxWidth: 440, backgroundColor: C.cream, borderRadius: R.pill, padding: 6, borderWidth: 1, borderColor: 'rgba(255,255,255,0.6)', ...shadow.float },
  home: { width: 76, borderRadius: R.pill, backgroundColor: C.creamLight, alignItems: 'center', justifyContent: 'center', paddingVertical: 8, elevation: 2, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 1 } },
  btn: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 6, borderRadius: R.pill },
  btnActive: { backgroundColor: 'rgba(15,76,74,0.08)' },
  label: { color: C.green, fontSize: 12, fontWeight: '700' },
  badge: { position: 'absolute', top: -6, right: -10, minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 4, backgroundColor: C.accent, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: C.cream },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
