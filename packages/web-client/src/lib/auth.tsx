import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from './api';

export type AuthUser = {
  id: string;
  username: string;
  role: 'ADMIN' | 'STALL_OWNER';
  stall_id: string | null;
  stall_name: string | null;
  display_name: string;
};

type AuthCtxType = {
  user: AuthUser | null;
  token: string | null;
  login: (username: string, pin: string) => Promise<void>;
  logout: () => void;
  isAdmin: boolean;
  isStallOwner: boolean;
};

const AuthCtx = createContext<AuthCtxType>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    try { const raw = localStorage.getItem('campusbite_user'); return raw ? JSON.parse(raw) : null; } catch { return null; }
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('campusbite_token'));

  // Rehydrate + validate on mount
  useEffect(() => {
    if (token && !user) {
      // try fetch me
      fetch('/api/auth/me', { headers: { 'x-user-id': token } })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data) { setUser(data); localStorage.setItem('campusbite_user', JSON.stringify(data)); } else { logout(); } })
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function login(username: string, pin: string) {
    const res: any = await api.post('/api/auth/login', { username, pin });
    const u: AuthUser = res.user;
    const tok: string = res.token;
    localStorage.setItem('campusbite_user', JSON.stringify(u));
    localStorage.setItem('campusbite_token', tok);
    setUser(u);
    setToken(tok);
  }

  function logout() {
    localStorage.removeItem('campusbite_user');
    localStorage.removeItem('campusbite_token');
    setUser(null);
    setToken(null);
  }

  return (
    <AuthCtx.Provider value={{ user, token, login, logout, isAdmin: user?.role === 'ADMIN', isStallOwner: user?.role === 'STALL_OWNER' }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error('useAuth must be inside AuthProvider');
  return ctx;
}

// Helper to get headers for protected requests
export function authHeaders(token: string | null): Record<string,string> {
  return token ? { 'x-user-id': token } : {};
}

// Patch api to include auth header automatically
const originalRequest = (path: string, opts: RequestInit = {}) => {
  // This is monkey-patched via api wrapper below
  return path;
};
