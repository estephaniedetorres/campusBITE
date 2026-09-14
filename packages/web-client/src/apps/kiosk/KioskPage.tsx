import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { ShoppingCart, Plus, Minus, Utensils, CheckCircle, Clock, QrCode, Image as ImageIcon } from 'lucide-react';

type MenuItem = { id: string; name: string; price: number; description: string; stall_id: string; category_id: string; image_url?: string | null; category_name?: string; };

const fallbackImages: Record<string, string> = {
  'item-burger-classic': 'https://images.unsplash.com/photo-1568909344668-6f14a07b56a0?w=400&auto=format&fit=crop&q=60',
  'item-burger-double': 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=400&auto=format&fit=crop&q=60',
  'item-rice-chicken': 'https://images.unsplash.com/photo-1604908177223-81e336fca6a2?w=400&auto=format&fit=crop&q=60',
  'item-coffee-latte': 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400&auto=format&fit=crop&q=60',
  'item-milk-tea': 'https://images.unsplash.com/photo-1571934811356-5cc061b6821f?w=400&auto=format&fit=crop&q=60',
  'item-croissant': 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&auto=format&fit=crop&q=60',
};
function getMenuImage(item: MenuItem): string {
  if (item.image_url) return item.image_url;
  if (fallbackImages[item.id]) return fallbackImages[item.id];
  const n = item.name.toLowerCase();
  if (n.includes('burger')) return fallbackImages['item-burger-classic'];
  if (n.includes('chicken') || n.includes('rice')) return fallbackImages['item-rice-chicken'];
  if (n.includes('latte') || n.includes('coffee')) return fallbackImages['item-coffee-latte'];
  if (n.includes('milk') || n.includes('tea') || n.includes('boba')) return fallbackImages['item-milk-tea'];
  if (n.includes('croissant') || n.includes('pastry') || n.includes('bread')) return fallbackImages['item-croissant'];
  return 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&auto=format&fit=crop&q=60';
}

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
        <div className={`rounded-2xl border-2 p-3 flex items-center gap-3 ${stalls.find(s=>s.id===qrStall) ? 'bg-brand-100 border-brand-300' : 'bg-brand-100 border-brand-300'}`}>
          <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${stalls.find(s=>s.id===qrStall) ? 'bg-brand-600 text-brand-100' : 'bg-brand-600 text-brand-100'}`}><QrCode size={18}/></div>
          <div className="flex-1">
            <div className="font-bold text-sm">{stalls.find(s=>s.id===qrStall) ? `QR → ${stalls.find(s=>s.id===qrStall)?.name}` : `Invalid QR stall "${qrStall}"`}</div>
            <div className="text-xs text-brand-700/70">{qrTable ? `Table ${qrTable} • ` : ''}{stalls.find(s=>s.id===qrStall) ? 'Menu filtered to this stall via QR scan' : 'Showing all stalls — ask staff for correct QR'}</div>
          </div>
          {qrTable && <div className="bg-brand-100 border px-3 py-1.5 rounded-xl text-xs font-bold">Table {qrTable}</div>}
        </div>
      )}
      {/* Stall selector — hidden if QR locks to single stall? Keep but dim others */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="flex gap-2">
          {stalls.map(s => (
            <button key={s.id} onClick={() => setStallId(s.id)}
              className={`px-4 py-2 rounded-full text-sm font-semibold border shadow-sm ${stallId===s.id ? 'bg-brand-600 text-brand-100 border-brand-600' : 'bg-brand-100 border-brand-300/40 text-brand-700 hover:bg-brand-300'} ${qrStall && s.id!==qrStall ? 'opacity-50' : ''}`}>
              <Utensils size={14} className="inline mr-1.5 -mt-0.5" />{s.name}
            </button>
          ))}
        </div>
        {lastOrder && (
          <div className="ml-auto bg-brand-100 border border-brand-300 rounded-xl px-4 py-2 text-sm flex items-center gap-2">
            <CheckCircle size={16} className="text-brand-500" />
            <span>Order <b>{lastOrder.order.pickup_code}</b> • {liveStatus || lastOrder.order.status}</span>
            <span className="hidden md:inline text-brand-700/60">Show this code at POS</span>
          </div>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-2 overflow-auto pb-1">
        <button onClick={()=>setActiveCat('all')} className={`px-4 py-2 rounded-full text-sm whitespace-nowrap border shadow-sm ${activeCat==='all'?'bg-brand-600 text-brand-100 border-brand-600':'bg-brand-100 border-brand-300/40 text-brand-700 hover:bg-brand-300'}`}>All</button>
        {categories.map(c => (
          <button key={c.id} onClick={()=>setActiveCat(c.id)} className={`px-4 py-2 rounded-full text-sm whitespace-nowrap border shadow-sm ${activeCat===c.id?'bg-brand-600 text-brand-100 border-brand-600':'bg-brand-100 border-brand-300/40 text-brand-700 hover:bg-brand-300'}`}>{c.name}</button>
        ))}
      </div>

      {/* Menu grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {filtered.map(item => {
          const qty = cart.get(item.id) || 0;
          return (
            <div key={item.id} className="bg-brand-100 rounded-2xl border border-brand-300/40 p-4 flex flex-col shadow-sm hover:shadow-md transition">
              <div className="w-full h-32 rounded-xl overflow-hidden bg-brand-100 border border-brand-300/20 relative">
                <img
                  src={getMenuImage(item)}
                  alt={item.name}
                  loading="lazy"
                  className="w-full h-full object-cover"
                  onError={(e)=>{ (e.currentTarget as HTMLImageElement).style.display='none'; (e.currentTarget.nextElementSibling as HTMLElement)?.classList.remove('hidden'); }}
                />
                <div className="hidden absolute inset-0 bg-gradient-to-br from-brand-100 to-brand-300/30 flex items-center justify-center text-brand-300">
                  <ImageIcon size={32} />
                </div>
                {!item.image_url && !fallbackImages[item.id] ? null : null}
              </div>
              <div className="font-semibold mt-3 leading-tight text-brand-700 line-clamp-1">{item.name}</div>
              <div className="text-xs text-brand-700/60 line-clamp-2">{item.description}</div>
              <div className="flex items-center justify-between mt-3">
                <span className="font-bold text-brand-500">₱{item.price}</span>
                {qty === 0 ? (
                  <button onClick={()=>add(item.id)} className="bg-brand-600 hover:bg-brand-300 text-brand-100 rounded-full p-2 shadow-sm"><Plus size={16} /></button>
                ) : (
                  <div className="flex items-center gap-2 bg-brand-600 text-brand-100 rounded-full px-1 py-1 shadow-sm">
                    <button onClick={()=>sub(item.id)} className="w-7 h-7 rounded-full bg-brand-100/20 flex items-center justify-center"><Minus size={14} /></button>
                    <span className="w-6 text-center text-sm font-bold">{qty}</span>
                    <button onClick={()=>add(item.id)} className="w-7 h-7 rounded-full bg-brand-100/20 flex items-center justify-center"><Plus size={14} /></button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Cart drawer */}
      <div className="fixed bottom-0 left-0 right-0 bg-brand-100 border-t border-brand-300/40 shadow-2xl">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex-1">
            <div className="text-sm font-semibold flex items-center gap-2 text-brand-700"><ShoppingCart size={16} /> {cartItems.length} items • ₱{total.toFixed(2)}</div>
            <div className="text-xs text-brand-700/60 truncate">{cartItems.map(i=>`${i.name} ×${i.qty}`).join(', ') || 'Cart empty - add items'}</div>
          </div>
          <button disabled={cartItems.length===0 || loading} onClick={checkout}
            className="bg-brand-600 hover:bg-brand-300 disabled:bg-brand-300/40 text-brand-100 font-bold px-6 py-3 rounded-xl shadow-sm transition">
            {loading ? 'Placing...' : `Checkout • ₱${total.toFixed(2)}`}
          </button>
        </div>
      </div>

      {/* Live tracker */}
      {lastOrder && (
        <div className="bg-brand-100 rounded-2xl border border-brand-300/40 p-5 pb-24 shadow-sm">
          <h3 className="font-bold flex items-center gap-2 text-brand-700"><Clock size={16} /> Live Order Tracker — {lastOrder.order.pickup_code}</h3>
          <div className="flex gap-2 mt-3">
            {['PENDING_PAYMENT','CONFIRMED','PREPARING','READY','COMPLETED'].map(step => {
              const idx = ['PENDING_PAYMENT','CONFIRMED','PREPARING','READY','COMPLETED'].indexOf(liveStatus || lastOrder.order.status);
              const sIdx = ['PENDING_PAYMENT','CONFIRMED','PREPARING','READY','COMPLETED'].indexOf(step);
              const done = sIdx <= idx;
              return <div key={step} className={`flex-1 rounded-xl px-2 py-3 text-center text-xs font-semibold border ${done?'bg-brand-600 text-brand-100 border-brand-600':'bg-brand-100 text-brand-700/60 border-brand-300/30'}`}>{step.replace('_',' ')}</div>;
            })}
          </div>
          <div className="text-xs text-brand-700/60 mt-2">Tip: Walk to POS counter and show code <b className="text-brand-700">{lastOrder.order.pickup_code}</b> to pay by cash.</div>
        </div>
      )}
    </div>
  );
}
