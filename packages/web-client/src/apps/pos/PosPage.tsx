import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { useWebSocket } from '../../hooks/useWebSocket';
import { Search, Banknote, Printer, CheckCircle, Shield, LogIn } from 'lucide-react';

export default function PosPage() {
  const { user } = useAuth();
  const [code, setCode] = useState('');
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState('');
  const [orders, setOrders] = useState<any[]>([]);

  if (!user) {
    return (
      <div className="max-w-lg mx-auto bg-white rounded-2xl border p-8 text-center">
        <Shield size={32} className="mx-auto text-zinc-400" />
        <h2 className="font-bold text-lg mt-3">POS — Staff only</h2>
        <p className="text-sm text-zinc-500 mt-2">Kiosk is the only public page. POS cashier requires login. <br/>STALL_OWNER sees only own stall orders, ADMIN sees all.</p>
        <Link to="/login" className="inline-flex items-center gap-2 mt-4 bg-zinc-900 text-white px-6 py-3 rounded-xl font-semibold"><LogIn size={16}/> Login to POS</Link>
        <div className="mt-4 text-xs bg-zinc-50 rounded-xl p-3 text-left">
          <div>grill / grill123 → Campus Grill POS</div>
          <div>brew / brew123 → Brew & Bites POS</div>
          <div>admin / admin123 → All stalls</div>
        </div>
      </div>
    );
  }

  async function refresh() {
    try {
      const o = await api.get<any[]>('/api/orders?limit=30');
      setOrders(o);
    } catch (e:any){ setError(e.message); }
  }
  useEffect(() => { refresh(); }, []);
  useWebSocket({ room: 'pos', onMessage: (m) => { if (m.type==='ORDER_CREATED' || m.type==='ORDER_STATUS_UPDATED') refresh(); } });

  async function lookup() {
    setError(''); setResult(null);
    if (!code.trim()) return;
    try {
      const res = await api.get<any>(`/api/orders/by-code/${code.trim().toUpperCase()}`);
      setResult(res);
    } catch (e: any) { setError(e.message); }
  }

  async function updateStatus(orderId: string, status: string) {
    try {
      await api.patch(`/api/orders/${orderId}/status`, { status });
      setResult(null); setCode(''); refresh();
      if (result?.order?.id === orderId) {
        const r = await api.get<any>(`/api/orders/${orderId}`);
        setResult(r);
      }
    } catch (e: any) { alert(e.message); }
  }

  const statusColor: Record<string,string> = {
    PENDING_PAYMENT:'bg-amber-100 text-amber-700 border-amber-200',
    CONFIRMED:'bg-sky-100 text-sky-700 border-sky-200',
    PREPARING:'bg-violet-100 text-violet-700 border-violet-200',
    READY:'bg-emerald-100 text-emerald-700 border-emerald-200',
    COMPLETED:'bg-zinc-900 text-white',
    CANCELLED:'bg-red-100 text-red-700 border-red-200',
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border p-3 flex items-center gap-3 text-sm">
        <div className="w-8 h-8 rounded-lg bg-zinc-900 text-white flex items-center justify-center"><Banknote size={14}/></div>
        <div><div className="font-bold">POS — {user.role==='ADMIN' ? 'All stalls' : user.stall_name}</div><div className="text-xs text-zinc-500">{user.display_name} • {user.role} {user.role==='STALL_OWNER' ? `• Filtered to ${user.stall_id}` : ''}</div></div>
        <div className="ml-auto text-xs bg-zinc-50 border px-3 py-1.5 rounded-lg hidden md:block">Staff only — Kiosk is the only public page</div>
      </div>
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <div className="space-y-4">
        <div className="bg-white rounded-2xl border p-5">
          <h2 className="font-bold flex items-center gap-2"><Banknote size={18} /> POS — Cashier</h2>
          <p className="text-sm text-zinc-500">Enter 4-char pickup code shown on student Kiosk.</p>
          <div className="flex gap-2 mt-4">
            <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&lookup()}
              placeholder="e.g. A3X9" maxLength={4}
              className="flex-1 tracking-[0.3em] font-mono text-xl font-black uppercase text-center border-2 border-zinc-900 rounded-xl px-4 py-3" />
            <button onClick={lookup} className="bg-zinc-900 text-white rounded-xl px-5 flex items-center gap-2"><Search size={18} /> Lookup</button>
          </div>
          {error && <div className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}
          {result && (
            <div className="mt-4 border-2 border-zinc-900 rounded-2xl p-4 bg-zinc-50">
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xl font-black tracking-widest">{result.order.pickup_code}</span>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${statusColor[result.order.status] || 'bg-zinc-100'}`}>{result.order.status}</span>
              </div>
              <div className="text-sm mt-2 space-y-1">
                {result.items.map((it:any)=>(<div key={it.id} className="flex justify-between"><span>{it.menu_item_name} ×{it.quantity}</span><span>₱{it.subtotal}</span></div>))}
              </div>
              <div className="flex justify-between font-black text-lg border-t mt-3 pt-3"><span>Total</span><span>₱{result.order.total_amount}</span></div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                {result.order.status==='PENDING_PAYMENT' && <button onClick={()=>updateStatus(result.order.id,'CONFIRMED')} className="col-span-2 bg-emerald-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"><Banknote size={18}/> Confirm Cash Payment</button>}
                {result.order.status==='CONFIRMED' && <button onClick={()=>updateStatus(result.order.id,'PREPARING')} className="bg-violet-600 text-white font-bold py-3 rounded-xl">Start Preparing</button>}
                {result.order.status==='PREPARING' && <button onClick={()=>updateStatus(result.order.id,'READY')} className="bg-sky-600 text-white font-bold py-3 rounded-xl">Mark Ready</button>}
                {result.order.status==='READY' && <button onClick={()=>updateStatus(result.order.id,'COMPLETED')} className="bg-zinc-900 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2"><CheckCircle size={16}/> Completed / Picked up</button>}
                {['PENDING_PAYMENT','CONFIRMED','PREPARING','READY'].includes(result.order.status) && <button onClick={()=>updateStatus(result.order.id,'CANCELLED')} className="border border-red-300 text-red-600 font-semibold py-3 rounded-xl">Cancel</button>}
                {result.order.status!=='PENDING_PAYMENT' && <button onClick={()=>window.print()} className="border bg-white py-3 rounded-xl flex items-center justify-center gap-2"><Printer size={16}/> Print Receipt</button>}
              </div>
            </div>
          )}
        </div>

        {/* Receipt preview */}
        {result && (
          <div className="bg-white rounded-2xl border p-5 font-mono text-sm">
            <div className="text-center font-black">CampusBITE Receipt</div>
            <div className="text-center text-xs text-zinc-500">Order {result.order.pickup_code} • {new Date(result.order.created_at).toLocaleString()}</div>
            <hr className="my-3" />
            {result.items.map((it:any)=><div key={it.id} className="flex justify-between"><span>{it.menu_item_name} x{it.quantity}</span><span>₱{it.subtotal}</span></div>)}
            <hr className="my-3" />
            <div className="flex justify-between font-black"><span>TOTAL</span><span>₱{result.order.total_amount}</span></div>
            <div className="text-center text-xs mt-3 text-zinc-500">Thank you! Show code at pickup.</div>
          </div>
        )}
      </div>

      <div className="bg-white rounded-2xl border">
        <div className="p-4 border-b flex items-center justify-between"><h3 className="font-bold">Recent Orders (Live via WebSocket)</h3><span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">Live</span></div>
        <div className="divide-y max-h-[70vh] overflow-auto">
          {orders.map(o=>(
            <div key={o.id} className="p-4 flex items-center gap-4 hover:bg-zinc-50 cursor-pointer" onClick={()=>{ setCode(o.pickup_code); api.get<any>(`/api/orders/by-code/${o.pickup_code}`).then(setResult).catch(()=>{}); }}>
              <div className="w-14 h-14 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-mono font-black tracking-widest">{o.pickup_code}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">₱{o.total_amount} • {new Date(o.created_at).toLocaleTimeString()}</div>
                <div className="text-xs text-zinc-500 truncate">{o.id.slice(0,8)}</div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusColor[o.status]}`}>{o.status}</span>
            </div>
          ))}
          {orders.length===0 && <div className="p-10 text-center text-zinc-400 text-sm">No orders yet — place one from Kiosk</div>}
        </div>
      </div>
    </div>
    </div>
  );
}
