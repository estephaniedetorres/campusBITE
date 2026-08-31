import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Store, ChefHat, Boxes, Wifi, Activity, LogIn, LogOut, Shield } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const nav = [
  { to: '/kiosk', label: 'Kiosk', icon: ShoppingBag, desc: 'Student Order' },
  { to: '/pos', label: 'POS', icon: Store, desc: 'Cashier' },
  { to: '/kds', label: 'Kitchen', icon: ChefHat, desc: 'KDS Board' },
  { to: '/admin', label: 'Admin', icon: Boxes, desc: 'Inventory' },
];

export function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [health, setHealth] = useState<any>(null);

  useEffect(() => {
    api.get<any>('/api/health').then(setHealth).catch(() => {});
    const t = setInterval(() => api.get<any>('/api/health').then(setHealth).catch(() => {}), 8000);
    return () => clearInterval(t);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <header className="sticky top-0 z-40 bg-white border-b border-zinc-200">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <div className="w-9 h-9 bg-orange-500 rounded-xl flex items-center justify-center text-white font-black text-lg">CB</div>
            <div>
              <div className="font-black leading-none">CampusBITE</div>
              <div className="text-xs text-zinc-500 -mt-0.5">Offline Canteen OS</div>
            </div>
          </Link>
          <nav className="flex gap-1 md:gap-2 items-center">
            {nav.map(n => {
              const active = loc.pathname.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link key={n.to} to={n.to}
                  className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition ${active ? 'bg-zinc-900 text-white' : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700'}`}>
                  <Icon size={16} /> <span className="hidden sm:inline">{n.label}</span>
                </Link>
              );
            })}
            {user ? (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l">
                <div className="hidden md:block text-right">
                  <div className="text-xs font-bold leading-none flex items-center gap-1"><Shield size={12} className={user.role==='ADMIN'?'text-zinc-900':'text-orange-500'}/> {user.display_name}</div>
                  <div className="text-[10px] text-zinc-500">{user.role}{user.stall_name ? ` • ${user.stall_name}` : ''}</div>
                </div>
                <button onClick={()=>{ logout(); navigate('/login'); }} className="flex items-center gap-1.5 bg-zinc-100 hover:bg-zinc-200 rounded-xl px-3 py-2 text-sm font-medium"><LogOut size={14}/> <span className="hidden sm:inline">Logout</span></button>
              </div>
            ) : (
              <Link to="/login" className={`ml-2 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 ${loc.pathname==='/login'?'bg-zinc-900 text-white':'bg-orange-500 text-white hover:bg-orange-600'}`}><LogIn size={16}/> Login</Link>
            )}
          </nav>
        </div>
        {health && (
          <div className="bg-zinc-900 text-zinc-100 text-xs px-4 py-1.5 flex items-center gap-4 overflow-auto">
            <span className="flex items-center gap-1.5"><Wifi size={12} className="text-emerald-400" /> {health.ips?.[0] || 'localhost'}:{health.port}</span>
            <span className="flex items-center gap-1.5"><Activity size={12} className="text-sky-400" /> WS {health.ips?.[0] || 'localhost'}:{health.port}/ws</span>
            <span className="text-zinc-400 ml-auto hidden md:inline">Connect all devices to the same Wi-Fi hotspot and open http://{health.ips?.[0] || 'localhost'}:{health.port}</span>
          </div>
        )}
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
      <footer className="text-center text-xs text-zinc-400 py-6 border-t">CampusBITE • Offline-first • SQLite + WebSockets • Foreground Service on Android</footer>
    </div>
  );
}
