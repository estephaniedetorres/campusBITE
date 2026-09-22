import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import KioskPage from './apps/kiosk/KioskPage';
import PosPage from './apps/pos/PosPage';
import KdsPage from './apps/kds/KdsPage';
import AdminPage from './apps/admin/AdminPage';
import LoginPage from './apps/auth/LoginPage';
import { AuthProvider, useAuth } from './lib/auth';
import { QrCode, ShoppingBag, LogIn, Search, MapPin, Star, Clock } from 'lucide-react';

function Home() {
  const { user } = useAuth();
  const isStaff = !!user;
  const cards = isStaff ? [
    { to: '/kiosk', title: 'Kiosk', desc: 'Browse menu · QR order', icon: ShoppingBag, accent: 'bg-stone-900 text-white' },
    { to: '/pos', title: 'POS', desc: 'Code lookup · Cash', icon: Search, accent: 'bg-white border border-stone-200 text-stone-900' },
    { to: '/kds', title: 'Kitchen', desc: 'Live tickets · Chime', icon: Clock, accent: 'bg-white border border-stone-200 text-stone-900' },
    { to: '/admin', title: 'Admin', desc: 'Menu · Stock · Analytics', icon: Star, accent: 'bg-white border border-stone-200 text-stone-900' },
  ] : [
    { to: '/kiosk', title: 'Order · CampusBITE', desc: 'Scan QR at stall', icon: ShoppingBag, accent: 'bg-stone-900 text-white' },
  ];

  return (
    <div className="space-y-6">
      {/* Hero — The Fork: editorial serif, search, warm */}
      <div className="fork-card rounded-[28px] overflow-hidden">
        <div className="bg-white px-6 sm:px-8 py-8 sm:py-10">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-medium tracking-widest text-stone-500 uppercase">Offline-first · No internet needed</div>
              <h1 className="font-serif text-3xl sm:text-4xl font-bold tracking-tight text-stone-900 mt-2 leading-tight">Find your stall.<br/>Order in seconds.</h1>
              <p className="mt-3 text-sm sm:text-base text-stone-600 max-w-xl">Your phone is the server. Scan the QR at the table, browse the menu, pay at the counter — all on the canteen hotspot.</p>
              <div className="mt-5 flex flex-wrap items-center gap-3 text-xs text-stone-500">
                <span className="flex items-center gap-1.5"><MapPin size={14}/> Hotspot: 192.168.43.1:3000</span>
                <span className="hidden sm:inline">·</span>
                <span className="flex items-center gap-1.5"><Clock size={14}/> Real-time WS</span>
                <span className="hidden sm:inline">·</span>
                <span>SQLite WAL</span>
              </div>
            </div>
            <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100 flex gap-4 items-center lg:min-w-[320px]">
              <div className="w-14 h-14 rounded-xl bg-stone-900 flex items-center justify-center text-white"><QrCode size={22}/></div>
              <div className="flex-1">
                <div className="font-semibold text-sm text-stone-900">Scan QR to order</div>
                <div className="text-xs text-stone-500">Point camera at stall QR → Kiosk opens filtered to that stall</div>
              </div>
              <a href="/kiosk" className="hidden sm:inline-flex items-center gap-2 bg-stone-900 text-white px-4 py-2.5 rounded-full text-sm font-semibold">Open Kiosk</a>
            </div>
          </div>

          <div className={`grid gap-3 mt-8 ${cards.length===1 ? 'grid-cols-1 max-w-md' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4'}`}>
            {cards.map(c=>{
              const Icon=c.icon;
              return (
                <a key={c.to} href={c.to} className={`group rounded-2xl p-4 flex flex-col gap-3 transition border ${c.accent} ${c.accent.includes('bg-stone-900') ? 'hover:bg-stone-800' : 'hover:bg-stone-50 hover:border-stone-300'}`}>
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${c.accent.includes('bg-stone-900') ? 'bg-white/10 text-white' : 'bg-stone-900 text-white'}`}><Icon size={16}/></div>
                  <div>
                    <div className="font-semibold text-sm">{c.title}</div>
                    <div className={`text-xs mt-1 ${c.accent.includes('bg-stone-900') ? 'text-white/70' : 'text-stone-500'}`}>{c.desc}</div>
                  </div>
                </a>
              );
            })}
          </div>

          {!isStaff && (
            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <a href="/kiosk" className="inline-flex items-center justify-center gap-2 bg-stone-900 text-white px-6 py-3 rounded-full font-semibold"><ShoppingBag size={16}/> Open Kiosk — no login</a>
              <a href="/login" className="inline-flex items-center justify-center gap-2 bg-white border border-stone-200 px-6 py-3 rounded-full font-medium text-stone-700"><LogIn size={16}/> Staff log in</a>
            </div>
          )}
        </div>

        <div className="bg-stone-50 border-t border-stone-100 px-6 sm:px-8 py-4 flex flex-wrap gap-2 text-xs">
          <span className="px-3 py-1.5 rounded-full bg-white border border-stone-200 text-stone-700">Hotspot: 192.168.43.1:3000</span>
          <span className="px-3 py-1.5 rounded-full bg-white border border-stone-200 text-stone-700">WS room: kds / pos / order:ID</span>
          <span className="px-3 py-1.5 rounded-full bg-fork-greenSoft border border-fork-green/10 text-fork-green">Atomic BOM · WAL</span>
        </div>
      </div>

      {/* Fork collections — How it works as 3 cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          { title: 'How it works', desc: 'Phone hotspot → Node + SQLite + WS on phone → browsers at http://<hotspot-ip>:3000', icon: MapPin },
          { title: 'Atomic BOM', desc: 'CONFIRMED deducts ingredients in one TRANSACTION. Rolls back on cancel.', icon: ShoppingBag },
          { title: 'Real-time', desc: 'Rooms: kds, pos, order:ID. Chime on new ticket.', icon: Clock },
        ].map(card=>{
          const Icon=card.icon;
          return (
            <div key={card.title} className="fork-card rounded-2xl p-5">
              <div className="w-8 h-8 rounded-full bg-stone-900 text-white flex items-center justify-center"><Icon size={14}/></div>
              <div className="font-serif font-bold text-stone-900 mt-3">{card.title}</div>
              <p className="text-sm text-stone-600 mt-2 leading-relaxed">{card.desc}</p>
            </div>
          );
        })}
      </div>

      <div className="fork-card rounded-2xl p-6">
        <h3 className="font-serif font-bold text-lg text-stone-900">Quick start</h3>
        <ol className="list-decimal ml-5 mt-3 space-y-2 text-sm text-stone-600">
          <li><code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-900">/kiosk?stall=stall-001</code> — QR auto-filters stall, add to cart, checkout → `A3X9`.</li>
          <li><code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-900">/pos</code> — staff login `potato/potato123`, enter code, Confirm cash → status `CONFIRMED` → stock −.</li>
          <li><code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-900">/kds</code> — same login → Kanban jumps New → Preparing → Ready.</li>
          <li><code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-900">/admin</code> → `admin/admin123` → Ingredients/BOM/Audits.</li>
        </ol>
        <div className="text-xs text-stone-400 mt-4">API: GET /api/health · WS /ws {"{type:'JOIN', room:'kds'}"} </div>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Layout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/kiosk" element={<KioskPage />} />
            <Route path="/pos" element={<PosPage />} />
            <Route path="/kds" element={<KdsPage />} />
            <Route path="/admin" element={<AdminPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Layout>
      </AuthProvider>
    </BrowserRouter>
  );
}
