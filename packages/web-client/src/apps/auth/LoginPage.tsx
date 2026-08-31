import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { LogIn, Shield, Store } from 'lucide-react';

export default function LoginPage() {
  const { user, login, logout } = useAuth();
  const nav = useNavigate();
  const [username, setUsername] = useState('');
  const [pin, setPin] = useState('');
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
    } finally { setLoading(false); }
  }

  if (user) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-2xl border p-6">
        <h2 className="font-bold text-lg">You are logged in</h2>
        <div className="mt-3 bg-zinc-50 rounded-xl p-4 text-sm">
          <div><b>{user.display_name}</b> — <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${user.role==='ADMIN'?'bg-zinc-900 text-white':'bg-orange-100 text-orange-700'}`}>{user.role}</span></div>
          <div className="text-zinc-500">@{user.username} {user.stall_name ? `• ${user.stall_name} (${user.stall_id})` : '• All stalls'}</div>
        </div>
        <div className="flex gap-3 mt-4">
          <button onClick={()=>nav('/admin')} className="flex-1 bg-zinc-900 text-white font-semibold py-3 rounded-xl">Go to Admin</button>
          <button onClick={logout} className="border px-6 py-3 rounded-xl font-medium">Logout</button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto space-y-4">
      <div className="bg-white rounded-2xl border p-6">
        <h2 className="font-black text-xl flex items-center gap-2"><LogIn size={18}/> CampusBITE Login</h2>
        <p className="text-sm text-zinc-500 mt-1">Hybrid access: <b>ADMIN</b> manages all stalls & inventory, <b>STALL_OWNER</b> edits only own menu.</p>

        <form onSubmit={handleLogin} className="mt-6 space-y-4">
          <div>
            <label className="text-sm font-semibold">Username</label>
            <input value={username} onChange={e=>setUsername(e.target.value)} placeholder="admin / grill / brew" className="w-full border-2 border-zinc-200 rounded-xl px-4 py-3 mt-1" />
          </div>
          <div>
            <label className="text-sm font-semibold">PIN</label>
            <input value={pin} onChange={e=>setPin(e.target.value)} type="password" placeholder="admin123 / grill123 / brew123" className="w-full border-2 border-zinc-200 rounded-xl px-4 py-3 mt-1" />
          </div>
          {err && <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl px-4 py-3 text-sm">{err}</div>}
          <button disabled={loading} className="w-full bg-zinc-900 text-white font-bold py-3.5 rounded-xl disabled:bg-zinc-300">
            {loading ? 'Logging in…' : 'Login'}
          </button>
        </form>

        <div className="mt-6 text-xs text-zinc-500 bg-zinc-50 rounded-xl p-4">
          <div className="font-bold text-zinc-700">Demo accounts (seeded):</div>
          <div className="mt-2 grid gap-2">
            <div className="flex items-center gap-2"><Shield size={14}/> <b>admin</b> / admin123 — <span>ADMIN (all stalls, inventory, audits, users)</span></div>
            <div className="flex items-center gap-2"><Store size={14}/> <b>grill</b> / grill123 — <span>STALL_OWNER Campus Grill (stall-001) menu only</span></div>
            <div className="flex items-center gap-2"><Store size={14}/> <b>brew</b> / brew123 — <span>STALL_OWNER Brew & Bites (stall-002) menu only</span></div>
          </div>
          <div className="mt-3">Create more users as ADMIN in <code className="bg-white px-1 py-0.5 rounded border">Admin → Users</code>.</div>
        </div>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-sm">
        <div className="font-bold">No login? Public access</div>
        <div className="text-zinc-600">Kiosk, POS and KDS work without login (public menu browsing). Login is only required to <b>add/edit menus</b> and manage inventory.</div>
      </div>
    </div>
  );
}
