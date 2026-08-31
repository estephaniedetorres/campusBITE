import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Boxes, AlertTriangle, TrendingUp, ClipboardCheck, Plus, Trash2, Store, Utensils, Edit2, Eye, Users, Shield, LogIn, QrCode } from 'lucide-react';

type Tab = 'menu' | 'inventory' | 'bom' | 'audits' | 'analytics' | 'users';

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('menu');

  if (!user) {
    return (
      <div className="max-w-2xl mx-auto bg-white rounded-2xl border p-8 text-center">
        <Shield size={32} className="mx-auto text-zinc-400" />
        <h2 className="font-bold text-lg mt-3">Login required</h2>
        <p className="text-sm text-zinc-500 mt-2">Menu editing uses <b>Hybrid</b> access: <span className="font-semibold text-zinc-900">ADMIN</span> manages all stalls & inventory, <span className="font-semibold text-orange-600">STALL_OWNER</span> edits only own stall's menu.</p>
        <div className="mt-4 flex gap-3 justify-center">
          <Link to="/login" className="bg-zinc-900 text-white font-semibold px-6 py-3 rounded-xl flex items-center gap-2"><LogIn size={16}/> Login to Admin</Link>
          <Link to="/" className="border px-6 py-3 rounded-xl font-medium">Go Home</Link>
        </div>
        <div className="mt-6 text-xs text-zinc-500 bg-zinc-50 rounded-xl p-4 text-left">
          <div className="font-bold">Demo logins:</div>
          <div>admin / admin123 — ADMIN (all)</div>
          <div>grill / grill123 — Campus Grill owner (stall-001)</div>
          <div>brew / brew123 — Brew & Bites owner (stall-002)</div>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === 'ADMIN';
  // Define tabs with visibility
  const tabs: { k: Tab; l: string; i: any; adminOnly?: boolean }[] = [
    { k: 'menu', l: 'Menu Management', i: Utensils },
    { k: 'inventory', l: 'Ingredients', i: Boxes, adminOnly: true },
    { k: 'bom', l: 'Recipe BOM', i: ClipboardCheck, adminOnly: true },
    { k: 'audits', l: 'EOD Audits', i: AlertTriangle, adminOnly: true },
    { k: 'analytics', l: 'Analytics', i: TrendingUp, adminOnly: true },
    { k: 'users', l: 'Users', i: Users, adminOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin);

  // Force stall owners to menu tab if they are on admin-only tab
  useEffect(() => {
    if (!isAdmin && tab !== 'menu') setTab('menu');
  }, [isAdmin, tab]);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center"><Shield size={18}/></div>
        <div>
          <div className="font-bold leading-none">{user.display_name} — <span className={`text-xs px-2 py-0.5 rounded-full ${isAdmin?'bg-zinc-900 text-white':'bg-orange-100 text-orange-700'}`}>{user.role}</span></div>
          <div className="text-xs text-zinc-500">{isAdmin ? 'Can manage ALL stalls, inventory, BOM, audits & users' : `Stall: ${user.stall_name} (${user.stall_id}) — menu only`}</div>
        </div>
        <div className="ml-auto text-xs bg-zinc-50 border rounded-xl px-3 py-2 hidden md:block">
          <div className="font-semibold">Hybrid Mode Active</div>
          <div className="text-zinc-500">ADMIN=full • STALL_OWNER=own stall menu</div>
        </div>
      </div>

      <div className="flex gap-2 overflow-auto pb-1">
        {visibleTabs.map(t=>{ const Icon=t.i; return (
          <button key={t.k} onClick={()=>setTab(t.k)} className={`px-4 py-2 rounded-xl text-sm font-semibold flex items-center gap-2 border whitespace-nowrap ${tab===t.k?'bg-zinc-900 text-white border-zinc-900':'bg-white hover:bg-zinc-50'}`}><Icon size={16}/>{t.l}</button>
        );})}
        {!isAdmin && <span className="ml-auto text-xs text-zinc-500 py-2 hidden md:block">Inventory/BOM/Audits hidden for stall owners</span>}
      </div>

      {tab==='menu' && <MenuManagementTab />}
      {tab==='inventory' && (isAdmin ? <InventoryTab /> : <AdminOnly />)}
      {tab==='bom' && (isAdmin ? <BomTab /> : <AdminOnly />)}
      {tab==='audits' && (isAdmin ? <AuditTab /> : <AdminOnly />)}
      {tab==='analytics' && (isAdmin ? <AnalyticsTab /> : <AdminOnly />)}
      {tab==='users' && (isAdmin ? <UsersTab /> : <AdminOnly />)}
    </div>
  );
}

function AdminOnly(){ return <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-8 text-center"><Shield size={24} className="mx-auto text-amber-600"/><div className="font-bold mt-2">ADMIN only</div><p className="text-sm text-zinc-600">Stall owners edit menu only. Login as <code>admin/admin123</code> for inventory, BOM, audits, analytics & users.</p></div>; }

// ============ MENU MANAGEMENT TAB (Hybrid) ============
function MenuManagementTab(){
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [stalls, setStalls] = useState<any[]>([]);
  const [selectedStall, setSelectedStall] = useState<string>('');
  const [categories, setCategories] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const [newStall, setNewStall] = useState({ name:'', description:'' });
  const [newCat, setNewCat] = useState({ name:'', displayOrder:'0' });
  const [newItem, setNewItem] = useState({ name:'', price:'', description:'', categoryId:'', isAvailable: '1' });
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [error, setError] = useState('');

  const loadStalls = async()=> {
    const s = await api.get<any[]>('/api/stalls');
    setStalls(s);
    // Auto-select: stall owner only their stall, admin first
    if (user?.role === 'STALL_OWNER' && user.stall_id) {
      setSelectedStall(user.stall_id);
    } else if (!selectedStall && s[0]) setSelectedStall(s[0].id);
  };
  const [health, setHealth] = useState<any>(null);
  useEffect(()=>{ api.get<any>('/api/health').then(setHealth).catch(()=>{}); }, []);
  const loadDetails = async(stId: string)=>{
    if (!stId) return;
    const [cats, items] = await Promise.all([
      api.get<any[]>(`/api/categories?stallId=${stId}`),
      api.get<any[]>(`/api/menu?stallId=${stId}&includeUnavailable=1`),
    ]);
    setCategories(cats);
    setMenu(items);
    if (cats[0] && !newItem.categoryId) setNewItem(prev=>({...prev, categoryId: cats[0].id}));
  };
  useEffect(()=>{ loadStalls(); }, []);
  useEffect(()=>{ if (selectedStall) loadDetails(selectedStall); }, [selectedStall]);

  const visibleStalls = isAdmin ? stalls : stalls.filter(s=>s.id===user?.stall_id);

  async function createStall(){
    setError('');
    try{
      await api.post('/api/stalls', { name: newStall.name, description: newStall.description });
      setNewStall({ name:'', description:'' });
      await loadStalls();
    }catch(e:any){ setError(e.message); }
  }
  async function createCat(){
    setError('');
    try{
      await api.post('/api/categories', { stallId: selectedStall, name: newCat.name, displayOrder: Number(newCat.displayOrder)||0 });
      setNewCat({ name:'', displayOrder:'0' });
      await loadDetails(selectedStall);
    }catch(e:any){ setError(e.message); }
  }
  async function createItem(){
    setError('');
    try{
      await api.post('/api/menu', { stallId: selectedStall, categoryId: newItem.categoryId, name: newItem.name, description: newItem.description, price: Number(newItem.price), isAvailable: Number(newItem.isAvailable) });
      setNewItem({ name:'', price:'', description:'', categoryId: categories[0]?.id || '', isAvailable:'1' });
      await loadDetails(selectedStall);
    }catch(e:any){ setError(e.message); }
  }
  async function toggleAvailability(item:any){
    try{ await api.patch(`/api/menu/${item.id}`, { isAvailable: item.is_available ? 0 : 1 }); await loadDetails(selectedStall); }catch(e:any){ alert(e.message); }
  }
  async function deleteItem(id:string){
    if(!confirm('Delete menu item? This also removes its recipe BOM.')) return;
    try{ await api.del(`/api/menu/${id}`); await loadDetails(selectedStall); }catch(e:any){ alert(e.message); }
  }
  async function deleteCat(id:string){
    if(!confirm('Delete category? Only works if empty.')) return;
    try{ await api.del(`/api/categories/${id}`); await loadDetails(selectedStall); }catch(e:any){ alert(e.message); }
  }
  async function saveEdit(){
    if(!editingItem) return;
    try{
      await api.patch(`/api/menu/${editingItem.id}`, { name: editingItem.name, price: Number(editingItem.price), description: editingItem.description, categoryId: editingItem.category_id, isAvailable: Number(editingItem.is_available) });
      setEditingItem(null); await loadDetails(selectedStall);
    }catch(e:any){ alert(e.message); }
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border p-4">
        <h3 className="font-bold flex items-center gap-2"><Store size={16}/> Stalls — who can edit what?</h3>
        <div className="grid md:grid-cols-2 gap-3 mt-3">
          <div className="bg-zinc-50 rounded-xl p-3 text-sm">
            <div className="font-semibold flex items-center gap-1"><Shield size={12}/> ADMIN</div>
            <div className="text-zinc-600">Create/edit/delete ANY stall, any category, any menu item in any stall.</div>
          </div>
          <div className="bg-orange-50 rounded-xl p-3 text-sm border border-orange-200">
            <div className="font-semibold flex items-center gap-1"><Utensils size={12}/> STALL_OWNER</div>
            <div className="text-zinc-600">Only stall <b className="text-orange-700">{user?.stall_name || user?.stall_id}</b>. Server returns 403 if they try other stall.</div>
          </div>
        </div>
        <div className="flex gap-2 mt-3 flex-wrap">
          {visibleStalls.map(s=>(
            <button key={s.id} onClick={()=>setSelectedStall(s.id)} className={`px-4 py-2 rounded-xl text-sm font-semibold border ${selectedStall===s.id?'bg-zinc-900 text-white border-zinc-900':'bg-white'}`}>{s.name} <span className="text-xs opacity-60">({s.id})</span></button>
          ))}
        </div>
        {isAdmin && (
          <div className="mt-3 flex gap-2">
            <input value={newStall.name} onChange={e=>setNewStall({...newStall, name:e.target.value})} placeholder="New stall name" className="flex-1 border rounded-xl px-3 py-2 text-sm" />
            <input value={newStall.description} onChange={e=>setNewStall({...newStall, description:e.target.value})} placeholder="Description" className="flex-1 border rounded-xl px-3 py-2 text-sm" />
            <button onClick={createStall} className="bg-zinc-900 text-white px-5 rounded-xl text-sm font-semibold flex items-center gap-1"><Plus size={14}/> Add Stall</button>
          </div>
        )}
        {error && <div className="mt-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-3 py-2">{error}</div>}
      </div>

      {/* QR Generator — Phase 3: Stall QR for customers to scan */}
      <div className="bg-white rounded-2xl border p-4">
        <h4 className="font-bold flex items-center gap-2"><QrCode size={16}/> Stall QR Codes — Customers scan to open Kiosk</h4>
        <p className="text-xs text-zinc-500 mt-1">Offline QR: encodes <code>http://&lt;hotspot-ip&gt;:3000/kiosk?stall=STALL_ID</code>. Print and post at stall front. Kiosk is the <b>only public</b> page.</p>
        <div className="grid md:grid-cols-2 gap-4 mt-4">
          {visibleStalls.map((s:any)=>{
            const ip = health?.ips?.[0] || window.location.hostname;
            const port = health?.port || window.location.port || '3000';
            // Use hotspot IP for print; fallback to current host for dev
            const host = ip && ip !== 'localhost' ? `${ip}:${port}` : window.location.host;
            const url = `http://${host}/kiosk?stall=${s.id}`;
            const tableUrl = `http://${host}/kiosk?stall=${s.id}&table=1`;
            return (
              <div key={s.id} className="border-2 rounded-2xl p-4 flex gap-4 items-center">
                <div className="bg-white p-2 border rounded-xl">
                  <QRCodeSVG value={url} size={96} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">{s.name}</div>
                  <div className="text-xs text-zinc-500 break-all">{url}</div>
                  <div className="text-xs text-zinc-500 mt-1">Table example: <span className="font-mono bg-zinc-100 px-1 rounded">{tableUrl}</span></div>
                  <div className="flex gap-2 mt-2">
                    <button onClick={()=>{ navigator.clipboard.writeText(url); alert('Copied ' + url); }} className="text-xs border px-3 py-1.5 rounded-lg">Copy URL</button>
                    <button onClick={()=>window.print()} className="text-xs bg-zinc-900 text-white px-3 py-1.5 rounded-lg">Print QR</button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {visibleStalls.length===0 && <div className="text-sm text-zinc-400 py-4 text-center">No stalls — add one above (ADMIN)</div>}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border p-4">
          <h4 className="font-bold">Categories — {stalls.find(s=>s.id===selectedStall)?.name || ''}</h4>
          <div className="space-y-2 mt-3 max-h-72 overflow-auto">
            {categories.map(cat=>(
              <div key={cat.id} className="flex items-center justify-between border rounded-xl px-3 py-2.5">
                <div><div className="font-medium text-sm">{cat.name}</div><div className="text-xs text-zinc-500">order {cat.display_order} • {cat.id}</div></div>
                <button onClick={()=>deleteCat(cat.id)} className="text-red-600 p-1"><Trash2 size={14}/></button>
              </div>
            ))}
            {categories.length===0 && <div className="text-sm text-zinc-400 py-4 text-center">No categories — create one below</div>}
          </div>
          <div className="flex gap-2 mt-3">
            <input value={newCat.name} onChange={e=>setNewCat({...newCat, name:e.target.value})} placeholder="Category name" className="flex-1 border rounded-xl px-3 py-2 text-sm" />
            <input value={newCat.displayOrder} onChange={e=>setNewCat({...newCat, displayOrder:e.target.value})} placeholder="Order" type="number" className="w-20 border rounded-xl px-3 py-2 text-sm" />
            <button onClick={createCat} className="bg-zinc-900 text-white px-4 rounded-xl text-sm font-semibold">Add</button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border p-4">
          <h4 className="font-bold">Add Menu Item — {stalls.find(s=>s.id===selectedStall)?.name || ''}</h4>
          <div className="grid gap-2 mt-3">
            <input value={newItem.name} onChange={e=>setNewItem({...newItem, name:e.target.value})} placeholder="Item name (e.g. Spicy Burger)" className="border rounded-xl px-3 py-2 text-sm" />
            <div className="grid grid-cols-2 gap-2">
              <input value={newItem.price} onChange={e=>setNewItem({...newItem, price:e.target.value})} placeholder="Price ₱" type="number" className="border rounded-xl px-3 py-2 text-sm" />
              <select value={newItem.categoryId} onChange={e=>setNewItem({...newItem, categoryId:e.target.value})} className="border rounded-xl px-3 py-2 text-sm"><option value="">Category</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            <input value={newItem.description} onChange={e=>setNewItem({...newItem, description:e.target.value})} placeholder="Description" className="border rounded-xl px-3 py-2 text-sm" />
            <div className="flex gap-2">
              <select value={newItem.isAvailable} onChange={e=>setNewItem({...newItem, isAvailable:e.target.value})} className="border rounded-xl px-3 py-2 text-sm">
                <option value="1">Available</option><option value="0">Hidden (Kiosk off)</option>
              </select>
              <button onClick={createItem} className="flex-1 bg-orange-500 text-white font-bold py-2.5 rounded-xl flex items-center justify-center gap-2"><Plus size={16}/> Add Item</button>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-2">Price non-negative. Stall ownership enforced server-side: STALL_OWNER gets 403 if stallId mismatch.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border overflow-auto">
        <div className="p-4 border-b flex items-center justify-between">
          <h4 className="font-bold">Menu Items — {menu.length} items</h4>
          <span className="text-xs bg-zinc-100 px-2 py-1 rounded-full">{isAdmin ? 'ADMIN sees all in stall' : `Filtered to ${user?.stall_name}`}</span>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-zinc-50"><tr className="text-left"><th className="p-3">Item</th><th>Category</th><th>Price</th><th>Avail</th><th></th></tr></thead>
          <tbody className="divide-y">
            {menu.map((it:any)=>(
              <tr key={it.id} className="hover:bg-zinc-50">
                <td className="p-3"><div className="font-medium">{it.name}</div><div className="text-xs text-zinc-500">{it.id} • {it.description || ''}</div></td>
                <td className="p-3 text-xs">{it.category_name}</td>
                <td className="p-3 font-bold">₱{it.price}</td>
                <td className="p-3"><button onClick={()=>toggleAvailability(it)} className={`text-xs font-bold px-2 py-1 rounded-full border ${it.is_available?'bg-emerald-100 text-emerald-700 border-emerald-200':'bg-zinc-100 text-zinc-500'}`}>{it.is_available?'Available':'Hidden'}</button></td>
                <td className="p-3">
                  <div className="flex gap-1">
                    <button onClick={()=>setEditingItem({...it})} className="p-1.5 border rounded-lg hover:bg-zinc-100"><Edit2 size={14}/></button>
                    <button onClick={()=>deleteItem(it.id)} className="p-1.5 border rounded-lg text-red-600 hover:bg-red-50"><Trash2 size={14}/></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {menu.length===0 && <div className="p-8 text-center text-sm text-zinc-400">No menu items for this stall — add one above.</div>}
      </div>

      {editingItem && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-lg space-y-3">
            <h3 className="font-bold text-lg">Edit — {editingItem.id}</h3>
            <input value={editingItem.name} onChange={e=>setEditingItem({...editingItem, name:e.target.value})} placeholder="Name" className="w-full border rounded-xl px-3 py-2 text-sm" />
            <input value={editingItem.price} onChange={e=>setEditingItem({...editingItem, price:e.target.value})} placeholder="Price" type="number" className="w-full border rounded-xl px-3 py-2 text-sm" />
            <input value={editingItem.description||''} onChange={e=>setEditingItem({...editingItem, description:e.target.value})} placeholder="Description" className="w-full border rounded-xl px-3 py-2 text-sm" />
            <select value={editingItem.category_id} onChange={e=>setEditingItem({...editingItem, category_id:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-sm">{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select>
            <select value={String(editingItem.is_available)} onChange={e=>setEditingItem({...editingItem, is_available: Number(e.target.value)})} className="w-full border rounded-xl px-3 py-2 text-sm"><option value="1">Available</option><option value="0">Hidden</option></select>
            <div className="flex gap-2">
              <button onClick={()=>setEditingItem(null)} className="flex-1 border py-2.5 rounded-xl font-medium">Cancel</button>
              <button onClick={saveEdit} className="flex-1 bg-zinc-900 text-white py-2.5 rounded-xl font-bold">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryTab() {
  const [ings, setIngs] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [showIn, setShowIn] = useState<string|null>(null);
  const [qty, setQty] = useState('');
  const load = async()=>{ setIngs(await api.get<any[]>('/api/inventory')); setLogs(await api.get<any[]>('/api/stock-logs?limit=50')); };
  useEffect(()=>{ load(); }, []);
  async function stockIn(id: string){
    await api.post(`/api/inventory/${id}/stock-in`, { quantity: Number(qty), reason: 'Admin stock-in' });
    setShowIn(null); setQty(''); load();
  }
  async function stockOut(id: string){
    const q = Number(prompt('Wastage quantity?')); if(!q) return;
    await api.post(`/api/inventory/${id}/stock-out`, { quantity: q, reason: 'Wastage' }); load();
  }
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ings.map(ing=>(
          <div key={ing.id} className={`bg-white rounded-2xl border-2 p-4 ${ing.is_low?'border-red-300 bg-red-50/50':''}`}>
            <div className="flex justify-between items-start">
              <div><div className="font-bold">{ing.name}</div><div className="text-xs text-zinc-500">{ing.id} • {ing.unit} • ₱{ing.cost_per_unit}/unit</div></div>
              {ing.is_low && <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1"><AlertTriangle size={12}/> LOW</span>}
            </div>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-2xl font-black">{ing.current_stock}</span><span className="text-zinc-500 text-sm">{ing.unit}</span>
              <span className="ml-auto text-xs text-zinc-500">min {ing.min_threshold}</span>
            </div>
            <div className="w-full bg-zinc-100 rounded-full h-2 mt-2 overflow-hidden"><div className={`h-full ${ing.is_low?'bg-red-500':'bg-emerald-500'}`} style={{ width: `${Math.min(100, (ing.current_stock / Math.max(ing.min_threshold*2,1))*100)}%` }} /></div>
            <div className="flex gap-2 mt-3">
              {showIn===ing.id ? (
                <div className="flex gap-2 flex-1"><input value={qty} onChange={e=>setQty(e.target.value)} placeholder="Qty" type="number" className="flex-1 border rounded-xl px-3 py-2 text-sm" /><button onClick={()=>stockIn(ing.id)} className="bg-emerald-600 text-white px-4 rounded-xl text-sm font-bold">Add</button><button onClick={()=>setShowIn(null)} className="border px-3 rounded-xl text-sm">Cancel</button></div>
              ) : <button onClick={()=>setShowIn(ing.id)} className="flex-1 bg-zinc-900 text-white text-sm font-semibold py-2 rounded-xl flex items-center justify-center gap-2"><Plus size={14}/> Stock In</button>}
              <button onClick={()=>stockOut(ing.id)} className="border text-sm px-3 py-2 rounded-xl">Wastage</button>
            </div>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-2xl border">
        <div className="p-4 font-bold border-b">Recent Stock Logs</div>
        <div className="divide-y max-h-80 overflow-auto">
          {logs.map(l=><div key={l.id} className="px-4 py-2.5 flex items-center gap-3 text-sm"><span className={`text-xs font-bold px-2 py-1 rounded-full ${l.change_type==='STOCK_IN'?'bg-emerald-100 text-emerald-700': l.change_type==='BOM_DEDUCTION'?'bg-sky-100 text-sky-700': l.change_type==='WASTAGE'?'bg-red-100 text-red-700':'bg-amber-100 text-amber-700'}`}>{l.change_type}</span><span className="font-medium">{l.ingredient_name}</span><span className={l.quantity_delta>0?'text-emerald-600':'text-red-600'}>{l.quantity_delta>0?'+':''}{l.quantity_delta}</span><span className="text-zinc-500 text-xs ml-auto">{new Date(l.created_at).toLocaleString()}</span></div>)}
        </div>
      </div>
    </div>
  );
}

function BomTab(){
  const [boms, setBoms]=useState<any[]>([]);
  const [menu, setMenu]=useState<any[]>([]);
  const [ings, setIngs]=useState<any[]>([]);
  const [form, setForm]=useState({ menuItemId:'', ingredientId:'', quantityRequired:'' });
  const load = async()=>{ setBoms(await api.get<any[]>('/api/recipe-bom')); setMenu(await api.get<any[]>('/api/menu?includeUnavailable=1')); setIngs(await api.get<any[]>('/api/ingredients')); };
  useEffect(()=>{ load(); }, []);
  async function add(){ await api.post('/api/recipe-bom', { menuItemId: form.menuItemId, ingredientId: form.ingredientId, quantityRequired: Number(form.quantityRequired)}); setForm({ menuItemId:'', ingredientId:'', quantityRequired:'' }); load(); }
  async function del(id:string){ if(!confirm('Delete BOM?'))return; await api.del(`/api/recipe-bom/${id}`); load(); }
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border p-4">
        <h3 className="font-bold">Add Recipe BOM link</h3>
        <div className="grid md:grid-cols-4 gap-3 mt-3">
          <select value={form.menuItemId} onChange={e=>setForm({...form, menuItemId:e.target.value})} className="border rounded-xl px-3 py-2 text-sm"><option value="">Menu item</option>{menu.map((m:any)=><option key={m.id} value={m.id}>{m.name} ({m.stall_id})</option>)}</select>
          <select value={form.ingredientId} onChange={e=>setForm({...form, ingredientId:e.target.value})} className="border rounded-xl px-3 py-2 text-sm"><option value="">Ingredient</option>{ings.map((i:any)=><option key={i.id} value={i.id}>{i.name} ({i.unit})</option>)}</select>
          <input value={form.quantityRequired} onChange={e=>setForm({...form, quantityRequired:e.target.value})} placeholder="Qty per 1 serving (e.g. 150)" type="number" className="border rounded-xl px-3 py-2 text-sm" />
          <button onClick={add} className="bg-zinc-900 text-white rounded-xl font-semibold">Add BOM</button>
        </div>
        <p className="text-xs text-zinc-500 mt-2">Example: Classic Burger → Beef Patty ×1 pcs. Atomic deduction multiplies by order quantity. ADMIN can edit any; STALL_OWNER filtered server-side to own stall.</p>
      </div>
      <div className="bg-white rounded-2xl border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50"><tr className="text-left"><th className="p-3">Menu Item</th><th>Ingredient</th><th>Qty / serving</th><th></th></tr></thead>
          <tbody className="divide-y">{boms.map((b:any)=><tr key={b.id}><td className="p-3 font-medium">{b.menu_item_name}</td><td>{b.ingredient_name}</td><td>{b.quantity_required}</td><td><button onClick={()=>del(b.id)} className="text-red-600 p-1"><Trash2 size={14}/></button></td></tr>)}</tbody>
        </table>
      </div>
    </div>
  );
}

function AuditTab(){
  const [ings, setIngs]=useState<any[]>([]);
  const [audits, setAudits]=useState<any[]>([]);
  const [counts, setCounts]=useState<Record<string,string>>({});
  const [date, setDate]=useState(new Date().toISOString().slice(0,10));
  const load=async()=>{ setIngs(await api.get<any[]>('/api/inventory')); try{ setAudits(await api.get<any[]>(`/api/audits?date=${date}`)); }catch{ setAudits([]);} };
  useEffect(()=>{ load(); }, [date]);
  async function submit(){
    const entries = Object.entries(counts).filter(([_,v])=>v!=='').map(([id, v])=>({ ingredientId: id, physicalActualStock: Number(v) }));
    if(entries.length===0) return alert('Enter at least one count');
    await api.post('/api/audits/bulk', { auditDate: date, entries }); setCounts({}); load();
  }
  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border-2 border-amber-200 rounded-2xl p-4">
        <h3 className="font-bold flex items-center gap-2"><ClipboardCheck size={16}/> End-of-Day Variance Audit — ADMIN only</h3>
        <p className="text-sm text-zinc-600">System computes variance = physical − expected. Positive = overage, negative = shrinkage. Adjustment auto-applied.</p>
        <div className="flex gap-3 mt-3"><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded-xl px-3 py-2 text-sm" /><button onClick={submit} className="bg-zinc-900 text-white px-6 py-2 rounded-xl font-semibold">Submit Audit</button></div>
      </div>
      <div className="bg-white rounded-2xl border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50"><tr><th className="p-3 text-left">Ingredient</th><th>System Expected</th><th>Physical Count</th><th>Unit</th></tr></thead>
          <tbody className="divide-y">{ings.map((ing:any)=><tr key={ing.id}><td className="p-3 font-medium">{ing.name}</td><td className="p-3">{ing.current_stock}</td><td className="p-3"><input value={counts[ing.id]||''} onChange={e=>setCounts({...counts, [ing.id]:e.target.value})} placeholder="actual" type="number" className="border rounded-xl px-3 py-1.5 w-28" /></td><td>{ing.unit}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="bg-white rounded-2xl border">
        <div className="p-4 font-bold border-b">Audits for {date}</div>
        {audits.length===0? <div className="p-6 text-center text-zinc-400 text-sm">No audits yet</div> :
          <table className="w-full text-sm"><thead className="bg-zinc-50"><tr><th className="p-3 text-left">Ingredient</th><th>Expected</th><th>Actual</th><th>Variance</th></tr></thead><tbody className="divide-y">{audits.map((a:any)=><tr key={a.id}><td className="p-3">{a.ingredient_name}</td><td>{a.system_expected_stock}</td><td>{a.physical_actual_stock}</td><td className={a.variance===0?'text-emerald-600': a.variance<0?'text-red-600':'text-amber-600'}>{a.variance>0?'+':''}{a.variance}</td></tr>)}</tbody></table>}
      </div>
    </div>
  );
}

function AnalyticsTab(){
  const [data, setData]=useState<any>(null);
  const [date, setDate]=useState(new Date().toISOString().slice(0,10));
  const load=async()=> { try{ setData(await api.get<any>(`/api/reports/summary?from=${date}&to=${date}`)); }catch(e:any){ setData(null);} };
  useEffect(()=>{ load(); }, [date]);
  // Fallback to old analytics endpoint for compat
  const [dailyData, setDailyData] = useState<any>(null);
  useEffect(()=>{ api.get<any>(`/api/orders/analytics/daily?date=${date}`).then(setDailyData).catch(()=>{}); }, [date]);
  const summary = data?.daily?.[0] || dailyData?.revenue || { revenue: 0, orderCount: 0, orders:0 };
  const topItems = data?.lowStocks ? [] : dailyData?.topItems;
  const hourly = dailyData?.hourly;
  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center">
        <input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded-xl px-3 py-2 text-sm" />
        <button onClick={()=>{ load(); api.get<any>(`/api/orders/analytics/daily?date=${date}`).then(setDailyData).catch(()=>{}); }} className="border bg-white px-4 py-2 rounded-xl text-sm font-medium">Refresh</button>
      </div>
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border p-5"><div className="text-sm text-zinc-500">Revenue ({date})</div><div className="text-2xl font-black">₱{Number(summary.revenue||summary.orders||0).toFixed?.(2) || '0.00'}</div><div className="text-xs text-zinc-500">{summary.orders || summary.orderCount || 0} orders</div></div>
        <div className="bg-white rounded-2xl border p-5"><div className="text-sm text-zinc-500">Top Item</div><div className="text-lg font-bold">{topItems?.[0]?.name || '—'}</div><div className="text-xs text-zinc-500">{topItems?.[0]?.qty || 0} sold</div></div>
        <div className="bg-white rounded-2xl border p-5"><div className="text-sm text-zinc-500">Hourly Peak</div><div className="text-lg font-bold">{hourly?.length? `${hourly.reduce((m:any,c:any)=> c.orders>m.orders?c:m, hourly[0]).hour}:00`:'—'}</div><div className="text-xs text-zinc-500">{hourly?.length||0} active hours</div></div>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border p-5">
          <h4 className="font-bold">Top 5 Items</h4>
          <div className="mt-3 space-y-2">{(topItems||[]).map((t:any)=><div key={t.name} className="flex justify-between text-sm border rounded-xl px-3 py-2"><span>{t.name}</span><span className="font-bold">{t.qty} × ₱{t.revenue}</span></div>)}{(!topItems || topItems.length===0) && <div className="text-sm text-zinc-400">No sales yet</div>}</div>
        </div>
        <div className="bg-white rounded-2xl border p-5">
          <h4 className="font-bold">Hourly Breakdown</h4>
          <div className="mt-3 space-y-2 max-h-64 overflow-auto">{(hourly||[]).map((h:any)=><div key={h.hour} className="flex items-center gap-3 text-sm"><span className="w-12 font-mono">{h.hour}:00</span><div className="flex-1 bg-zinc-100 rounded-full h-2 overflow-hidden"><div className="bg-orange-500 h-full" style={{ width: `${Math.min(100, (h.orders/10)*100)}%` }} /></div><span className="w-20 text-right">{h.orders} orders</span></div>)}{(!hourly || hourly.length===0) && <div className="text-sm text-zinc-400">No data</div>}</div>
        </div>
      </div>
    </div>
  );
}

function UsersTab(){
  const [users, setUsers]=useState<any[]>([]);
  const [stalls, setStalls]=useState<any[]>([]);
  const [form, setForm]=useState({ username:'', pin:'', role:'STALL_OWNER' as 'ADMIN'|'STALL_OWNER', stallId:'', displayName:'' });
  const load=async()=>{ setUsers(await api.get<any[]>('/api/users')); setStalls(await api.get<any[]>('/api/stalls')); };
  useEffect(()=>{ load(); }, []);
  async function create(){
    await api.post('/api/users', { username: form.username, pin: form.pin, role: form.role, stallId: form.role==='STALL_OWNER'?form.stallId:null, displayName: form.displayName || form.username });
    setForm({ username:'', pin:'', role:'STALL_OWNER', stallId:'', displayName:'' }); load();
  }
  async function remove(id:string){ if(!confirm('Delete user?'))return; await api.del(`/api/users/${id}`); load(); }
  async function toggleActive(u:any){ await api.patch(`/api/users/${u.id}`, { is_active: u.is_active?0:1 }); load(); }
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border p-4">
        <h3 className="font-bold flex items-center gap-2"><Users size={16}/> Create User — ADMIN only</h3>
        <div className="grid md:grid-cols-5 gap-2 mt-3">
          <input value={form.username} onChange={e=>setForm({...form, username:e.target.value})} placeholder="username" className="border rounded-xl px-3 py-2 text-sm" />
          <input value={form.pin} onChange={e=>setForm({...form, pin:e.target.value})} placeholder="PIN (e.g. grill123)" className="border rounded-xl px-3 py-2 text-sm" />
          <input value={form.displayName} onChange={e=>setForm({...form, displayName:e.target.value})} placeholder="Display name" className="border rounded-xl px-3 py-2 text-sm" />
          <select value={form.role} onChange={e=>setForm({...form, role:e.target.value as any})} className="border rounded-xl px-3 py-2 text-sm"><option value="STALL_OWNER">STALL_OWNER</option><option value="ADMIN">ADMIN</option></select>
          <select value={form.stallId} onChange={e=>setForm({...form, stallId:e.target.value})} className="border rounded-xl px-3 py-2 text-sm" disabled={form.role==='ADMIN'}><option value="">Stall (if owner)</option>{stalls.map((s:any)=><option key={s.id} value={s.id}>{s.name}</option>)}</select>
        </div>
        <button onClick={create} className="mt-3 bg-zinc-900 text-white px-6 py-2.5 rounded-xl font-semibold">Create User</button>
      </div>
      <div className="bg-white rounded-2xl border overflow-auto">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50"><tr><th className="p-3 text-left">User</th><th>Role</th><th>Stall</th><th>Active</th><th></th></tr></thead>
          <tbody className="divide-y">
            {users.map((u:any)=>(
              <tr key={u.id}>
                <td className="p-3"><div className="font-medium">{u.username}</div><div className="text-xs text-zinc-500">{u.display_name} • {u.id}</div></td>
                <td className="p-3"><span className={`text-xs font-bold px-2 py-1 rounded-full ${u.role==='ADMIN'?'bg-zinc-900 text-white':'bg-orange-100 text-orange-700'}`}>{u.role}</span></td>
                <td className="p-3 text-xs">{u.stall_name || (u.stall_id||'-')}</td>
                <td className="p-3"><button onClick={()=>toggleActive(u)} className={`text-xs px-2 py-1 rounded-full border ${u.is_active?'bg-emerald-100 text-emerald-700':'bg-red-100 text-red-700'}`}>{u.is_active?'Active':'Disabled'}</button></td>
                <td className="p-3"><button onClick={()=>remove(u.id)} className="text-red-600 p-1"><Trash2 size={14}/></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
