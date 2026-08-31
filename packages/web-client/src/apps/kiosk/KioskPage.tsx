import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { ShoppingCart, Plus, Minus, Utensils, CheckCircle, Clock, QrCode } from 'lucide-react';

type MenuItem = { id: string; name: string; price: number; description: string; stall_id: string; category_id: string };

export default function KioskPage() {
  const [searchParams] = useSearchParams();
  const qrStall = searchParams.get('stall') || searchParams.get('stallId') || searchParams.get('stall_id');
  const qrTable = searchParams.get('table');
  const [stalls, setStalls] = useState<any[]>([]);
  const [stallId, setStallId] = useState<string>('');
  const [categories, setCategories] = useState<any[]>([]);
  const [activeCat, setActiveCat] = useState<string>('all');
  const [menu, setMenu] = useState<MenuItem[]>([]);
  const [cart, setCart] = useState<Map<string, number>>(new Map());
  const [lastOrder, setLastOrder] = useState<any>(null);
  const [liveStatus, setLiveStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // Fetch stalls — QR parsing: if ?stall= exists, auto-select that stall
  useEffect(() => {
    api.get<any[]>('/api/stalls').then(s => {
      setStalls(s);
      if (qrStall && s.find(x=>x.id===qrStall)) {
        setStallId(qrStall);
      } else if (qrStall && !s.find(x=>x.id===qrStall)) {
        // invalid QR stall, fallback to first but show error
        if (s[0]) setStallId(s[0].id);
      } else if (s[0]) setStallId(s[0].id);
    });
  }, [qrStall]);
  useEffect(() => {
    if (!stallId) return;
    api.get<any[]>(`/api/categories?stallId=${stallId}`).then(setCategories);
    api.get<any[]>(`/api/menu?stallId=${stallId}`).then(setMenu);
  }, [stallId]);

  // WS for order tracking
  useWebSocket({
    orderId: lastOrder?.order?.id,
    onMessage: (msg) => {
      if (msg.type === 'ORDER_STATUS_UPDATED' && msg.payload.id === lastOrder?.order?.id) {
        setLiveStatus(msg.payload.status);
        setLastOrder((prev: any) => prev ? { ...prev, order: msg.payload } : prev);
      }
    }
  });

  const add = (id: string) => setCart(m => new Map(m).set(id, (m.get(id) || 0) + 1));
  const sub = (id: string) => setCart(m => {
    const n = new Map(m); const v = (n.get(id) || 0) - 1; if (v <= 0) n.delete(id); else n.set(id, v); return n;
  });

  const cartItems = [...cart.entries()].map(([id, qty]) => {
    const item = menu.find(i => i.id === id)!;
    return { ...item, qty, subtotal: item.price * qty };
  });
  const total = cartItems.reduce((s, i) => s + i.subtotal, 0);
  const filtered = activeCat === 'all' ? menu : menu.filter(m => m.category_id === activeCat);

  async function checkout() {
    if (cartItems.length === 0) return;
    setLoading(true);
    try {
      const res: any = await api.post('/api/orders', {
        stallId,
        items: cartItems.map(i => ({ menuItemId: i.id, quantity: i.qty })),
      });
      setLastOrder(res);
      setLiveStatus(res.order.status);
      setCart(new Map());
    } catch (e: any) { alert('Checkout failed: ' + e.message); }
    finally { setLoading(false); }
  }

  return (
    <div className="space-y-6">
      {/* QR banner */}
      {qrStall && (
        <div className={`rounded-2xl border-2 p-3 flex items-center gap-3 ${stalls.find(s=>s.id===qrStall) ? 'bg-emerald-50 border-emerald-200' : 'bg-red-50 border-red-200'}`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stalls.find(s=>s.id===qrStall) ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}><QrCode size={18}/></div>
          <div className="flex-1">
            <div className="font-bold text-sm">{stalls.find(s=>s.id===qrStall) ? `QR → ${stalls.find(s=>s.id===qrStall)?.name}` : `Invalid QR stall "${qrStall}"`}</div>
            <div className="text-xs text-zinc-600">{qrTable ? `Table ${qrTable} • ` : ''}{stalls.find(s=>s.id===qrStall) ? 'Menu filtered to this stall via QR scan' : 'Showing all stalls — ask staff for correct QR'}</div>
          </div>
          {qrTable && <div className="bg-white border px-3 py-1.5 rounded-xl text-xs font-bold">Table {qrTable}</div>}
        </div>
      )}
      {/* Stall selector — hidden if QR locks to single stall? Keep but dim others */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-2">
          {stalls.map(s => (
            <button key={s.id} onClick={() => setStallId(s.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border ${stallId===s.id ? 'bg-orange-500 text-white border-orange-500' : 'bg-white border-zinc-200'} ${qrStall && s.id!==qrStall ? 'opacity-50' : ''}`}>
              <Utensils size={14} className="inline mr-1.5 -mt-0.5" />{s.name}
            </button>
          ))}
        </div>
        {lastOrder && (
          <div className="ml-auto bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-2 text-sm flex items-center gap-2">
            <CheckCircle size={16} className="text-emerald-600" />
            <span>Order <b>{lastOrder.order.pickup_code}</b> • {liveStatus || lastOrder.order.status}</span>
            <span className="hidden md:inline text-zinc-500">Show this code at POS</span>
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-auto pb-1">
        <button onClick={()=>setActiveCat('all')} className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${activeCat==='all'?'bg-zinc-900 text-white':'bg-white border'}`}>All</button>
        {categories.map(c => (
          <button key={c.id} onClick={()=>setActiveCat(c.id)} className={`px-4 py-2 rounded-full text-sm whitespace-nowrap ${activeCat===c.id?'bg-zinc-900 text-white':'bg-white border'}`}>{c.name}</button>
        ))}
      </div>

      {/* Menu grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(item => {
          const qty = cart.get(item.id) || 0;
          return (
            <div key={item.id} className="bg-white rounded-2xl border border-zinc-200 p-4 flex flex-col">
              <div className="w-full h-28 bg-gradient-to-br from-orange-100 to-amber-50 rounded-xl flex items-center justify-center text-3xl">🍔</div>
              <div className="font-semibold mt-3 leading-tight">{item.name}</div>
              <div className="text-xs text-zinc-500 line-clamp-2">{item.description}</div>
              <div className="flex items-center justify-between mt-3">
                <span className="font-bold text-orange-600">₱{item.price}</span>
                {qty === 0 ? (
                  <button onClick={()=>add(item.id)} className="bg-zinc-900 text-white rounded-full p-2"><Plus size={16} /></button>
                ) : (
                  <div className="flex items-center gap-2 bg-zinc-900 text-white rounded-full px-1 py-1">
                    <button onClick={()=>sub(item.id)} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center"><Minus size={14} /></button>
                    <span className="w-6 text-center text-sm font-bold">{qty}</span>
                    <button onClick={()=>add(item.id)} className="w-7 h-7 rounded-full bg-white/20 flex items-center justify-center"><Plus size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart drawer */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex-1">
            <div className="text-sm font-semibold flex items-center gap-2"><ShoppingCart size={16} /> {cartItems.length} items • ₱{total.toFixed(2)}</div>
            <div className="text-xs text-zinc-500 truncate">{cartItems.map(i=>`${i.name} ×${i.qty}`).join(', ') || 'Cart empty - add items'}</div>
          </div>
          <button disabled={cartItems.length===0 || loading} onClick={checkout}
            className="bg-orange-500 disabled:bg-zinc-300 text-white font-bold px-6 py-3 rounded-xl">
            {loading ? 'Placing...' : `Checkout • ₱${total.toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* Live tracker */}
      {lastOrder && (
        <div className="bg-white rounded-2xl border p-5 pb-24">
          <h3 className="font-bold flex items-center gap-2"><Clock size={16} /> Live Order Tracker — {lastOrder.order.pickup_code}</h3>
          <div className="flex gap-2 mt-3">
            {['PENDING_PAYMENT','CONFIRMED','PREPARING','READY','COMPLETED'].map(step => {
              const idx = ['PENDING_PAYMENT','CONFIRMED','PREPARING','READY','COMPLETED'].indexOf(liveStatus || lastOrder.order.status);
              const sIdx = ['PENDING_PAYMENT','CONFIRMED','PREPARING','READY','COMPLETED'].indexOf(step);
              const done = sIdx <= idx;
              return <div key={step} className={`flex-1 rounded-xl px-2 py-3 text-center text-xs font-semibold ${done?'bg-emerald-500 text-white':'bg-zinc-100 text-zinc-400'}`}>{step.replace('_',' ')}</div>;
            })}
          </div>
          <div className="text-xs text-zinc-500 mt-2">Tip: Walk to POS counter and show code <b>{lastOrder.order.pickup_code}</b> to pay by cash.</div>
        </div>
      )}
    </div>
  );
}
