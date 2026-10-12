import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { Star, Clock, ArrowRight, QrCode, Store, ScanLine, ReceiptText, X, Wifi } from 'lucide-react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';

type Stall = {
  id: string;
  name: string;
  description?: string | null;
  logo_url?: string | null;
  rating?: number | null;
  rating_count?: number | null;
};

// Large hero photo per stall. Uses the stall's own image (upscaled) or a keyword fallback.
const heroFallbacks: { match: RegExp; url: string }[] = [
  { match: /fries|potato/i, url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=1400&auto=format&fit=crop&q=70' },
  { match: /ice cream|sundae|matees|shake/i, url: 'https://images.unsplash.com/photo-1488900128323-21503983a07e?w=1400&auto=format&fit=crop&q=70' },
  { match: /coffee|brew|tea/i, url: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=1400&auto=format&fit=crop&q=70' },
  { match: /burger|grill/i, url: 'https://images.unsplash.com/photo-1568909344668-6f14a07b56a0?w=1400&auto=format&fit=crop&q=70' },
];
const genericHero = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1400&auto=format&fit=crop&q=70';

function heroImage(s: Stall): string {
  if (s.logo_url) return s.logo_url.replace(/([?&])w=\d+/, '$1w=1400');
  const text = `${s.name} ${s.description || ''}`;
  return heroFallbacks.find(f => f.match.test(text))?.url || genericHero;
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

function initials(name?: string | null): string {
  if (!name) return 'CB';
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]!.toUpperCase()).join('');
}

const SLIDE_MS = 6000;

export default function HomePage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [stalls, setStalls] = useState<Stall[]>([]);
  const [health, setHealth] = useState<any>(null);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sheet, setSheet] = useState<null | 'stalls' | 'scan'>(null);
  const [qrStall, setQrStall] = useState<Stall | null>(null);
  const touchX = useRef<number | null>(null);

  useEffect(() => {
    api.get<Stall[]>('/api/stalls').then(setStalls).catch(() => {});
    api.get<any>('/api/health').then(setHealth).catch(() => {});
  }, []);

  // Same host logic as Admin → Stall QR Codes, so printed and on-screen QRs match.
  const host = useMemo(() => {
    const ip = health?.ip;
    const port = health?.port || window.location.port || '3000';
    return ip && ip !== 'localhost' ? `${ip}:${port}` : window.location.host;
  }, [health]);
  const stallUrl = (id: string) => `http://${host}/kiosk?stall=${id}`;

  // Auto-advance carousel unless the user is interacting or a sheet is open.
  useEffect(() => {
    if (stalls.length < 2 || paused || sheet || qrStall) return;
    const t = setTimeout(() => setIndex(i => (i + 1) % stalls.length), SLIDE_MS);
    return () => clearTimeout(t);
  }, [index, stalls.length, paused, sheet, qrStall]);

  const go = (dir: 1 | -1) => setIndex(i => (i + dir + stalls.length) % stalls.length);
  const current = stalls[index];

  return (
    <div
      className="relative h-[100dvh] w-full overflow-hidden bg-stone-900 text-white select-none"
      onTouchStart={e => { touchX.current = e.touches[0].clientX; setPaused(true); }}
      onTouchEnd={e => {
        const start = touchX.current;
        touchX.current = null;
        setPaused(false);
        if (start == null || stalls.length < 2) return;
        const dx = e.changedTouches[0].clientX - start;
        if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
      }}
    >
      {/* Slides: one full-bleed photo per stall, cross-fading */}
      {stalls.map((s, i) => (
        <div key={s.id} aria-hidden={i !== index}
          className={`absolute inset-0 transition-opacity duration-700 ${i === index ? 'opacity-100' : 'opacity-0'}`}>
          <img src={heroImage(s)} alt="" className="absolute inset-0 w-full h-full object-cover scale-105" />
        </div>
      ))}
      {/* Readability scrims (also the fallback look when offline images fail) */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/55 via-black/10 to-black/80" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/40 to-transparent" />

      {/* Top bar: greeting + status chip, avatar/staff entry */}
      <header className="relative z-10 header-safe">
        <div className="max-w-3xl mx-auto px-5 pt-6 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-sans text-[22px] sm:text-2xl font-semibold tracking-tight" style={{ letterSpacing: '-0.01em' }}>
              {user ? `${greeting()}, ${user.display_name.split(' ')[0]}!` : 'Welcome to CampusBITE!'}
            </h1>
            <button onClick={() => setSheet('stalls')} className="mt-2 inline-flex items-center gap-2 text-sm text-white/90 hover:text-white">
              <span className="w-5 h-5 rounded-full bg-fork-green flex items-center justify-center"><Store size={11} /></span>
              {stalls.length} stall{stalls.length === 1 ? '' : 's'} open
              <ArrowRight size={16} />
            </button>
          </div>
          <Link to={user ? '/pos' : '/login'} aria-label={user ? 'Open staff tools' : 'Stall owner log in'}
            className="shrink-0 w-14 h-14 rounded-full bg-[#ECEBDD] text-fork-green font-bold text-lg flex items-center justify-center shadow-lg">
            {user ? initials(user.display_name) : <img src="/CampusBITE_Logo.png" alt="" className="w-8 h-8 object-contain" />}
          </Link>
        </div>
      </header>

      {/* Slide copy */}
      <section className="absolute inset-x-0 bottom-[150px] z-10" aria-live="polite">
        <div className="max-w-3xl mx-auto px-5">
          {current ? (
            <div key={current.id} className="animate-[fadeUp_.5s_ease-out]">
              <div className="text-sm font-medium text-white/85">
                Stall {index + 1} of {stalls.length} · Scan the QR at the counter
              </div>
              <h2 className="font-sans mt-3 text-[40px] sm:text-6xl leading-[1.02] font-semibold" style={{ letterSpacing: '-0.025em' }}>
                {current.name}
              </h2>
              <p className="mt-3 text-base sm:text-lg text-white/90 max-w-xl leading-snug">
                {current.description || 'Canteen favourite'}
              </p>
              <div className="mt-3 flex items-center gap-3 text-sm text-white/85">
                <span className="inline-flex items-center gap-1"><Star size={14} className="text-amber-400 fill-amber-400" /> {current.rating != null ? Number(current.rating).toFixed(1) : '—'} ({current.rating_count ?? 0})</span>
                <span className="text-white/40">·</span>
                <span className="inline-flex items-center gap-1"><Clock size={14} /> 10–15 min</span>
              </div>
              <div className="mt-6 flex items-center gap-3">
                <Link to={`/kiosk?stall=${current.id}`}
                  className="inline-flex items-center justify-center px-7 py-3 rounded-full border-2 border-white/90 text-white font-semibold text-[17px] hover:bg-white hover:text-stone-900 transition">
                  Start Order
                </Link>
                <button onClick={() => setQrStall(current)}
                  className="inline-flex items-center gap-2 px-4 py-3 rounded-full bg-white/15 backdrop-blur border border-white/25 text-sm font-medium hover:bg-white/25 transition">
                  <QrCode size={16} /> Stall QR
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-3 animate-pulse">
              <div className="h-4 w-40 bg-white/20 rounded" />
              <div className="h-12 w-72 bg-white/20 rounded" />
              <div className="h-4 w-56 bg-white/20 rounded" />
            </div>
          )}

          {/* Dots + floating QR button (replaces the bag button in the reference) */}
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center gap-2" role="tablist" aria-label="Stalls">
              {stalls.map((s, i) => (
                <button key={s.id} role="tab" aria-selected={i === index} aria-label={s.name}
                  onClick={() => setIndex(i)}
                  className={`h-2 rounded-full transition-all !min-h-0 ${i === index ? 'w-8 bg-white' : 'w-2 bg-white/50'}`} />
              ))}
            </div>
            {current && (
              <button onClick={() => setQrStall(current)} aria-label={`Show ${current.name} QR`}
                className="w-14 h-14 rounded-full bg-fork-green border-2 border-white/80 shadow-xl flex items-center justify-center">
                <QrCode size={22} />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Floating bottom pill nav */}
      <nav className="absolute inset-x-0 bottom-0 z-20 pb-safe" aria-label="Main">
        <div className="max-w-md mx-auto px-4 pb-5">
          <div className="flex items-stretch bg-[#F4F1E6] text-fork-green rounded-full p-1.5 shadow-2xl border border-white/60">
            <Link to="/" aria-label="Home" className="w-[72px] shrink-0 rounded-full bg-[#FBF6E4] shadow flex items-center justify-center">
              <img src="/CampusBITE_Logo.png" alt="CampusBITE" className="w-9 h-9 object-contain" />
            </Link>
            <NavBtn icon={<Store size={20} />} label="Stalls" onClick={() => setSheet('stalls')} />
            <NavBtn icon={<ScanLine size={20} />} label="Scan" onClick={() => setSheet('scan')} />
            <NavBtn icon={<ReceiptText size={20} />} label="Order" onClick={() => navigate(current ? `/kiosk?stall=${current.id}` : '/kiosk')} />
          </div>
        </div>
      </nav>

      {/* Bottom sheet: all stalls / all stall QRs */}
      {sheet && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center" onClick={() => setSheet(null)}>
          <div role="dialog" aria-modal="true" aria-label={sheet === 'scan' ? 'Stall QR codes' : 'Stalls'}
            className="w-full sm:max-w-lg max-h-[85dvh] overflow-y-auto bg-white text-stone-900 rounded-t-[28px] sm:rounded-[28px] p-5 pb-8"
            onClick={e => e.stopPropagation()}>
            <div className="w-10 h-1.5 bg-stone-200 rounded-full mx-auto mb-4 sm:hidden" />
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <h3 className="font-sans text-xl font-semibold">{sheet === 'scan' ? 'Scan a stall QR' : 'Campus stalls'}</h3>
                <p className="text-sm text-stone-500 mt-1">
                  {sheet === 'scan'
                    ? 'Each stall has its own QR. Point your phone camera at it to open that stall’s menu.'
                    : 'Pick a stall to start your order.'}
                </p>
              </div>
              <button onClick={() => setSheet(null)} aria-label="Close" className="w-9 h-9 shrink-0 rounded-full bg-stone-100 flex items-center justify-center"><X size={16} /></button>
            </div>

            {sheet === 'scan' ? (
              <div className="grid grid-cols-2 gap-3">
                {stalls.map(s => (
                  <button key={s.id} onClick={() => setQrStall(s)} className="border border-stone-200 rounded-2xl p-3 text-center hover:border-stone-900 transition">
                    <div className="bg-white p-2 rounded-xl inline-block"><QRCodeSVG value={stallUrl(s.id)} size={112} /></div>
                    <div className="mt-2 font-semibold text-sm truncate">{s.name}</div>
                    <div className="text-[11px] text-stone-500">Tap to enlarge</div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {stalls.map((s, i) => (
                  <div key={s.id} className="flex items-center gap-3 p-2 rounded-2xl border border-stone-200">
                    <img src={heroImage(s)} alt="" className="w-14 h-14 rounded-xl object-cover bg-stone-100" />
                    <button className="flex-1 min-w-0 text-left" onClick={() => { setIndex(i); setSheet(null); }}>
                      <div className="font-semibold truncate">{s.name}</div>
                      <div className="text-xs text-stone-500 truncate">{s.description}</div>
                      <div className="text-xs text-stone-500 flex items-center gap-1 mt-0.5"><Star size={11} className="text-amber-400 fill-amber-400" /> {s.rating != null ? Number(s.rating).toFixed(1) : '—'}</div>
                    </button>
                    <button onClick={() => setQrStall(s)} aria-label={`${s.name} QR`} className="w-10 h-10 rounded-full bg-stone-100 flex items-center justify-center"><QrCode size={16} /></button>
                    <Link to={`/kiosk?stall=${s.id}`} className="px-4 py-2 rounded-full bg-fork-green text-white text-sm font-semibold">Order</Link>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 pt-4 border-t border-stone-100 flex items-center justify-between text-xs text-stone-500">
              <span className="inline-flex items-center gap-1.5"><Wifi size={12} /> {host}</span>
              <Link to="/login" className="font-medium text-stone-700 underline underline-offset-2">Stall owner log in</Link>
            </div>
          </div>
        </div>
      )}

      {/* Single stall QR modal */}
      {qrStall && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setQrStall(null)}>
          <div role="dialog" aria-modal="true" aria-label={`${qrStall.name} QR code`}
            className="bg-white text-stone-900 rounded-[28px] p-6 w-full max-w-sm text-center" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-sans text-lg font-semibold">{qrStall.name}</h3>
              <button onClick={() => setQrStall(null)} aria-label="Close" className="w-9 h-9 rounded-full bg-stone-100 flex items-center justify-center"><X size={16} /></button>
            </div>
            <div className="bg-white p-4 rounded-2xl border border-stone-200 inline-block">
              <QRCodeSVG value={stallUrl(qrStall.id)} size={208} />
            </div>
            <div className="mt-4 text-xs font-mono bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 break-all">{stallUrl(qrStall.id)}</div>
            <p className="text-xs text-stone-500 mt-2">Scan with any phone on the CampusBITE hotspot</p>
            <Link to={`/kiosk?stall=${qrStall.id}`} className="mt-4 block w-full py-3 rounded-full bg-fork-green text-white font-semibold">Order here instead</Link>
          </div>
        </div>
      )}
    </div>
  );
}

function NavBtn({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex-1 flex flex-col items-center justify-center gap-0.5 py-1.5 rounded-full hover:bg-black/5 transition">
      {icon}
      <span className="text-[12px] font-semibold">{label}</span>
    </button>
  );
}
