import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../lib/api';
import { useWebSocket } from '../../hooks/useWebSocket';
import { ShoppingCart, Plus, Minus, Star, Clock, QrCode, Heart, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

type MenuItem = { id: string; name: string; price: number; description: string; stall_id: string; category_id: string; image_url?: string | null; category_name?: string; rating?: number; rating_count?: number; };

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
  if (n.includes('milk') || n.includes('tea')) return fallbackImages['item-milk-tea'];
  if (n.includes('croissant')) return fallbackImages['item-croissant'];
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
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    api.get<any[]>('/api/stalls').then(s => {
      setStalls(s);
      if (qrStall && s.find(x=>x.id===qrStall)) setStallId(qrStall);
      else if (s[0]) setStallId(s[0].id);
    });
  }, [qrStall]);
  useEffect(() => {
    if (!stallId) return;
    api.get<any[]>(`/api/categories?stallId=${stallId}`).then(setCategories);
    api.get<any[]>(`/api/menu?stallId=${stallId}`).then(setMenu);
  }, [stallId]);

  useWebSocket({
    orderId: lastOrder?.order?.id,
    onMessage: (msg) => {
      if (msg.type === 'ORDER_STATUS_UPDATED' && msg.payload.id === lastOrder?.order?.id) {
        setLiveStatus(msg.payload.status);
        setLastOrder((prev: any) => prev ? { ...prev, order: msg.payload } : prev);
      }
    }
  });

  const currentStall = stalls.find(s => s.id === stallId);
  const handleStallChange = (newStallId: string) => {
    if (newStallId === stallId) return;
    if (cart.size > 0) {
      alert(`Checkout cart from "${currentStall?.name}" before switching.`);
      return;
    }
    setStallId(newStallId);
    setActiveCat('all');
  };

  const add = (id: string) => setCart(m => new Map(m).set(id, (m.get(id) || 0) + 1));
  const sub = (id: string) => setCart(m => {
    const n = new Map(m); const v = (n.get(id) || 0) - 1; if (v <= 0) n.delete(id); else n.set(id, v); return n;
  });

  const cartItems = [...cart.entries()].map(([id, qty]) => {
    const item = menu.find(i => i.id === id);
    if (!item) return null as any;
    return { ...item, qty, subtotal: item.price * qty };
  }).filter(Boolean) as (MenuItem & { qty: number; subtotal: number })[];
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
    <div className="space-y-5 pb-24">
      {qrStall && (
        <>
          <button onClick={()=>setShowQr(true)} className="w-full fork-card rounded-2xl p-3.5 flex items-center gap-3 hover:shadow-forkHover transition text-left">
            <div className="w-10 h-10 rounded-xl bg-fork-green text-white flex items-center justify-center shrink-0"><QrCode size={18}/></div>
            <div className="flex-1 min-w-0">
              <div className="font-serif font-bold text-sm text-stone-900">{stalls.find(s=>s.id===qrStall)?.name || qrStall} {qrTable && `· Table ${qrTable}`}</div>
              <div className="text-xs text-stone-500">Tap to show QR</div>
            </div>
          </button>
          {showQr && (
            <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={()=>setShowQr(false)}>
              <div className="bg-white rounded-[24px] p-6 w-full max-w-sm text-center" onClick={e=>e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-serif font-bold text-stone-900">{stalls.find(s=>s.id===qrStall)?.name || qrStall} QR</h3>
                  <button onClick={()=>setShowQr(false)} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center"><X size={16}/></button>
                </div>
                <div className="bg-white p-4 rounded-2xl border border-stone-200 inline-block">
                  <QRCodeSVG value={`${window.location.origin}/kiosk?stall=${qrStall}${qrTable ? `&table=${qrTable}` : ''}`} size={180} />
                </div>
                <div className="mt-4 text-xs font-mono bg-stone-50 border border-stone-200 rounded-xl px-3 py-2 break-all">{`${window.location.origin}/kiosk?stall=${qrStall}${qrTable ? `&table=${qrTable}` : ''}`}</div>
                <div className="text-xs text-stone-500 mt-2">Scan to open this stall on another device</div>
              </div>
            </div>
          )}
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        {stalls.map(s => {
          const active = s.id === stallId;
          const locked = cart.size>0 && !active;
          return (
            <button key={s.id} onClick={() => handleStallChange(s.id)} disabled={locked}
              title={s.name}
              className={`px-3 py-2 rounded-full text-sm font-medium border transition flex items-center gap-2 ${active ? 'bg-stone-900 text-white border-stone-900' : locked ? 'bg-stone-50 text-stone-400 border-stone-200 cursor-not-allowed' : 'bg-white border-stone-200 text-stone-700 hover:bg-stone-50'}`}>
              {s.logo_url ? <img src={s.logo_url} alt={s.name} className="w-5 h-5 rounded-full object-cover" /> : null}
              {s.name}
            </button>
          );
        })}
        {lastOrder && (
          <div className="ml-auto hidden sm:flex items-center gap-2 text-xs font-medium px-3 py-2 rounded-full bg-white border border-stone-200">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/> Order <b>{lastOrder.order.pickup_code}</b> · {liveStatus || lastOrder.order.status}
          </div>
        )}
      </div>

      {currentStall && (
        <div className="fork-card rounded-[24px] overflow-hidden">
          <div className="h-28 sm:h-36 bg-gradient-to-br from-stone-900 to-stone-700 relative">
            {currentStall.logo_url && <img src={currentStall.logo_url} alt={currentStall.name} className="absolute inset-0 w-full h-full object-cover opacity-30" />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"/>
            <div className="absolute bottom-4 left-5 right-5 flex items-end justify-between">
              <div className="flex items-center gap-3">
                {currentStall.logo_url && <img src={currentStall.logo_url} alt={currentStall.name} className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl object-cover border-2 border-white/20 bg-white" />}
              <div>
                <h2 className="font-serif text-xl sm:text-2xl font-bold text-white tracking-tight">{currentStall.name}</h2>
                <div className="flex items-center gap-2 mt-1 text-xs text-white/80">
                  <span className="inline-flex items-center gap-1 bg-white text-stone-900 px-2 py-1 rounded-full font-semibold"><Star size={12} fill="currentColor"/> {currentStall.rating != null ? Number(currentStall.rating).toFixed(1) : '—'}</span>
                  <span>· {currentStall.description || 'Canteen favourite'}</span>
                  <span className="hidden sm:inline">· {currentStall.rating_count ?? 0} ratings</span>
                </div>
              </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 bg-white/15 backdrop-blur text-white px-3 py-1.5 rounded-full text-xs font-medium border border-white/20"><Clock size={12}/> 10-15 min</span>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
        <button onClick={()=>setActiveCat('all')} className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border ${activeCat==='all'?'bg-stone-900 text-white border-stone-900':'bg-white border-stone-200 text-stone-600'}`}>All</button>
        {categories.map(c => (
          <button key={c.id} onClick={()=>setActiveCat(c.id)} className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium border ${activeCat===c.id?'bg-stone-900 text-white border-stone-900':'bg-white border-stone-200 text-stone-600'}`}>{c.name}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map(item => {
          const qty = cart.get(item.id) || 0;
          return (
            <div key={item.id} className="fork-card rounded-[20px] overflow-hidden group hover:shadow-forkHover transition">
              <div className="relative h-44 overflow-hidden bg-stone-100">
                <img src={getMenuImage(item)} alt={item.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition duration-500" />
                <button className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white/90 backdrop-blur flex items-center justify-center text-stone-400 hover:text-red-500 border border-stone-200"><Heart size={14}/></button>
                <span className="absolute bottom-3 left-3 bg-stone-900 text-white text-xs font-semibold px-2.5 py-1 rounded-full">₱{item.price}</span>
              </div>
              <div className="p-4">
                <div className="font-serif font-bold text-stone-900 leading-tight line-clamp-1">{item.name}</div>
                <div className="text-xs text-stone-500 line-clamp-2 mt-1 min-h-[32px]">{item.description}</div>
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs text-stone-500 flex items-center gap-1"><Star size={12} className="text-amber-400 fill-amber-400"/> {item.rating != null ? Number(item.rating).toFixed(1) : '—'} · {item.category_name || 'Popular'} · {item.rating_count ?? 0}</span>
                  {qty === 0 ? (
                    <button onClick={()=>add(item.id)} className="w-9 h-9 rounded-full bg-stone-900 text-white flex items-center justify-center hover:bg-stone-800"><Plus size={16}/></button>
                  ) : (
                    <div className="flex items-center gap-1 bg-stone-900 text-white rounded-full p-1">
                      <button onClick={()=>sub(item.id)} className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center"><Minus size={14}/></button>
                      <span className="w-7 text-center text-sm font-bold">{qty}</span>
                      <button onClick={()=>add(item.id)} className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center"><Plus size={14}/></button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-stone-200 pb-safe">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center gap-4">
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-stone-900 flex items-center gap-2"><ShoppingCart size={16}/> {cartItems.length} items · ₱{total.toFixed(2)} {currentStall && cartItems.length>0 && <span className="hidden sm:inline text-stone-500">· {currentStall.name}</span>}</div>
            <div className="text-xs text-stone-500 truncate">{cartItems.map(i=>`${i.name} ×${i.qty}`).join(' · ') || 'Empty cart'}</div>
          </div>
          <button disabled={cartItems.length===0 || loading} onClick={checkout}
            className="shrink-0 bg-stone-900 disabled:bg-stone-200 disabled:text-stone-400 text-white font-semibold px-6 py-3 rounded-full">
            {loading ? 'Placing…' : `Checkout · ₱${total.toFixed(2)}`}
          </button>
        </div>
      </div>

      {lastOrder && (
        <div className="fork-card rounded-2xl p-5 pb-6">
          <h3 className="font-serif font-bold text-stone-900 flex items-center gap-2"><Clock size={16}/> {lastOrder.order.pickup_code} · {liveStatus || lastOrder.order.status}</h3>
          <div className="flex gap-1.5 mt-4">
            {['PENDING_PAYMENT','CONFIRMED','PREPARING','READY','COMPLETED'].map(step => {
              const idx = ['PENDING_PAYMENT','CONFIRMED','PREPARING','READY','COMPLETED'].indexOf(liveStatus || lastOrder.order.status);
              const sIdx = ['PENDING_PAYMENT','CONFIRMED','PREPARING','READY','COMPLETED'].indexOf(step);
              const done = sIdx <= idx;
              return <div key={step} className={`flex-1 h-1.5 rounded-full ${done?'bg-fork-green':'bg-stone-200'}`} title={step}/>;
            })}
          </div>
          <div className="flex justify-between mt-2 text-[11px] font-medium text-stone-500">
            <span>Ordered</span><span>Confirmed</span><span>Preparing</span><span>Ready</span><span>Done</span>
          </div>
        </div>
      )}
    </div>
  );
}
