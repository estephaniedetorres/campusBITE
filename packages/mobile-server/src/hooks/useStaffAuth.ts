// Staff session for POS / Kitchen / Admin / Login. Reads the stored token, then confirms it with
// GET /api/auth/me so revoked, expired or legacy tokens are dropped instead of trusted.
import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  AUTH_TOKEN_KEY, AUTH_USER_KEY, ApiError, apiGet, apiPost, clearStoredAuth, setToken,
} from '../../constants/api';

export type AuthUser = {
  id: string;
  username: string;
  role: 'ADMIN' | 'STALL_OWNER';
  stall_id: string | null;
  stall_name: string | null;
  display_name: string;
  must_change_password?: number;
};

export async function saveSession(user: AuthUser, token: string) {
  setToken(token);
  await AsyncStorage.multiSet([[AUTH_USER_KEY, JSON.stringify(user)], [AUTH_TOKEN_KEY, token]]);
}

export async function logoutSession() {
  try { await apiPost('/api/auth/logout', {}); } catch {}
  await clearStoredAuth();
}

export function useStaffAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    try {
      const [[, rawUser], [, rawToken]] = await AsyncStorage.multiGet([AUTH_USER_KEY, AUTH_TOKEN_KEY]);
      if (!rawToken) { setUser(null); setTokenState(null); setToken(null); return; }
      setToken(rawToken);
      try {
        const me: AuthUser = await apiGet('/api/auth/me', rawToken);
        await AsyncStorage.setItem(AUTH_USER_KEY, JSON.stringify(me));
        setUser(me);
        setTokenState(rawToken);
      } catch (e: any) {
        if (e instanceof ApiError && (e.status === 401 || e.status === 403)) {
          await clearStoredAuth();
          setUser(null); setTokenState(null);
        } else if (rawUser) {
          // Server unreachable: keep the last known user; requests will retry
          setUser(JSON.parse(rawUser)); setTokenState(rawToken);
        }
      }
    } finally {
      setLoading(false);
    }
  }, []);

  // Re-check every time the screen comes into focus, not just on first mount: the stack keeps
  // POS/Kitchen/Admin alive while you go log in, so a mount-only check would stay "logged out".
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const logout = useCallback(async () => {
    await logoutSession();
    setUser(null); setTokenState(null);
  }, []);

  return { user, token, loading, reload, logout, setUser, setTokenState };
}

/** For POS / Kitchen / Admin: a user who still has to change their password counts as logged out. */
export function useWorkspaceAuth() {
  const a = useStaffAuth();
  const pending = !!a.user?.must_change_password;
  return { ...a, user: pending ? null : a.user, token: pending ? null : a.token };
}
