import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Store, ChefHat, Boxes, Wifi, Activity, LogIn, LogOut, Shield, Menu, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';

const nav = [
  { to: '/kiosk', label: 'Kiosk', icon: ShoppingBag, public: true },
  { to: '/pos', label: 'POS', icon: Store, auth: true },
  { to: '/kds', label: 'Kitchen', icon: ChefHat, auth: true },
  { to: '/admin', label: 'Admin', icon: Boxes, auth: true },
] as const;

export function Layout({ children }: { children: React.ReactNode }) {
  const loc = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [health, setHealth] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const visibleNav = nav.filter(n => (n as any).public || !!user);

  useEffect(() => {
    api.get<any>('/api/health').then(setHealth).catch(() => {});
    const t = setInterval(() => api.get<any>('/api/health').then(setHealth).catch(() => {}), 8000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => { setMenuOpen(false); }, [loc.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-stone-50">
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-stone-200 header-safe">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-3 min-w-0">
            <img src="/CampusBITE_Logo.png" alt="CampusBITE Logo" className="w-9 h-9 rounded-xl object-contain shrink-0" />
            <div className="min-w-0">
              <div className="font-serif font-bold leading-none text-stone-900 text-[18px] tracking-tight">CampusBITE</div>
              <div className="text-[11px] text-stone-500 -mt-0.5 hidden sm:block tracking-wide">Canteen OS · Offline-first</div>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-1">
            {visibleNav.map(n => {
              const active = loc.pathname.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link key={n.to} to={n.to}
                  className={`px-3.5 py-2 rounded-full text-sm font-medium flex items-center gap-2 transition ${active ? 'bg-stone-900 text-white' : 'text-stone-600 hover:text-stone-900 hover:bg-stone-100'}`}>
                  <Icon size={16} strokeWidth={active ? 2.2 : 1.8} /> {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-2">
            {user ? (
              <>
                <div className="hidden sm:block text-right">
                  <div className="text-sm font-medium leading-none text-stone-900 flex items-center justify-end gap-1.5"><Shield size={12} className={user.role==='ADMIN'?'text-stone-900':'text-orange-600'}/> {user.display_name}</div>
                  <div className="text-xs text-stone-500">{user.role}{user.stall_name ? ` · ${user.stall_name}` : ''}</div>
                </div>
                <button onClick={()=>{ logout(); navigate('/login'); }} className="hidden sm:flex items-center gap-2 px-3.5 py-2 rounded-full border border-stone-200 bg-white hover:bg-stone-50 text-sm font-medium text-stone-700">
                  <LogOut size={14}/> Logout
                </button>
                <button onClick={()=>{ logout(); navigate('/login'); }} className="sm:hidden w-9 h-9 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-700"><LogOut size={16}/></button>
              </>
            ) : (
              <Link to="/login" className={`hidden lg:inline-flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold transition ${loc.pathname==='/login'?'bg-stone-900 text-white':'bg-fork-green text-white hover:bg-fork-greenDark'}`}><LogIn size={16}/> Log in</Link>
            )}
            <button onClick={()=>setMenuOpen(!menuOpen)} className="lg:hidden w-9 h-9 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-700">
              {menuOpen ? <X size={18}/> : <Menu size={18}/>}
            </button>
          </div>
        </div>

        {menuOpen && (
          <div className="lg:hidden border-t border-stone-100 bg-white px-4 py-4">
            <div className={`grid gap-2 ${visibleNav.length===1 ? 'grid-cols-1' : 'grid-cols-2'}`}>
              {visibleNav.map(n => {
                const active = loc.pathname.startsWith(n.to);
                const Icon = n.icon;
                return (
                  <Link key={n.to} to={n.to} onClick={()=>setMenuOpen(false)}
                    className={`px-4 py-3 rounded-2xl text-sm font-medium flex items-center gap-3 border ${active ? 'bg-stone-900 text-white border-stone-900' : 'bg-white border-stone-200 text-stone-700'}`}>
                    <Icon size={18}/> {n.label}
                  </Link>
                );
              })}
            </div>
            {!user && <Link to="/login" onClick={()=>setMenuOpen(false)} className="mt-3 flex items-center justify-center gap-2 w-full py-3 rounded-2xl bg-fork-green text-white font-semibold"><LogIn size={16}/> Log in — staff only</Link>}
          </div>
        )}

        {health && (
          <div className="bg-stone-900 text-stone-100 text-xs px-4 py-2 flex items-center gap-4 overflow-x-auto">
            <span className="flex items-center gap-1.5 whitespace-nowrap"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"/> {health.ip}:{health.port}</span>
            <span className="hidden sm:flex items-center gap-1.5 text-stone-400 whitespace-nowrap"><Wifi size={12}/> Hotspot</span>
            <span className="text-stone-400 ml-auto hidden lg:inline truncate">Offline LAN · {health.ip}:{health.port} — connect all devices to same hotspot</span>
          </div>
        )}
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-safe">{children}</main>

      <footer className="border-t border-stone-100 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-stone-500">
          <span className="font-serif text-stone-900 font-semibold">CampusBITE</span>
          <span>Offline-first · SQLite WAL · WebSockets · Foreground Service</span>
        </div>
      </footer>
    </div>
  );
}
