import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import KioskPage from './apps/kiosk/KioskPage';
import PosPage from './apps/pos/PosPage';
import KdsPage from './apps/kds/KdsPage';
import AdminPage from './apps/admin/AdminPage';
import LoginPage from './apps/auth/LoginPage';
import { AuthProvider } from './lib/auth';
import { Star, Clock, MapPin, Flame } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from './lib/api';

function Home() {
  const [stalls, setStalls] = useState<any[]>([]);
  useEffect(() => { api.get<any[]>('/api/stalls').then(setStalls).catch(()=>{}); }, []);
  const matees = stalls.find(s=> s.id==='stall-002' || s.name==='Matees');
  const potato = stalls.find(s=> s.id==='stall-001' || s.name==='Potato Corner');
  // Real ratings from DB, no hardcode
  const mateesRating = matees?.rating != null ? Number(matees.rating).toFixed(1) : '—';
  const potatoRating = potato?.rating != null ? Number(potato.rating).toFixed(1) : '—';
  return (
    <div className="space-y-6">
      {/* Hero — Promotional, The Fork style */}
      <div className="fork-card rounded-[28px] overflow-hidden">
        <div className="grid lg:grid-cols-[1.1fr_0.9fr]">
          <div className="px-6 sm:px-8 py-8 sm:py-10">
            <div className="inline-flex items-center gap-2 text-xs font-semibold tracking-widest text-fork-green uppercase bg-fork-greenSoft px-3 py-1 rounded-full">CampusBITE · Offline Canteen</div>
            <h1 className="font-serif text-3xl sm:text-4xl lg:text-[42px] font-bold tracking-tight text-stone-900 mt-4 leading-[0.95]">Canteen favorites,<br/><span className="text-fork-green">ready when you are.</span></h1>
            <p className="mt-4 text-sm sm:text-base text-stone-600 max-w-lg leading-relaxed">Ice cream from Matees. Famous fries from Potato Corner. Scan, order, pick up.</p>
            <div className="mt-6 flex flex-wrap gap-3">
              <a href="/kiosk" className="inline-flex items-center justify-center bg-stone-900 text-white px-6 py-3 rounded-full font-semibold hover:bg-stone-800">Order now</a>
              <span className="inline-flex items-center gap-2 text-xs text-stone-500 px-3 py-3"><MapPin size={14}/> Hotspot: 192.168.43.1:3000 · <Clock size={14}/> 10-15 min</span>
            </div>
            <div className="mt-6 flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 font-medium text-stone-700"><Star size={14} className="text-amber-400 fill-amber-400"/> {mateesRating} Matees</span>
              <span className="text-stone-300">·</span>
              <span className="flex items-center gap-1.5 font-medium text-stone-700"><Flame size={14} className="text-orange-500"/> {potatoRating} Potato Corner</span>
            </div>
          </div>
          <div className="relative h-64 sm:h-72 lg:h-auto bg-stone-100">
            <img src="https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=800&auto=format&fit=crop&q=60" alt="Canteen" className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent lg:bg-gradient-to-l" />
            <div className="absolute bottom-4 left-4 right-4 flex gap-3">
              <div className="flex-1 bg-white/95 backdrop-blur rounded-2xl p-3 border border-white/20">
                <div className="text-xs font-semibold text-stone-900">Matees</div>
                <div className="text-xs text-stone-500">Ice Cream · {mateesRating} ★ · Sundaes</div>
              </div>
              <div className="flex-1 bg-white/95 backdrop-blur rounded-2xl p-3 border border-white/20">
                <div className="text-xs font-semibold text-stone-900">Potato Corner</div>
                <div className="text-xs text-stone-500">Fries · {potatoRating} ★ · Loaded</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Featured stalls — promo */}
      <div className="grid md:grid-cols-2 gap-4">
        <a href="/kiosk?stall=stall-002" className="fork-card rounded-[20px] overflow-hidden group hover:shadow-forkHover transition">
          <div className="h-36 relative">
            <img src="https://images.unsplash.com/photo-1495147466023-a36482277724?w=600&auto=format&fit=crop&q=60" alt="Matees" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
              <div>
                <div className="font-serif font-bold text-white">Matees</div>
                <div className="text-xs text-white/80">Ice Cream · Sundaes</div>
              </div>
              <span className="bg-white text-stone-900 text-xs font-bold px-2.5 py-1 rounded-full">{mateesRating} ★</span>
            </div>
          </div>
          <div className="p-4 flex items-center justify-between">
            <span className="text-sm text-stone-600">Vanilla · Choco · Strawberry Sundae</span>
            <span className="text-sm font-semibold text-stone-900">View →</span>
          </div>
        </a>
        <a href="/kiosk?stall=stall-001" className="fork-card rounded-[20px] overflow-hidden group hover:shadow-forkHover transition">
          <div className="h-36 relative">
            <img src="https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=60" alt="Potato Corner" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.02] transition duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="absolute bottom-3 left-4 right-4 flex items-end justify-between">
              <div>
                <div className="font-serif font-bold text-white">Potato Corner</div>
                <div className="text-xs text-white/80">World Famous Flavored Fries</div>
              </div>
              <span className="bg-white text-stone-900 text-xs font-bold px-2.5 py-1 rounded-full">{potatoRating} ★</span>
            </div>
          </div>
          <div className="p-4 flex items-center justify-between">
            <span className="text-sm text-stone-600">Plain · Cheese · Loaded Chili</span>
            <span className="text-sm font-semibold text-stone-900">View →</span>
          </div>
        </a>
      </div>

      <div className="fork-card rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <div className="font-serif font-bold text-stone-900">Scan. Order. Pick up.</div>
          <div className="text-sm text-stone-500">Kiosk is public — no account needed. Open via QR at the stall.</div>
        </div>
        <a href="/kiosk" className="shrink-0 bg-stone-900 text-white px-6 py-3 rounded-full font-semibold">Start ordering</a>
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
