import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { ChefHat, Volume2, VolumeX, Clock, Shield, LogIn } from 'lucide-react';

type Order = { id: string; pickup_code: string; status: string; total_amount: number; created_at: string };

const columns: { key: string; label: string; color: string }[] = [
  { key: 'CONFIRMED', label: 'New Orders', color: 'border-sky-300 bg-sky-50' },
  { key: 'PREPARING', label: 'In Preparation', color: 'border-violet-300 bg-violet-50' },
  { key: 'READY', label: 'Ready for Pickup', color: 'border-emerald-300 bg-emerald-50' },
];

export default function KdsPage() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [details, setDetails] = useState<Record<string, any>>({});
  const [muted, setMuted] = useState(false);
  const audioRef = useRef<AudioContext | null>(null);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-2xl border p-8 text-center">
        <Shield size={32} className="mx-auto text-zinc-400" />
        <h2 className="font-bold text-lg mt-3">KDS — Staff only</h2>
        <p className="text-sm text-zinc-500 mt-2">Kitchen Display is for staff. Kiosk is the only public page.<br/>Stall owners see only own stall tickets, ADMIN sees all.</p>
        <Link to="/login" className="inline-flex items-center gap-2 mt-4 bg-zinc-900 text-white px-6 py-3 rounded-xl font-semibold"><LogIn size={16}/> Login to KDS</Link>
      </div>
    );
  }

  async function load() {
    try {
      const all = await api.get<Order[]>('/api/orders?limit=100');
      const filtered = all.filter(o => ['CONFIRMED','PREPARING','READY'].includes(o.status));
      setOrders(filtered);
      // fetch items for each order lazily
      for (const o of filtered) {
        if (!details[o.id]) {
          api.get<any>(`/api/orders/${o.id}`).then(d => setDetails(prev=>({ ...prev, [o.id]: d }))).catch(()=>{});
        }
      }
    } catch (e:any){ console.error(e.message); }
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
      g.gain.setValueAtTime(0.25, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime+0.6);
      o.start(); o.stop(ctx.currentTime+0.6);
      // second beep
      setTimeout(()=>{ const o2=ctx.createOscillator(); const g2=ctx.createGain(); o2.frequency.value=1100; o2.connect(g2); g2.connect(ctx.destination); g2.gain.setValueAtTime(0.2, ctx.currentTime); g2.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime+0.4); o2.start(); o2.stop(ctx.currentTime+0.4); }, 250);
    } catch {}
  }

  async function advance(o: Order, next: string) {
    try { await api.patch(`/api/orders/${o.id}/status`, { status: next }); load(); } catch(e:any){ alert(e.message); }
  }

  const grouped = (status: string) => orders.filter(o=>o.status===status);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center"><ChefHat size={18} /></div>
        <div><h2 className="font-black text-lg leading-none">Kitchen Display System</h2><p className="text-xs text-zinc-500">Live Kanban • {user.role==='ADMIN' ? 'All stalls' : user.stall_name} • Auto-refresh + WebSocket</p></div>
        <button onClick={()=>setMuted(v=>!v)} className={`ml-auto flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium ${muted?'bg-zinc-100':'bg-emerald-50 border-emerald-200 text-emerald-700'}`}>{muted? <VolumeX size={16}/> : <Volume2 size={16}/> } {muted?'Muted':'Sound On'}</button>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        {columns.map(col => (
          <div key={col.key} className={`rounded-2xl border-2 ${col.color} min-h-[50vh]`}>
            <div className="p-3 border-b border-inherit flex items-center justify-between">
              <span className="font-bold text-sm">{col.label}</span>
              <span className="bg-white text-xs font-black px-2.5 py-1 rounded-full border">{grouped(col.key).length}</span>
            </div>
            <div className="p-3 space-y-3">
              {grouped(col.key).map(o => {
                const d = details[o.id];
                const ageMin = Math.floor((Date.now()-new Date(o.created_at).getTime())/60000);
                const urgent = ageMin > 10;
                return (
                  <div key={o.id} className={`bg-white rounded-2xl border-2 p-4 shadow-sm ${urgent?'border-red-300 ring-2 ring-red-100':''}`}>
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-black tracking-widest text-xl">{o.pickup_code}</span>
                      <span className={`text-xs font-bold px-2 py-1 rounded-full ${urgent?'bg-red-500 text-white':'bg-zinc-900 text-white'}`}><Clock size={10} className="inline mr-1 -mt-0.5" />{ageMin}m</span>
                    </div>
                    <div className="text-sm mt-2 space-y-1">
                      {d ? d.items.map((it:any)=><div key={it.id} className="flex justify-between bg-zinc-50 rounded-lg px-3 py-2"><span className="font-medium">{it.menu_item_name} <span className="text-orange-600">×{it.quantity}</span></span><span>₱{it.subtotal}</span></div>) : <div className="text-zinc-400 text-xs">Loading items…</div>}
                    </div>
                    <div className="flex gap-2 mt-3">
                      {col.key==='CONFIRMED' && <button onClick={()=>advance(o,'PREPARING')} className="flex-1 bg-violet-600 text-white font-bold py-2.5 rounded-xl">Start Cooking</button>}
                      {col.key==='PREPARING' && <button onClick={()=>advance(o,'READY')} className="flex-1 bg-emerald-600 text-white font-bold py-2.5 rounded-xl">Mark Ready</button>}
                      {col.key==='READY' && <button onClick={()=>advance(o,'COMPLETED')} className="flex-1 bg-zinc-900 text-white font-bold py-2.5 rounded-xl">Complete</button>}
                    </div>
                  </div>
                );
              })}
              {grouped(col.key).length===0 && <div className="text-center text-sm text-zinc-400 py-10">No tickets</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
