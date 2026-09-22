import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { ChefHat, Volume2, VolumeX, Clock, Shield, LogIn } from 'lucide-react';

type Order = { id: string; pickup_code: string; status: string; total_amount: number; created_at: string };

const columns: { key: string; label: string; accent: string }[] = [
  { key: 'CONFIRMED', label: 'New', accent: 'border-sky-200 bg-sky-50/50' },
  { key: 'PREPARING', label: 'Preparing', accent: 'border-amber-200 bg-amber-50/50' },
  { key: 'READY', label: 'Ready', accent: 'border-emerald-200 bg-emerald-50/50' },
];

export default function KdsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [details, setDetails] = useState<Record<string, any>>({});
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto fork-card rounded-[24px] p-8 text-center">
        <Shield size={28} className="mx-auto text-stone-300" />
        <h2 className="font-serif font-bold text-lg mt-3 text-stone-900">Kitchen</h2>
        <p className="text-sm text-stone-500 mt-2">Login required</p>
        <Link to="/login" className="inline-flex items-center justify-center gap-2 mt-5 bg-stone-900 text-white px-6 py-3 rounded-full font-semibold"><LogIn size={16}/> Login</Link>
      </div>
    );
  }

  async function load() {
    try {
      const all = await api.get<Order[]>('/api/orders?limit=100');
      const filtered = all.filter(o => ['CONFIRMED','PREPARING','READY'].includes(o.status));
      setOrders(filtered);
      for (const o of filtered) {
        if (!details[o.id]) {
          api.get<any>(`/api/orders/${o.id}`).then(d => setDetails(prev=>({ ...prev, [o.id]: d }))).catch(()=>{});
        }
      }
    } catch {}
  }
  useEffect(()=>{ load(); const t=setInterval(load, 4000); return ()=>clearInterval(t); }, []);

  useWebSocket({
    room: 'kds',
    onMessage: (msg) => {
      if (msg.type==='ORDER_CREATED' || msg.type==='ORDER_STATUS_UPDATED') {
        if (!muted) playChime();
        load();
      }
    }
  });

  function playChime() {
    try {
      if (!audioRef.current) audioRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      const ctx = audioRef.current;
      const o = ctx.createOscillator(); const g = ctx.createGain();
      o.type='sine'; o.frequency.value=880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.22, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime+0.6);
      o.start(); o.stop(ctx.currentTime+0.6);
      setTimeout(()=>{ const o2=ctx.createOscillator(); const g2=ctx.createGain(); o2.frequency.value=1100; o2.connect(g2); g2.connect(ctx.destination); g2.gain.setValueAtTime(0.18, ctx.currentTime); g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime+0.4); o2.start(); o2.stop(ctx.currentTime+0.4); }, 250);
    } catch {}
  }

  async function advance(o: Order, next: string) {
    try { await api.patch(`/api/orders/${o.id}/status`, { status: next }); load(); } catch(e:any){ alert(e.message); }
  }

  const grouped = (status: string) => orders.filter(o=>o.status===status);

  return (
    <div className="space-y-4">
      <div className="fork-card rounded-2xl p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center"><ChefHat size={18}/></div>
        <div>
          <h2 className="font-serif font-bold text-stone-900 leading-none">Kitchen</h2>
          <div className="text-xs text-stone-500">{user.role==='ADMIN' ? 'All stalls' : user.stall_name} · Live · {orders.length} tickets</div>
        </div>
        <button onClick={()=>setMuted(v=>!v)} className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-full border text-sm font-medium ${muted?'bg-white border-stone-200 text-stone-600':'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>{muted? <VolumeX size={16}/> : <Volume2 size={16}/> } {muted?'Muted':'Sound'}</button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {columns.map(col => (
          <div key={col.key} className={`fork-card rounded-[20px] overflow-hidden border-2 ${col.accent}`}>
            <div className="px-4 py-3 flex items-center justify-between border-b border-stone-100 bg-white/70 backdrop-blur">
              <span className="font-serif font-bold text-sm text-stone-900">{col.label}</span>
              <span className="bg-stone-900 text-white text-xs font-bold px-2.5 py-1 rounded-full">{grouped(col.key).length}</span>
            </div>
            <div className="p-3 space-y-3 min-h-[50vh] bg-stone-50/30">
              {grouped(col.key).map(o => {
                const d = details[o.id];
                const ageMin = Math.floor((Date.now()-new Date(o.created_at).getTime())/60000);
                const urgent = ageMin > 12;
                return (
                  <div key={o.id} className={`bg-white rounded-2xl border p-4 shadow-fork ${urgent?'border-red-200 ring-2 ring-red-100': 'border-stone-200'}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold tracking-widest text-stone-900">{o.pickup_code}</span>
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${urgent?'bg-red-500 text-white':'bg-stone-900 text-white'}`}><Clock size={10} className="inline mr-1"/>{ageMin}m</span>
                    </div>
                    <div className="text-sm mt-3 space-y-1.5">
                      {d ? d.items.map((it:any)=><div key={it.id} className="flex justify-between bg-stone-50 rounded-xl px-3 py-2 border border-stone-100"><span className="text-stone-700">{it.menu_item_name} <span className="text-fork-green font-semibold">×{it.quantity}</span></span><span className="font-medium text-stone-900">₱{it.subtotal}</span></div>) : <div className="text-stone-400 text-xs">Loading…</div>}
                    </div>
                    <div className="flex gap-2 mt-3">
                      {col.key==='CONFIRMED' && <button onClick={()=>advance(o,'PREPARING')} className="flex-1 bg-stone-900 text-white font-semibold py-2.5 rounded-full hover:bg-stone-800">Start</button>}
                      {col.key==='PREPARING' && <button onClick={()=>advance(o,'READY')} className="flex-1 bg-fork-green text-white font-semibold py-2.5 rounded-full hover:bg-fork-greenDark">Ready</button>}
                      {col.key==='READY' && <button onClick={()=>advance(o,'COMPLETED')} className="flex-1 bg-emerald-600 text-white font-semibold py-2.5 rounded-full">Done</button>}
                    </div>
                  </div>
                );
              })}
              {grouped(col.key).length===0 && <div className="text-center text-sm text-stone-400 py-12">No tickets</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
