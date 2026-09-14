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
      <div className="bg-gradient-to-br from-brand-500 to-brand-700 rounded-3xl p-8 text-brand-100 shadow-lg border border-brand-600/20">
        <h1 className="text-3xl font-black">Welcome to CampusBITE</h1>
        <p className="mt-2 text-brand-100/90 max-w-2xl">Offline-first canteen OS. Your Android phone is the server via Wi-Fi Hotspot — no internet needed. Choose your workspace:</p>
        <div className="grid md:grid-cols-4 gap-3 mt-6">
          {[
            { to: '/kiosk', title: 'Student Kiosk', desc: 'Browse menu, cart & pay at counter' },
            { to: '/pos', title: 'Stall POS', desc: 'Lookup by code & confirm cash' },
            { to: '/kds', title: 'Kitchen Display', desc: 'Live order board with chimes' },
            { to: '/admin', title: 'Inventory Admin', desc: 'Stock, BOM, audits & analytics' },
          ].map(c=>(
            <a key={c.to} href={c.to} className="bg-brand-100 text-brand-700 rounded-2xl p-4 hover:scale-[1.02] transition border border-brand-100 shadow-sm">
              <div className="font-bold">{c.title}</div><div className="text-xs text-brand-700/60 mt-1">{c.desc}</div>
            </a>
          ))}
        </div>
      </div>
      <div className="grid md:grid-cols-3 gap-4 text-sm">
        <div className="bg-brand-100 rounded-2xl border border-brand-300/40 p-5"><div className="font-bold text-brand-700">How it works</div><p className="text-brand-700/60 mt-2">Phone hotspot → Node.js + SQLite + WebSockets on phone → browsers connect to http://&lt;hotspot-ip&gt;:3000</p></div>
        <div className="bg-brand-100 rounded-2xl border border-brand-300/40 p-5"><div className="font-bold text-brand-700">Atomic BOM</div><p className="text-brand-700/60 mt-2">Every CONFIRMED order deducts recipe ingredients in one SQLite TRANSACTION. Rolls back on cancel.</p></div>
        <div className="bg-brand-100 rounded-2xl border border-brand-300/40 p-5"><div className="font-bold text-brand-700">Real-time</div><p className="text-brand-700/60 mt-2">WebSocket rooms: <code className="bg-brand-100 px-1 py-0.5 rounded text-brand-700">kds</code>, <code className="bg-brand-100 px-1 py-0.5 rounded text-brand-700">pos</code>, <code className="bg-brand-100 px-1 py-0.5 rounded text-brand-700">order:ID</code>. Audio chime when new ticket arrives in kitchen.</p></div>
      </div>
      <div className="bg-brand-100 rounded-2xl border border-brand-300/40 p-5">
        <h3 className="font-bold text-brand-700">Quick Start (Learning)</h3>
        <ol className="list-decimal ml-5 mt-2 space-y-1 text-sm text-brand-700/70">
          <li>Open <code className="bg-brand-100 px-1.5 py-0.5 rounded text-brand-700">/kiosk</code> — pick a stall, add burgers to cart, checkout. Note the 4-char pickup code (e.g., A3X9).</li>
          <li>Open <code className="bg-brand-100 px-1.5 py-0.5 rounded text-brand-700">/pos</code> — type the code, confirm cash payment. Observes status moves PENDING → CONFIRMED and stock deducts.</li>
          <li>Open <code className="bg-brand-100 px-1.5 py-0.5 rounded text-brand-700">/kds</code> on another tab/phone — see the Kanban ticket jump from New → Preparing → Ready.</li>
          <li>Open <code className="bg-brand-100 px-1.5 py-0.5 rounded text-brand-700">/admin</code> → Inventory → check that buns/patties decreased, and try Stock-In or EOD audit.</li>
        </ol>
        <div className="text-xs text-brand-700/50 mt-3">API docs: GET /api/health, /api/menu, /api/orders, /api/inventory, WS /ws with {`{type:'JOIN', room:'kds'}`}</div>
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
