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
      <div className="max-w-lg mx-auto bg-brand-100 rounded-2xl border border-brand-300/40 p-8 text-center shadow-sm">
        <Shield size={32} className="mx-auto text-brand-300" />
        <h2 className="font-bold text-lg mt-3 text-brand-700">POS — Staff only</h2>
        <p className="text-sm text-brand-700/60 mt-2">Kiosk is the only public page. POS cashier requires login. <br/>STALL_OWNER sees only own stall orders, ADMIN sees all.</p>
        <Link to="/login" className="inline-flex items-center gap-2 mt-4 bg-brand-600 hover:bg-brand-300 text-brand-100 px-6 py-3 rounded-xl font-semibold shadow-sm"><LogIn size={16}/> Login to POS</Link>
        <div className="mt-4 text-xs bg-brand-100/60 border border-brand-300/30 rounded-xl p-3 text-left text-brand-700">
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
    PENDING_PAYMENT:'bg-brand-100 text-brand-700 border-brand-300',
    CONFIRMED:'bg-brand-300/30 text-brand-700 border-brand-300',
    PREPARING:'bg-brand-300/30 text-brand-700 border-brand-300',
    READY:'bg-brand-300/30 text-brand-700 border-brand-300',
    COMPLETED:'bg-brand-600 text-brand-100 border-brand-600',
    CANCELLED:'bg-brand-100 text-brand-800 border-brand-300',
  };

  return (
    <div className="space-y-4">
      <div className="bg-brand-100 rounded-2xl border border-brand-300/40 p-3 flex items-center gap-3 text-sm shadow-sm">
        <div className="w-8 h-8 rounded-lg bg-brand-600 text-brand-100 flex items-center justify-center"><Banknote size={14}/></div>
        <div><div className="font-bold text-brand-700">POS — {user.role==='ADMIN' ? 'All stalls' : user.stall_name}</div><div className="text-xs text-brand-700/60">{user.display_name} • {user.role} {user.role==='STALL_OWNER' ? `• Filtered to ${user.stall_id}` : ''}</div></div>
        <div className="ml-auto text-xs bg-brand-100/60 border border-brand-300/40 px-3 py-1.5 rounded-lg hidden md:block text-brand-700">Staff only — Kiosk is the only public page</div>
      </div>
    <div className="grid lg:grid-cols-[420px_1fr] gap-6">
      <div className="space-y-4">
        <div className="bg-brand-100 rounded-2xl border border-brand-300/40 p-5 shadow-sm">
          <h2 className="font-bold flex items-center gap-2 text-brand-700"><Banknote size={18} /> POS — Cashier</h2>
          <p className="text-sm text-brand-700/60">Enter 4-char pickup code shown on student Kiosk.</p>
          <div className="flex gap-2 mt-4">
            <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&lookup()}
              placeholder="e.g. A3X9" maxLength={4}
              className="flex-1 tracking-[0.3em] font-mono text-xl font-black uppercase text-center border-2 border-brand-600 rounded-xl px-4 py-3 focus:outline-none focus:border-brand-600 text-brand-700 placeholder:text-brand-300" />
            <button onClick={lookup} className="bg-brand-600 hover:bg-brand-300 text-brand-100 rounded-xl px-5 flex items-center gap-2 shadow-sm"><Search size={18} /> Lookup</button>
          </div>
          {error && <div className="mt-3 text-sm text-brand-700 bg-brand-100 border border-brand-300 rounded-xl px-3 py-2">{error}</div>}
          {result && (
            <div className="mt-4 border-2 border-brand-600 rounded-2xl p-4 bg-brand-100/50">
              <div className="flex items-center justify-between">
                <span className="font-mono text-2xl font-black tracking-widest">{result.order.pickup_code}</span>
                <span className={`text-xs font-bold px-3 py-1.5 rounded-full border ${statusColor[result.order.status] || 'bg-brand-100 text-brand-700 border-brand-300'}`}>{result.order.status}</span>
              </div>
              <div className="text-sm mt-2 space-y-1">
                {result.items.map((it:any)=>(<div key={it.id} className="flex justify-between"><span>{it.menu_item_name} ×{it.quantity}</span><span>₱{it.subtotal}</span></div>))}
              </div>
              <div className="flex justify-between font-black text-lg border-t mt-3 pt-3"><span>Total</span><span>₱{result.order.total_amount}</span></div>

              <div className="grid grid-cols-2 gap-2 mt-4">
                {result.order.status==='PENDING_PAYMENT' && <button onClick={()=>updateStatus(result.order.id,'CONFIRMED')} className="col-span-2 bg-brand-600 hover:bg-brand-300 text-brand-100 font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm"><Banknote size={18}/> Confirm Cash Payment</button>}
                {result.order.status==='CONFIRMED' && <button onClick={()=>updateStatus(result.order.id,'PREPARING')} className="bg-brand-600 hover:bg-brand-300 text-brand-100 font-bold py-3 rounded-xl shadow-sm">Start Preparing</button>}
                {result.order.status==='PREPARING' && <button onClick={()=>updateStatus(result.order.id,'READY')} className="bg-brand-600 hover:bg-brand-300 text-brand-100 font-bold py-3 rounded-xl shadow-sm">Mark Ready</button>}
                {result.order.status==='READY' && <button onClick={()=>updateStatus(result.order.id,'COMPLETED')} className="bg-brand-600 hover:bg-brand-300 text-brand-100 font-bold py-3 rounded-xl flex items-center justify-center gap-2 shadow-sm"><CheckCircle size={16}/> Completed / Picked up</button>}
                {['PENDING_PAYMENT','CONFIRMED','PREPARING','READY'].includes(result.order.status) && <button onClick={()=>updateStatus(result.order.id,'CANCELLED')} className="border border-brand-300 text-brand-700 font-semibold py-3 rounded-xl hover:bg-brand-300">Cancel</button>}
                {result.order.status!=='PENDING_PAYMENT' && <button onClick={()=>window.print()} className="border border-brand-300/40 bg-brand-100 hover:bg-brand-300 py-3 rounded-xl flex items-center justify-center gap-2 text-brand-700"><Printer size={16}/> Print Receipt</button>}
              </div>
            </div>
          )}
        </div>

        {/* Receipt preview */}
        {result && (
          <div className="bg-brand-100 rounded-2xl border border-brand-300/40 p-5 font-mono text-sm shadow-sm">
            <div className="text-center font-black text-brand-700">CampusBITE Receipt</div>
            <div className="text-center text-xs text-brand-700/60">Order {result.order.pickup_code} • {new Date(result.order.created_at).toLocaleString()}</div>
            <hr className="my-3" />
            {result.items.map((it:any)=><div key={it.id} className="flex justify-between"><span>{it.menu_item_name} x{it.quantity}</span><span>₱{it.subtotal}</span></div>)}
            <hr className="my-3" />
            <div className="flex justify-between font-black"><span>TOTAL</span><span>₱{result.order.total_amount}</span></div>
            <div className="text-center text-xs mt-3 text-brand-700/60">Thank you! Show code at pickup.</div>
          </div>
        )}
      </div>

      <div className="bg-brand-100 rounded-2xl border border-brand-300/40 shadow-sm">
        <div className="p-4 border-b border-brand-300/30 flex items-center justify-between"><h3 className="font-bold text-brand-700">Recent Orders (Live via WebSocket)</h3><span className="text-xs bg-brand-300/30 text-brand-700 px-2 py-1 rounded-full">Live</span></div>
        <div className="divide-y divide-brand-300/20 max-h-[70vh] overflow-auto">
          {orders.map(o=>(
            <div key={o.id} className="p-4 flex items-center gap-4 hover:bg-brand-300/50 cursor-pointer" onClick={()=>{ setCode(o.pickup_code); api.get<any>(`/api/orders/by-code/${o.pickup_code}`).then(setResult).catch(()=>{}); }}>
              <div className="w-14 h-14 rounded-xl bg-brand-600 text-brand-100 flex items-center justify-center font-mono font-black tracking-widest shadow-sm">{o.pickup_code}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-sm">₱{o.total_amount} • {new Date(o.created_at).toLocaleTimeString()}</div>
                <div className="text-xs text-brand-700/60 truncate">{o.id.slice(0,8)}</div>
              </div>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${statusColor[o.status]}`}>{o.status}</span>
            </div>
          ))}
          {orders.length===0 && <div className="p-10 text-center text-brand-700/50 text-sm">No orders yet — place one from Kiosk</div>}
        </div>
      </div>
    </div>
    </div>
  );
}
