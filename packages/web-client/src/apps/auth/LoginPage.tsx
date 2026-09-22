import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { LogIn, Shield, Store, Eye, EyeOff, ArrowRight, UtensilsCrossed, Sparkles } from 'lucide-react';

export default function LoginPage() {
  const { user, login, logout } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setErr('');
    setLoading(true);
    try {
      await login(username.trim(), pin.trim());
      nav('/admin');
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  if (user) {
    return (
      <div className="max-w-lg mx-auto">
        {/* Brand lockup — keep CampusBITE identity */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-stone-900 flex items-center justify-center text-white font-serif font-bold text-[13px] tracking-wide shrink-0 shadow-sm">
              CB
            </div>
            <span className="font-serif font-bold text-[22px] tracking-tight text-stone-900">CampusBITE</span>
          </div>
          <p className="text-sm text-stone-500 mt-2">You&apos;re signed in — welcome back</p>
        </div>

        <div className="fork-card rounded-2xl overflow-hidden">
          <div className="p-6 sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="font-serif font-bold text-xl text-stone-900 tracking-tight">You are logged in</h2>
                <p className="text-sm text-stone-500 mt-1">Session active on this device</p>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold tracking-wide text-white">
                <Sparkles size={12} /> Active
              </span>
            </div>

            <div className="mt-5 bg-stone-50 rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-stone-200 flex items-center justify-center text-stone-900">
                  <Shield size={18} />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-stone-900">{user.display_name}</span>
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold tracking-wide border ${
                        user.role === 'ADMIN'
                          ? 'bg-stone-900 text-white border-stone-900'
                          : 'bg-white text-stone-700 border-stone-200'
                      }`}
                    >
                      {user.role}
                    </span>
                  </div>
                  <div className="text-sm text-stone-500 truncate">
                    @{user.username} {user.stall_name ? `· ${user.stall_name} (${user.stall_id})` : '· All stalls'}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => nav('/admin')}
                className="flex-1 inline-flex items-center justify-center gap-2 bg-stone-900 text-white font-semibold py-3 rounded-xl hover:bg-stone-800 transition shadow-sm"
              >
                Go to Admin <ArrowRight size={16} />
              </button>
              <button
                onClick={logout}
                className="px-6 py-3 rounded-xl font-medium border border-stone-200 bg-white text-stone-700 hover:bg-stone-50 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto">
      {/* Brand header — serif, warm, editorial */}
      <div className="text-center mb-6 sm:mb-8">
        <div className="inline-flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-stone-900 flex items-center justify-center text-white font-serif font-bold text-[13px] tracking-wide shrink-0 shadow-sm">
            CB
          </div>
          <span className="font-serif font-bold text-[22px] tracking-tight text-stone-900">CampusBITE</span>
        </div>
        <h1 className="font-serif font-bold text-[28px] sm:text-[30px] tracking-tight text-stone-900 mt-4 leading-none">
          Welcome back
        </h1>
        <p className="text-sm text-stone-500 mt-2 max-w-[32ch] mx-auto leading-relaxed">
          Sign in to manage menus, stalls & inventory. Kiosk and POS remain open for public browsing.
        </p>
      </div>

      {/* Main card — fork-card, rounded-2xl, soft shadow */}
      <div className="fork-card rounded-2xl overflow-hidden">
        {/* Card header */}
        <div className="px-6 sm:px-8 pt-7 pb-6 border-b border-stone-100">
          <h2 className="font-serif font-bold text-xl text-stone-900 tracking-tight flex items-center gap-2.5">
            <span className="w-8 h-8 rounded-xl bg-stone-900 flex items-center justify-center text-white">
              <LogIn size={16} />
            </span>
            Staff sign in
          </h2>
          <p className="text-sm text-stone-500 mt-2 leading-relaxed">
            Hybrid access: <span className="font-semibold text-stone-900">ADMIN</span> manages all stalls &amp; inventory,{' '}
            <span className="font-semibold text-stone-900">STALL_OWNER</span> edits only own menu.
          </p>
        </div>

        <div className="p-6 sm:p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="text-sm font-medium text-stone-700">Username</label>
              <input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="admin / grill / brew"
                autoComplete="username"
                className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3.5 mt-1.5 text-[15px] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-stone-700">PIN / Password</label>
              <div className="relative mt-1.5">
                <input
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  type={showPin ? 'text' : 'password'}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-white border border-stone-200 rounded-xl px-4 py-3.5 pr-11 text-[15px] text-stone-900 placeholder:text-stone-400 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPin((v) => !v)}
                  className="absolute right-1.5 top-1.5 w-9 h-9 rounded-lg flex items-center justify-center text-stone-500 hover:text-stone-900 hover:bg-stone-50 transition"
                  aria-label={showPin ? 'Hide password' : 'Show password'}
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
              <p className="text-xs text-stone-500 mt-2">Use demo credentials below to explore roles.</p>
            </div>

            {err && (
              <div className="bg-red-50 border border-red-200 text-red-800 rounded-xl px-4 py-3 text-sm leading-relaxed">
                {err}
              </div>
            )}

            <button
              disabled={loading}
              className="w-full inline-flex items-center justify-center gap-2 bg-stone-900 text-white font-semibold py-3.5 rounded-xl hover:bg-stone-800 active:bg-stone-900 disabled:bg-stone-300 disabled:text-stone-500 disabled:cursor-not-allowed transition shadow-sm"
            >
              {loading ? (
                'Logging in…'
              ) : (
                <>
                  Login <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Demo accounts — warm stone-50 inset */}
          <div className="mt-7 bg-stone-50 rounded-2xl border border-stone-200 p-5">
            <div className="flex items-center gap-2 text-stone-900">
              <UtensilsCrossed size={14} className="text-stone-500" />
              <span className="text-xs font-bold tracking-widest uppercase text-stone-700">Demo accounts — seeded</span>
            </div>

            <div className="mt-3 grid gap-2.5">
              <div className="flex items-start gap-3 bg-white border border-stone-200 rounded-xl px-3.5 py-3">
                <span className="w-7 h-7 rounded-full bg-stone-900 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Shield size={13} />
                </span>
                <div className="text-sm leading-snug min-w-0">
                  <span className="font-semibold text-stone-900">admin</span>
                  <span className="text-stone-400 mx-1.5">/</span>
                  <span className="font-mono text-sm text-stone-700">admin123</span>
                  <span className="text-stone-300 mx-1.5">—</span>
                  <span className="text-stone-600">ADMIN · all stalls, inventory, audits, users</span>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white border border-stone-200 rounded-xl px-3.5 py-3">
                <span className="w-7 h-7 rounded-full bg-white border border-stone-200 text-stone-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Store size={13} />
                </span>
                <div className="text-sm leading-snug min-w-0">
                  <span className="font-semibold text-stone-900">grill</span>
                  <span className="text-stone-400 mx-1.5">/</span>
                  <span className="font-mono text-sm text-stone-700">grill123</span>
                  <span className="text-stone-300 mx-1.5">—</span>
                  <span className="text-stone-600">STALL_OWNER · Campus Grill (stall-001) menu only</span>
                </div>
              </div>

              <div className="flex items-start gap-3 bg-white border border-stone-200 rounded-xl px-3.5 py-3">
                <span className="w-7 h-7 rounded-full bg-white border border-stone-200 text-stone-700 flex items-center justify-center shrink-0 mt-0.5">
                  <Store size={13} />
                </span>
                <div className="text-sm leading-snug min-w-0">
                  <span className="font-semibold text-stone-900">brew</span>
                  <span className="text-stone-400 mx-1.5">/</span>
                  <span className="font-mono text-sm text-stone-700">brew123</span>
                  <span className="text-stone-300 mx-1.5">—</span>
                  <span className="text-stone-600">STALL_OWNER · Brew &amp; Bites (stall-002) menu only</span>
                </div>
              </div>
            </div>

            <p className="text-xs text-stone-500 mt-3 leading-relaxed">
              Create more users as ADMIN in{' '}
              <code className="bg-white px-1.5 py-0.5 rounded border border-stone-200 font-mono text-[11px] text-stone-700">
                Admin → Users
              </code>
              .
            </p>
          </div>
        </div>
      </div>

      {/* Public access note — second fork-card */}
      <div className="fork-card rounded-2xl p-5 sm:p-6 mt-4 flex gap-4">
        <div className="w-9 h-9 rounded-xl bg-stone-50 border border-stone-200 flex items-center justify-center text-stone-700 shrink-0">
          <Sparkles size={16} />
        </div>
        <div className="min-w-0">
          <div className="font-serif font-semibold text-stone-900">No login? Public access</div>
          <p className="text-sm text-stone-500 mt-1 leading-relaxed">
            Kiosk, POS and KDS work without login for public menu browsing. Login is only required to{' '}
            <span className="font-semibold text-stone-900">add / edit menus</span> and manage inventory.
          </p>
        </div>
      </div>

      <p className="text-center text-xs text-stone-400 mt-6">Offline-first · Works on the campus hotspot</p>
    </div>
  );
}
