import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import KioskPage from './apps/kiosk/KioskPage';
import PosPage from './apps/pos/PosPage';
import KdsPage from './apps/kds/KdsPage';
import AdminPage from './apps/admin/AdminPage';
import LoginPage from './apps/auth/LoginPage';
import { AuthProvider } from './lib/auth';

function Home() {
  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-orange-500 to-amber-500 rounded-3xl p-8 text-white">
        <h1 className="text-3xl font-black">Welcome to CampusBITE</h1>
        <p className="mt-2 text-white/90 max-w-2xl">Offline-first canteen OS. Your Android phone is the server via Wi-Fi Hotspot — no internet needed. Choose your workspace:</p>
        <div className="grid md:grid-cols-4 gap-3 mt-6">
          {[
            { to: '/kiosk', title: 'Student Kiosk', desc: 'Browse menu, cart & pay at counter' },
            { to: '/pos', title: 'Stall POS', desc: 'Lookup by code & confirm cash' },
            { to: '/kds', title: 'Kitchen Display', desc: 'Live order board with chimes' },
            { to: '/admin', title: 'Inventory Admin', desc: 'Stock, BOM, audits & analytics' },
          ].map(c=>(
            <a key={c.to} href={c.to} className="bg-white text-zinc-900 rounded-2xl p-4 hover:scale-[1.02] transition">
              <div className="font-bold">{c.title}</div><div className="text-xs text-zinc-500 mt-1">{c.desc}</div>
            </a>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <div className="bg-white rounded-2xl border p-5"><div className="font-bold">How it works</div><p className="text-zinc-500 mt-2">Phone hotspot → Node.js + SQLite + WebSockets on phone → browsers connect to http://&lt;hotspot-ip&gt;:3000</p></div>
        <div className="bg-white rounded-2xl border p-5"><div className="font-bold">Atomic BOM</div><p className="text-zinc-500 mt-2">Every CONFIRMED order deducts recipe ingredients in one SQLite TRANSACTION. Rolls back on cancel.</p></div>
        <div className="bg-white rounded-2xl border p-5"><div className="font-bold">Real-time</div><p className="text-zinc-500 mt-2">WebSocket rooms: <code>kds</code>, <code>pos</code>, <code>order:ID</code>. Audio chime when new ticket arrives in kitchen.</p></div>
      </div>
      <div className="bg-white rounded-2xl border p-5">
        <h3 className="font-bold">Quick Start (Learning)</h3>
        <ol className="list-decimal ml-5 mt-2 space-y-1 text-sm text-zinc-600">
          <li>Open <code className="bg-zinc-100 px-1.5 py-0.5 rounded">/kiosk</code> — pick a stall, add burgers to cart, checkout. Note the 4-char pickup code (e.g., A3X9).</li>
          <li>Open <code className="bg-zinc-100 px-1.5 py-0.5 rounded">/pos</code> — type the code, confirm cash payment. Observes status moves PENDING → CONFIRMED and stock deducts.</li>
          <li>Open <code className="bg-zinc-100 px-1.5 py-0.5 rounded">/kds</code> on another tab/phone — see the Kanban ticket jump from New → Preparing → Ready.</li>
          <li>Open <code className="bg-zinc-100 px-1.5 py-0.5 rounded">/admin</code> → Inventory → check that buns/patties decreased, and try Stock-In or EOD audit.</li>
        </ol>
        <div className="text-xs text-zinc-400 mt-3">API docs: GET /api/health, /api/menu, /api/orders, /api/inventory, WS /ws with {`{type:'JOIN', room:'kds'}`}</div>
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
