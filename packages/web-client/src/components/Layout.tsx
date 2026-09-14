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
    <div className="min-h-screen flex flex-col bg-brand-100">
      <header className="sticky top-0 z-40 bg-brand-100 border-b border-brand-300/40 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3">
            <img src="/CampusBITE_logo.png" alt="CampusBITE logo" className="w-10 h-10 object-contain shrink-0" />
            <div>
              <div className="font-black leading-none text-brand-700">CampusBITE</div>
              <div className="text-xs text-brand-700/60 -mt-0.5">Offline Canteen OS</div>
            </div>
          </Link>
          <nav className="flex gap-1 md:gap-2 items-center">
            {nav.map(n => {
              const active = loc.pathname.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link key={n.to} to={n.to}
                  className={`px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 transition border ${active ? 'bg-brand-600 text-brand-100 border-brand-600 shadow-sm' : 'bg-brand-100 hover:bg-brand-300 text-brand-700 border-brand-300/40'}`}>
                  <Icon size={16} /> <span className="hidden sm:inline">{n.label}</span>
                </Link>
              );
            })}
            {user ? (
              <div className="flex items-center gap-2 ml-2 pl-2 border-l border-brand-300/40">
                <div className="hidden md:block text-right">
                  <div className="text-xs font-bold leading-none flex items-center gap-1 text-brand-700"><Shield size={12} className={user.role==='ADMIN'?'text-brand-700':'text-brand-500'}/> {user.display_name}</div>
                  <div className="text-[10px] text-brand-700/60">{user.role}{user.stall_name ? ` • ${user.stall_name}` : ''}</div>
                </div>
                <button onClick={()=>{ logout(); navigate('/login'); }} className="flex items-center gap-1.5 bg-brand-100 hover:bg-brand-300 border border-brand-300/40 rounded-xl px-3 py-2 text-sm font-medium text-brand-700"><LogOut size={14}/> <span className="hidden sm:inline">Logout</span></button>
              </div>
            ) : (
              <Link to="/login" className={`ml-2 px-3 py-2 rounded-xl text-sm font-medium flex items-center gap-2 border transition ${loc.pathname==='/login'?'bg-brand-700 text-brand-100 border-brand-700':'bg-brand-600 text-brand-100 hover:bg-brand-300 border-brand-600 hover:border-brand-300 shadow-sm'}`}><LogIn size={16}/> Login</Link>
            )}
          </nav>
        </div>
        {health && (
          <div className="bg-brand-700 text-brand-100 text-xs px-4 py-1.5 flex items-center gap-4 overflow-auto">
            <span className="flex items-center gap-1.5"><Wifi size={12} className="text-brand-100" /> {health.ips?.[0] || 'localhost'}:{health.port}</span>
            <span className="flex items-center gap-1.5"><Activity size={12} className="text-brand-300" /> WS {health.ips?.[0] || 'localhost'}:{health.port}/ws</span>
            <span className="text-brand-100/60 ml-auto hidden md:inline">Connect all devices to the same Wi-Fi hotspot and open http://{health.ips?.[0] || 'localhost'}:{health.port}</span>
          </div>
        )}
      </header>
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 py-6">{children}</main>
      <footer className="text-center text-xs text-brand-700/50 py-6 border-t border-brand-300/30">CampusBITE • Offline-first • SQLite + WebSockets • Foreground Service on Android</footer>
    </div>
  );
}
