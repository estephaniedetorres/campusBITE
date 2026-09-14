import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ShoppingBag, Store, ChefHat, Boxes, Wifi, Activity, LogIn, LogOut, Shield, Menu, X } from 'lucide-react';
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
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    api.get<any>('/api/health').then(setHealth).catch(() => {});
    const t = setInterval(() => api.get<any>('/api/health').then(setHealth).catch(() => {}), 8000);
    return () => clearInterval(t);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMenuOpen(false); }, [loc.pathname]);

  return (
    <div className="min-h-screen flex flex-col bg-brand-100">
      <header className="sticky top-0 z-40 bg-brand-100 border-b border-brand-300/40 shadow-sm header-safe">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-3 flex items-center justify-between gap-2 sm:gap-4">
          <Link to="/" className="flex items-center gap-2 sm:gap-3 min-w-0">
            <img src="/CampusBITE_logo.png" alt="CampusBITE logo" className="w-9 h-9 sm:w-10 sm:h-10 object-contain shrink-0" />
            <div className="min-w-0">
              <div className="font-black leading-none text-brand-700 text-sm sm:text-base truncate">CampusBITE</div>
              <div className="text-[11px] sm:text-xs text-brand-700/60 -mt-0.5 hidden sm:block">Offline Canteen OS</div>
            </div>
          </Link>
          {/* Desktop nav - hidden on mobile/tablet */}
          <nav className="hidden lg:flex gap-1 xl:gap-2 items-center">
            {nav.map(n => {
              const active = loc.pathname.startsWith(n.to);
              const Icon = n.icon;
              return (
                <Link key={n.to} to={n.to}
                  className={`px-3 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition border min-h-[44px] ${active ? 'bg-brand-600 text-brand-100 border-brand-600 shadow-sm' : 'bg-brand-100 hover:bg-brand-300 text-brand-700 border-brand-300/40'}`}>
                  <Icon size={16} /> <span>{n.label}</span>
                </Link>
              );
            })}
          </nav>
          {/* Right side: user at top-right always visible (mobile/tablet/laptop) + hamburger */}
          <div className="flex items-center gap-2 sm:gap-3">
            {user ? (
              <div className="flex items-center gap-2">
                <div className="text-right hidden sm:block">
                  <div className="text-xs font-bold leading-none flex items-center justify-end gap-1 text-brand-700"><Shield size={12} className={user.role==='ADMIN'?'text-brand-700':'text-brand-500'}/><span className="truncate max-w-[90px] sm:max-w-[120px]">{user.display_name}</span></div>
                  <div className="text-[10px] text-brand-700/60 truncate max-w-[120px]">{user.role}{user.stall_name ? ` • ${user.stall_name}` : ''}</div>
                </div>
                <div className="sm:hidden text-right min-w-0">
                  <div className="text-xs font-bold leading-none text-brand-700 truncate max-w-[80px]">{user.display_name}</div>
                  <div className="text-[9px] text-brand-700/60 truncate">{user.role}</div>
                </div>
                <button onClick={()=>{ logout(); navigate('/login'); }} className="flex items-center gap-1.5 bg-brand-100 hover:bg-brand-300 border border-brand-300/40 rounded-xl px-2.5 sm:px-3 py-2 sm:py-2.5 text-xs sm:text-sm font-medium text-brand-700 min-h-[40px] sm:min-h-[44px] shrink-0"><LogOut size={14}/> <span className="hidden sm:inline">Logout</span><span className="sm:hidden">Out</span></button>
              </div>
            ) : (
              <Link to="/login" className={`hidden lg:flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium border transition min-h-[44px] ${loc.pathname==='/login'?'bg-brand-700 text-brand-100 border-brand-700':'bg-brand-600 text-brand-100 hover:bg-brand-300 border-brand-600 hover:border-brand-300 shadow-sm'}` }><LogIn size={16}/> Login</Link>
            )}
            {/* Mobile/Tablet login when not logged in - also top-right */}
            {!user && (
              <Link to="/login" className={`lg:hidden flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-medium border min-h-[40px] sm:min-h-[44px] ${loc.pathname==='/login'?'bg-brand-700 text-brand-100 border-brand-700':'bg-brand-600 text-brand-100 border-brand-600'}`}><LogIn size={14}/> Login</Link>
            )}
            {/* Mobile hamburger - only for nav */}
            <button onClick={()=>setMenuOpen(!menuOpen)} className="lg:hidden p-2 sm:p-2.5 rounded-xl border border-brand-300/40 bg-brand-100 hover:bg-brand-300 text-brand-700 min-w-[40px] sm:min-w-[44px] min-h-[40px] sm:min-h-[44px] flex items-center justify-center shrink-0" aria-label="Menu">
              {menuOpen ? <X size={18} className="sm:w-5 sm:h-5"/> : <Menu size={18} className="sm:w-5 sm:h-5"/>}
            </button>
          </div>
        </div>
        {/* Mobile drawer - nav only, no user (user already at top-right) */}
        {menuOpen && (
          <div className="lg:hidden border-t border-brand-300/40 bg-brand-100 px-3 py-3 shadow-lg">
            <div className="grid grid-cols-2 gap-2">
              {nav.map(n => {
                const active = loc.pathname.startsWith(n.to);
                const Icon = n.icon;
                return (
                  <Link key={n.to} to={n.to} onClick={()=>setMenuOpen(false)}
                    className={`px-3 py-3 rounded-xl text-sm font-medium flex items-center gap-2 border min-h-[44px] ${active ? 'bg-brand-600 text-brand-100 border-brand-600' : 'bg-brand-100 text-brand-700 border-brand-300/40'}`}>
                    <Icon size={16} /> {n.label}
                  </Link>
                );
              })}
            </div>
          </div>
        )}
        {health && (
          <div className="bg-brand-700 text-brand-100 text-[11px] sm:text-xs px-3 sm:px-4 py-1.5 flex items-center gap-3 sm:gap-4 overflow-x-auto scrollbar-none">
            <span className="flex items-center gap-1.5 whitespace-nowrap"><Wifi size={12} className="text-brand-100" /> {health.ips?.[0] || 'localhost'}:{health.port}</span>
            <span className="flex items-center gap-1.5 whitespace-nowrap"><Activity size={12} className="text-brand-300" /> WS {health.ips?.[0] || 'localhost'}:{health.port}/ws</span>
            <span className="text-brand-100/60 ml-auto hidden lg:inline whitespace-nowrap">Connect all devices to same Wi-Fi hotspot → http://{health.ips?.[0] || 'localhost'}:{health.port}</span>
          </div>
        )}
      </header>
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6 pb-safe">{children}</main>
      <footer className="text-center text-[11px] sm:text-xs text-brand-700/50 py-4 sm:py-6 border-t border-brand-300/30 px-3">CampusBITE • Offline-first • SQLite + WebSockets • Foreground Service on Android</footer>
    </div>
  );
}
