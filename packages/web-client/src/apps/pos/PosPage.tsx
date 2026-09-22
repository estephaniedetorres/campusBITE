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
      <div className="max-w-lg mx-auto fork-card rounded-[24px] p-8 text-center">
        <Shield size={28} className="mx-auto text-stone-300" />
        <h2 className="font-serif font-bold text-lg mt-3 text-stone-900">POS — Staff only</h2>
        <p className="text-sm text-stone-500 mt-2">Kiosk is the only public page. POS requires login.<br/>Stall owners see own stall, ADMIN sees all.</p>
        <Link to="/login" className="inline-flex items-center justify-center gap-2 mt-5 bg-stone-900 text-white px-6 py-3 rounded-full font-semibold"><LogIn size={16}/> Log in to POS</Link>
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

  const statusStyle: Record<string,string> = {
    PENDING_PAYMENT:'bg-amber-50 text-amber-700 border-amber-200',
    CONFIRMED:'bg-sky-50 text-sky-700 border-sky-200',
    PREPARING:'bg-violet-50 text-violet-700 border-violet-200',
    READY:'bg-emerald-50 text-emerald-700 border-emerald-200',
    COMPLETED:'bg-stone-900 text-white border-stone-900',
    CANCELLED:'bg-red-50 text-red-700 border-red-200',
  };

  return (
    <div className="space-y-4">
      <div className="fork-card rounded-2xl p-3.5 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-stone-900 text-white flex items-center justify-center"><Banknote size={16}/></div>
        <div>
          <div className="font-semibold text-sm text-stone-900">POS — {user.role==='ADMIN' ? 'All stalls' : user.stall_name}</div>
          <div className="text-xs text-stone-500">{user.display_name} · {user.role}</div>
        </div>
        <span className="ml-auto hidden sm:inline text-xs px-3 py-1.5 rounded-full bg-stone-50 border border-stone-200 text-stone-600">Staff only</span>
      </div>

      <div className="grid lg:grid-cols-[400px_1fr] gap-6">
        <div className="space-y-4">
          <div className="fork-card rounded-[20px] p-5">
            <h2 className="font-serif font-bold text-stone-900">Cashier</h2>
            <p className="text-sm text-stone-500">Enter 4-char code from Kiosk.</p>
            <div className="flex gap-2 mt-4">
              <input value={code} onChange={e=>setCode(e.target.value.toUpperCase())} onKeyDown={e=>e.key==='Enter'&&lookup()}
                placeholder="A3X9" maxLength={4}
                className="flex-1 tracking-[0.3em] font-mono text-xl font-bold uppercase text-center border border-stone-300 rounded-full px-4 py-3 focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10" />
              <button onClick={lookup} className="bg-stone-900 text-white rounded-full px-6 flex items-center gap-2 font-semibold hover:bg-stone-800"><Search size={16}/> Lookup</button>
            </div>
            {error && <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}
            {result && (
              <div className="mt-5 fork-card rounded-2xl p-4 bg-stone-50/50">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-2xl font-bold tracking-widest text-stone-900">{result.order.pickup_code}</span>
                  <span className={`text-xs font-semibold px-3 py-1.5 rounded-full border ${statusStyle[result.order.status]}`}>{result.order.status}</span>
                </div>
                <div className="text-sm mt-3 space-y-1.5">
                  {result.items.map((it:any)=>(<div key={it.id} className="flex justify-between text-stone-700"><span>{it.menu_item_name} <span className="text-stone-500">×{it.quantity}</span></span><span className="font-medium">₱{it.subtotal}</span></div>))}
                </div>
                <div className="flex justify-between font-bold text-stone-900 border-t border-stone-200 mt-3 pt-3"><span>Total</span><span>₱{result.order.total_amount}</span></div>
                <div className="grid grid-cols-2 gap-2 mt-4">
                  {result.order.status==='PENDING_PAYMENT' && <button onClick={()=>updateStatus(result.order.id,'CONFIRMED')} className="col-span-2 bg-emerald-600 text-white font-semibold py-3 rounded-full hover:bg-emerald-700"><Banknote size={16} className="inline mr-2"/>Confirm Cash</button>}
                  {result.order.status==='CONFIRMED' && <button onClick={()=>updateStatus(result.order.id,'PREPARING')} className="bg-violet-600 text-white font-semibold py-3 rounded-full">Preparing</button>}
                  {result.order.status==='PREPARING' && <button onClick={()=>updateStatus(result.order.id,'READY')} className="bg-sky-600 text-white font-semibold py-3 rounded-full">Ready</button>}
                  {result.order.status==='READY' && <button onClick={()=>updateStatus(result.order.id,'COMPLETED')} className="bg-stone-900 text-white font-semibold py-3 rounded-full"><CheckCircle size={16} className="inline mr-2"/>Completed</button>}
                  {['PENDING_PAYMENT','CONFIRMED','PREPARING','READY'].includes(result.order.status) && <button onClick={()=>updateStatus(result.order.id,'CANCELLED')} className="border border-stone-200 text-stone-600 font-medium py-3 rounded-full hover:bg-stone-50">Cancel</button>}
                  {result.order.status!=='PENDING_PAYMENT' && <button onClick={()=>window.print()} className="border border-stone-200 bg-white py-3 rounded-full flex items-center justify-center gap-2 font-medium"><Printer size={16}/> Print</button>}
                </div>
              </div>
            )}
          </div>

          {result && (
            <div className="fork-card rounded-2xl p-5 font-mono text-sm">
              <div className="text-center font-bold text-stone-900">CampusBITE Receipt</div>
              <div className="text-center text-xs text-stone-500">Order {result.order.pickup_code} · {new Date(result.order.created_at).toLocaleString()}</div>
              <div className="border-t border-dashed border-stone-200 my-3"/>
              {result.items.map((it:any)=><div key={it.id} className="flex justify-between"><span>{it.menu_item_name} x{it.quantity}</span><span>₱{it.subtotal}</span></div>)}
              <div className="border-t border-stone-900 my-3"/>
              <div className="flex justify-between font-bold text-stone-900"><span>TOTAL</span><span>₱{result.order.total_amount}</span></div>
              <div className="text-center text-xs text-stone-500 mt-3">Thank you!</div>
            </div>
          )}
        </div>

        <div className="fork-card overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center justify-between">
            <h3 className="font-serif font-bold text-stone-900">Recent Orders</h3>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"/> Live</span>
          </div>
          <div className="divide-y divide-stone-100 max-h-[70vh] overflow-auto">
            {orders.map(o=>(
              <div key={o.id} className="p-4 flex items-center gap-4 hover:bg-stone-50 cursor-pointer transition" onClick={()=>{ setCode(o.pickup_code); api.get<any>(`/api/orders/by-code/${o.pickup_code}`).then(setResult).catch(()=>{}); }}>
                <div className="w-12 h-12 rounded-xl bg-stone-900 text-white flex items-center justify-center font-mono font-bold tracking-widest text-sm">{o.pickup_code}</div>
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm text-stone-900">₱{o.total_amount} · {new Date(o.created_at).toLocaleTimeString()}</div>
                  <div className="text-xs text-stone-500 truncate">{o.stall_id} · {o.id.slice(0,8)}</div>
                </div>
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${statusStyle[o.status]}`}>{o.status}</span>
              </div>
            ))}
            {orders.length===0 && <div className="p-10 text-center text-stone-400 text-sm">No orders yet — place one from Kiosk</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
