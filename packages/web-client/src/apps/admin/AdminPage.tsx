import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { Boxes, AlertTriangle, TrendingUp, ClipboardCheck, Plus, Trash2, Store, Utensils, Edit2, Users, Shield, LogIn, QrCode, Image as ImageIcon, Upload, Link as LinkIcon } from 'lucide-react';

type Tab = 'menu' | 'inventory' | 'bom' | 'audits' | 'analytics' | 'users';

export default function AdminPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('menu');

  if (!user) {
    return (
      <div className="max-w-xl mx-auto fork-card rounded-[24px] p-8 text-center">
        <div className="w-12 h-12 rounded-2xl bg-stone-900 text-white flex items-center justify-center mx-auto">
          <Shield size={22} strokeWidth={1.75} />
        </div>
        <h2 className="font-serif font-bold text-xl text-stone-900 mt-4">Login required</h2>
        <p className="text-sm text-stone-500 mt-2 leading-relaxed">
          Menu editing uses <b className="font-semibold text-stone-900">Hybrid</b> access:{' '}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold bg-stone-900 text-white">ADMIN</span> manages all stalls & inventory,{' '}
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-fork-greenSoft text-fork-green border border-fork-green/10">STALL_OWNER</span> edits only own stall's menu.
        </p>
        <div className="mt-6 flex gap-3 justify-center flex-wrap">
          <Link to="/login" className="bg-stone-900 text-white font-semibold px-6 py-3 rounded-full flex items-center gap-2 hover:bg-stone-800 transition shadow-sm">
            <LogIn size={16} /> Login to Admin
          </Link>
          <Link to="/" className="bg-white border border-stone-200 px-6 py-3 rounded-full font-medium text-stone-700 hover:bg-stone-50 transition">
            Go Home
          </Link>
        </div>
        <div className="mt-6 text-xs text-stone-500 bg-stone-50 rounded-2xl p-4 text-left border border-stone-100">
          <div className="font-serif font-bold text-stone-900 text-sm">Demo logins</div>
          <div className="mt-2 space-y-1 font-mono text-[13px]">
            <div><span className="font-semibold text-stone-900">admin</span> / admin123 — ADMIN (all)</div>
            <div><span className="font-semibold text-stone-900">potato</span> / potato123 — Potato Corner — fries owner (stall-001)</div>
            <div><span className="font-semibold text-stone-900">matees</span> / matees123 — Matees — ice cream owner (stall-002)</div>
          </div>
        </div>
      </div>
    );
  }

  const isAdmin = user.role === 'ADMIN';
  const tabs: { k: Tab; l: string; i: any; adminOnly?: boolean }[] = [
    { k: 'menu', l: 'Menu', i: Utensils },
    { k: 'inventory', l: 'Ingredients', i: Boxes, adminOnly: true },
    { k: 'bom', l: 'Recipe BOM', i: ClipboardCheck, adminOnly: true },
    { k: 'audits', l: 'EOD Audits', i: AlertTriangle, adminOnly: true },
    { k: 'analytics', l: 'Analytics', i: TrendingUp, adminOnly: true },
    { k: 'users', l: 'Users', i: Users, adminOnly: true },
  ];

  const visibleTabs = tabs.filter(t => !t.adminOnly || isAdmin);

  useEffect(() => {
    if (!isAdmin && tab !== 'menu') setTab('menu');
  }, [isAdmin, tab]);

  return (
    <div className="space-y-6">
      {/* Identity — The Fork, warm stone, card-first */}
      <div className="fork-card rounded-2xl p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-stone-900 text-white flex items-center justify-center shrink-0">
          <Shield size={18} strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="font-semibold text-sm text-stone-900 flex items-center gap-2 flex-wrap">
            <span className="font-serif font-bold">{user.display_name}</span>
            <span className={`text-[11px] font-bold tracking-wide px-2.5 py-1 rounded-full border ${isAdmin ? 'bg-stone-900 text-white border-stone-900' : 'bg-fork-greenSoft text-fork-green border-fork-green/10'}`}>
              {user.role}
            </span>
            <span className="hidden sm:inline text-stone-300">·</span>
            <span className="text-xs font-medium text-stone-500">CampusBITE</span>
          </div>
          <div className="text-xs text-stone-500 truncate">
            {isAdmin ? 'Can manage ALL stalls, inventory, BOM, audits & users' : `Stall: ${user.stall_name} (${user.stall_id}) — menu only`}
          </div>
        </div>
        <div className="ml-auto hidden md:block text-xs bg-stone-50 border border-stone-100 rounded-2xl px-3.5 py-2.5 shrink-0">
          <div className="font-semibold text-stone-900">Hybrid Mode Active</div>
          <div className="text-stone-500">ADMIN = full · STALL_OWNER = own stall menu</div>
        </div>
      </div>

      {/* Tabs — pill, minimal, stone */}
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
        {visibleTabs.map(t => {
          const Icon = t.i;
          const active = tab === t.k;
          return (
            <button
              key={t.k}
              onClick={() => setTab(t.k)}
              className={`shrink-0 snap-start px-4 py-2.5 rounded-full text-sm font-semibold flex items-center gap-2 border whitespace-nowrap transition ${
                active
                  ? 'bg-stone-900 text-white border-stone-900 shadow-sm'
                  : 'bg-white hover:bg-stone-50 text-stone-600 border-stone-200'
              }`}
            >
              <Icon size={16} strokeWidth={active ? 2 : 1.75} />
              {t.l}
            </button>
          );
        })}
        {!isAdmin && <span className="ml-auto text-xs text-stone-400 py-2 hidden md:block whitespace-nowrap">Inventory / BOM / Audits hidden for stall owners</span>}
      </div>

      {tab === 'menu' && <MenuManagementTab />}
      {tab === 'inventory' && (isAdmin ? <InventoryTab /> : <AdminOnly />)}
      {tab === 'bom' && (isAdmin ? <BomTab /> : <AdminOnly />)}
      {tab === 'audits' && (isAdmin ? <AuditTab /> : <AdminOnly />)}
      {tab === 'analytics' && (isAdmin ? <AnalyticsTab /> : <AdminOnly />)}
      {tab === 'users' && (isAdmin ? <UsersTab /> : <AdminOnly />)}
    </div>
  );
}

function AdminOnly() {
  return (
    <div className="fork-card rounded-2xl p-8 text-center">
      <div className="w-12 h-12 rounded-2xl bg-stone-100 border border-stone-200 flex items-center justify-center mx-auto text-stone-400">
        <Shield size={22} />
      </div>
      <div className="font-serif font-bold text-stone-900 mt-3">ADMIN only</div>
      <p className="text-sm text-stone-500 mt-2 max-w-md mx-auto">
        Stall owners edit menu only. Login as <code className="bg-stone-100 px-1.5 py-0.5 rounded text-stone-900 border border-stone-200">admin / admin123</code> for inventory, BOM, audits, analytics & users.
      </p>
    </div>
  );
}

// ============ MENU MANAGEMENT TAB (Hybrid) ============
function MenuManagementTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ADMIN';
  const [stalls, setStalls] = useState<any[]>([]);
  const [selectedStall, setSelectedStall] = useState<string>('');
  const [categories, setCategories] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const [newStall, setNewStall] = useState({ name: '', description: '' });
  const [newCat, setNewCat] = useState({ name: '', displayOrder: '0' });
  const [newItem, setNewItem] = useState({ name: '', price: '', description: '', categoryId: '', isAvailable: '1', imageUrl: '' });
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [error, setError] = useState('');

  const loadStalls = async () => {
    const s = await api.get<any[]>('/api/stalls');
    setStalls(s);
    if (user?.role === 'STALL_OWNER' && user.stall_id) {
      setSelectedStall(user.stall_id);
    } else if (!selectedStall && s[0]) setSelectedStall(s[0].id);
  };
  const [health, setHealth] = useState<any>(null);
  useEffect(() => {
    api.get<any>('/api/health').then(setHealth).catch(() => {});
  }, []);
  const loadDetails = async (stId: string) => {
    if (!stId) return;
    const [cats, items] = await Promise.all([
      api.get<any[]>(`/api/categories?stallId=${stId}`),
      api.get<any[]>(`/api/menu?stallId=${stId}&includeUnavailable=1`),
    ]);
    setCategories(cats);
    setMenu(items);
    if (cats[0] && !newItem.categoryId) setNewItem(prev => ({ ...prev, categoryId: cats[0].id }));
  };
  useEffect(() => {
    loadStalls();
  }, []);
  useEffect(() => {
    if (selectedStall) loadDetails(selectedStall);
  }, [selectedStall]);

  const visibleStalls = isAdmin ? stalls : stalls.filter(s => s.id === user?.stall_id);

  async function createStall() {
    setError('');
    try {
      await api.post('/api/stalls', { name: newStall.name, description: newStall.description });
      setNewStall({ name: '', description: '' });
      await loadStalls();
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function createCat() {
    setError('');
    try {
      await api.post('/api/categories', { stallId: selectedStall, name: newCat.name, displayOrder: Number(newCat.displayOrder) || 0 });
      setNewCat({ name: '', displayOrder: '0' });
      await loadDetails(selectedStall);
    } catch (e: any) {
      setError(e.message);
    }
  }
  async function createItem() {
    setError('');
    try {
      await api.post('/api/menu', {
        stallId: selectedStall,
        categoryId: newItem.categoryId,
        name: newItem.name,
        description: newItem.description,
        price: Number(newItem.price),
        isAvailable: Number(newItem.isAvailable),
        imageUrl: newItem.imageUrl || null,
      });
      setNewItem({ name: '', price: '', description: '', categoryId: categories[0]?.id || '', isAvailable: '1', imageUrl: '' });
      await loadDetails(selectedStall);
    } catch (e: any) {
      setError(e.message);
    }
  }
  function handleNewImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2_000_000) {
      alert('Image too large (max 2MB). Use URL instead.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setNewItem(prev => ({ ...prev, imageUrl: reader.result as string }));
    reader.readAsDataURL(file);
  }
  function handleEditImageFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !editingItem) return;
    if (file.size > 2_000_000) {
      alert('Image too large (max 2MB). Use URL instead.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setEditingItem((prev: any) => ({ ...prev, image_url: reader.result as string }));
    reader.readAsDataURL(file);
  }
  async function toggleAvailability(item: any) {
    try {
      await api.patch(`/api/menu/${item.id}`, { isAvailable: item.is_available ? 0 : 1 });
      await loadDetails(selectedStall);
    } catch (e: any) {
      alert(e.message);
    }
  }
  async function deleteItem(id: string) {
    if (!confirm('Delete menu item? This also removes its recipe BOM.')) return;
    try {
      await api.del(`/api/menu/${id}`);
      await loadDetails(selectedStall);
    } catch (e: any) {
      alert(e.message);
    }
  }
  async function deleteCat(id: string) {
    if (!confirm('Delete category? Only works if empty.')) return;
    try {
      await api.del(`/api/categories/${id}`);
      await loadDetails(selectedStall);
    } catch (e: any) {
      alert(e.message);
    }
  }
  async function saveEdit() {
    if (!editingItem) return;
    try {
      await api.patch(`/api/menu/${editingItem.id}`, {
        name: editingItem.name,
        price: Number(editingItem.price),
        description: editingItem.description,
        categoryId: editingItem.category_id,
        isAvailable: Number(editingItem.is_available),
        imageUrl: editingItem.image_url || null,
      });
      setEditingItem(null);
      await loadDetails(selectedStall);
    } catch (e: any) {
      alert(e.message);
    }
  }

  return (
    <div className="space-y-5">
      {/* Stalls */}
      <div className="fork-card rounded-2xl p-5 sm:p-6">
        <h3 className="font-serif font-bold text-stone-900 flex items-center gap-2 text-[15px]">
          <span className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center">
            <Store size={14} />
          </span>
          Stalls — who can edit what?
        </h3>
        <div className="grid md:grid-cols-2 gap-3 mt-4">
          <div className="bg-stone-50 rounded-2xl p-4 border border-stone-100">
            <div className="font-semibold text-sm text-stone-900 flex items-center gap-1.5">
              <Shield size={14} className="text-stone-900" /> ADMIN
            </div>
            <div className="text-sm text-stone-500 mt-1 leading-relaxed">Create / edit / delete ANY stall, any category, any menu item in any stall.</div>
          </div>
          <div className="bg-white rounded-2xl p-4 border border-stone-200">
            <div className="font-semibold text-sm text-stone-900 flex items-center gap-1.5">
              <Utensils size={14} className="text-fork-green" /> STALL_OWNER
            </div>
            <div className="text-sm text-stone-500 mt-1 leading-relaxed">
              Only stall <b className="text-stone-900 font-semibold">{user?.stall_name || user?.stall_id}</b>. Server returns 403 if they try other stall.
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-4 flex-wrap">
          {visibleStalls.map(s => (
            <button
              key={s.id}
              onClick={() => setSelectedStall(s.id)}
              className={`px-3 py-2 rounded-full text-sm font-medium border transition flex items-center gap-2 ${
                selectedStall === s.id ? 'bg-stone-900 text-white border-stone-900 shadow-sm' : 'bg-white text-stone-700 border-stone-200 hover:bg-stone-50'
              }`}
            >
              {s.logo_url ? <img src={s.logo_url} alt={s.name} className="w-5 h-5 rounded-full object-cover" /> : null}
              {s.name} <span className={`text-xs ml-1 ${selectedStall === s.id ? 'text-white/60' : 'text-stone-400'}`}>({s.id})</span>
            </button>
          ))}
        </div>

        {isAdmin && (
          <div className="mt-4 flex flex-col sm:flex-row gap-2">
            <input
              value={newStall.name}
              onChange={e => setNewStall({ ...newStall, name: e.target.value })}
              placeholder="New stall name"
              className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
            />
            <input
              value={newStall.description}
              onChange={e => setNewStall({ ...newStall, description: e.target.value })}
              placeholder="Description"
              className="flex-1 bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
            />
            <button
              onClick={createStall}
              className="bg-stone-900 text-white px-6 py-2.5 rounded-full text-sm font-semibold flex items-center justify-center gap-1.5 hover:bg-stone-800 transition shrink-0"
            >
              <Plus size={14} /> Add Stall
            </button>
          </div>
        )}
        {error && <div className="mt-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl px-4 py-3">{error}</div>}
      </div>

      {/* QR Generator — Phase 3 */}
      <div className="fork-card rounded-2xl p-5 sm:p-6">
        <h4 className="font-serif font-bold text-stone-900 flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-fork-green text-white flex items-center justify-center">
            <QrCode size={14} />
          </span>
          Stall QR Codes — Customers scan to open Kiosk
        </h4>
        <p className="text-xs text-stone-500 mt-2 leading-relaxed">
          Offline QR: encodes <code className="bg-stone-100 border border-stone-200 px-1.5 py-0.5 rounded text-stone-900">http://&lt;hotspot-ip&gt;:3000/kiosk?stall=STALL_ID</code>. Print and post at stall front. Kiosk is the <b className="font-semibold text-stone-700">only public</b> page.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-5">
          {visibleStalls.map((s: any) => {
            const ip = health?.ips?.[0] || (typeof window !== 'undefined' ? window.location.hostname : 'localhost');
            const port = health?.port || (typeof window !== 'undefined' ? window.location.port || '3000' : '3000');
            const host = ip && ip !== 'localhost' ? `${ip}:${port}` : typeof window !== 'undefined' ? window.location.host : `localhost:${port}`;
            const url = `http://${host}/kiosk?stall=${s.id}`;
            const tableUrl = `http://${host}/kiosk?stall=${s.id}&table=1`;
            return (
              <div key={s.id} className="bg-white border border-stone-200 rounded-2xl p-4 flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="bg-white p-2 border border-stone-200 rounded-xl shrink-0 mx-auto sm:mx-0 shadow-sm">
                  <QRCodeSVG value={url} size={96} />
                </div>
                <div className="flex-1 min-w-0 w-full">
                  <div className="font-serif font-bold text-sm text-stone-900 flex items-center gap-2">{s.logo_url ? <img src={s.logo_url} alt={s.name} className="w-6 h-6 rounded-full object-cover border border-stone-200" /> : null}{s.name}</div>
                  <div className="text-xs text-stone-500 break-all font-mono mt-1">{url}</div>
                  <div className="text-xs text-stone-400 mt-1.5">
                    Table example: <span className="font-mono bg-stone-50 border border-stone-100 px-1.5 py-0.5 rounded break-all text-stone-600">{tableUrl}</span>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        alert('Copied ' + url);
                      }}
                      className="text-xs font-medium border border-stone-200 bg-white px-3.5 py-2 rounded-full hover:bg-stone-50 transition text-stone-700"
                    >
                      Copy URL
                    </button>
                    <button onClick={() => window.print()} className="text-xs font-semibold bg-stone-900 text-white px-4 py-2 rounded-full hover:bg-stone-800 transition">
                      Print QR
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {visibleStalls.length === 0 && <div className="text-sm text-stone-400 py-6 text-center">No stalls — add one above (ADMIN)</div>}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Categories */}
        <div className="fork-card rounded-2xl p-5 sm:p-6 flex flex-col">
          <h4 className="font-serif font-bold text-stone-900">Categories — {stalls.find(s => s.id === selectedStall)?.name || ''}</h4>
          <div className="space-y-2 mt-4 max-h-72 overflow-auto pr-1">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between bg-white border border-stone-200 rounded-xl px-4 py-3 hover:bg-stone-50/50 transition">
                <div className="min-w-0">
                  <div className="font-medium text-sm text-stone-900 truncate">{cat.name}</div>
                  <div className="text-xs text-stone-400">order {cat.display_order} · {cat.id}</div>
                </div>
                <button onClick={() => deleteCat(cat.id)} className="ml-3 w-8 h-8 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition shrink-0">
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
            {categories.length === 0 && <div className="text-sm text-stone-400 py-8 text-center border border-dashed border-stone-200 rounded-2xl bg-stone-50/50">No categories — create one below</div>}
          </div>
          <div className="flex gap-2 mt-4">
            <input
              value={newCat.name}
              onChange={e => setNewCat({ ...newCat, name: e.target.value })}
              placeholder="Category name"
              className="flex-1 bg-white border border-stone-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
            />
            <input
              value={newCat.displayOrder}
              onChange={e => setNewCat({ ...newCat, displayOrder: e.target.value })}
              placeholder="Order"
              type="number"
              className="w-20 bg-white border border-stone-200 rounded-full px-3 py-2.5 text-sm text-center focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
            />
            <button onClick={createCat} className="bg-stone-900 text-white px-6 rounded-full text-sm font-semibold hover:bg-stone-800 transition">
              Add
            </button>
          </div>
        </div>

        {/* Add Menu Item */}
        <div className="fork-card rounded-2xl p-5 sm:p-6">
          <h4 className="font-serif font-bold text-stone-900">Add Menu Item — {stalls.find(s => s.id === selectedStall)?.name || ''}</h4>
          <div className="grid gap-3 mt-4">
            <input
              value={newItem.name}
              onChange={e => setNewItem({ ...newItem, name: e.target.value })}
              placeholder="Item name (e.g. Spicy Burger)"
              className="bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                value={newItem.price}
                onChange={e => setNewItem({ ...newItem, price: e.target.value })}
                placeholder="Price ₱"
                type="number"
                className="bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
              />
              <select
                value={newItem.categoryId}
                onChange={e => setNewItem({ ...newItem, categoryId: e.target.value })}
                className="bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 text-stone-700"
              >
                <option value="">Category</option>
                {categories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <input
              value={newItem.description}
              onChange={e => setNewItem({ ...newItem, description: e.target.value })}
              placeholder="Description"
              className="bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
            />
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <LinkIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
                <input
                  value={newItem.imageUrl}
                  onChange={e => setNewItem({ ...newItem, imageUrl: e.target.value })}
                  placeholder="Image URL (https://...)"
                  className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
                />
              </div>
              <label className="border border-stone-200 bg-white hover:bg-stone-50 rounded-xl px-4 py-2.5 text-sm font-medium flex items-center gap-2 cursor-pointer text-stone-700 transition">
                <Upload size={14} /> Upload
                <input type="file" accept="image/*" className="hidden" onChange={handleNewImageFile} />
              </label>
            </div>
            {newItem.imageUrl ? (
              <div className="relative w-full h-32 rounded-xl overflow-hidden border border-stone-200 bg-stone-50">
                <img
                  src={newItem.imageUrl}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={e => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
                <button onClick={() => setNewItem({ ...newItem, imageUrl: '' })} className="absolute top-2 right-2 bg-stone-900/80 hover:bg-stone-900 text-white text-xs px-2.5 py-1 rounded-full backdrop-blur transition">
                  Remove
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-stone-500 bg-stone-50 border border-dashed border-stone-200 rounded-xl px-3.5 py-3">
                <ImageIcon size={14} className="text-stone-400 shrink-0" /> No image — Kiosk will show a real food photo fallback. Paste URL or Upload (max 2MB, stored as data URL for offline).
              </div>
            )}
            <div className="flex gap-2">
              <select
                value={newItem.isAvailable}
                onChange={e => setNewItem({ ...newItem, isAvailable: e.target.value })}
                className="bg-white border border-stone-200 rounded-full px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 text-stone-700"
              >
                <option value="1">Available</option>
                <option value="0">Hidden (Kiosk off)</option>
              </select>
              <button onClick={createItem} className="flex-1 bg-stone-900 text-white font-semibold py-2.5 rounded-full flex items-center justify-center gap-2 hover:bg-stone-800 transition">
                <Plus size={16} /> Add Item
              </button>
            </div>
          </div>
          <p className="text-xs text-stone-400 mt-3 leading-relaxed">Price non-negative. Stall ownership enforced server-side: STALL_OWNER gets 403 if stallId mismatch.</p>
        </div>
      </div>

      {/* Menu Items table */}
      <div className="fork-card rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-stone-100 flex items-center justify-between gap-3">
          <h4 className="font-serif font-bold text-stone-900">Menu Items — {menu.length} items</h4>
          <span className="text-xs font-medium px-3 py-1 rounded-full bg-stone-50 border border-stone-200 text-stone-600 whitespace-nowrap">
            {isAdmin ? 'ADMIN sees all in stall' : `Filtered to ${user?.stall_name}`}
          </span>
        </div>
        <div className="overflow-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr className="text-left text-xs font-semibold tracking-wide text-stone-500 uppercase">
                <th className="p-3.5 pl-5">Image</th>
                <th className="py-3.5">Item</th>
                <th className="py-3.5">Category</th>
                <th className="py-3.5">Price</th>
                <th className="py-3.5">Avail</th>
                <th className="py-3.5 pr-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {menu.map((it: any) => (
                <tr key={it.id} className="hover:bg-stone-50/50 transition">
                  <td className="p-2 pl-5">
                    <div className="w-14 h-14 rounded-xl overflow-hidden bg-stone-100 border border-stone-200 shrink-0">
                      {it.image_url ? (
                        <img
                          src={it.image_url}
                          alt={it.name}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={e => {
                            (e.currentTarget as HTMLImageElement).src = 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=200&auto=format&fit=crop&q=60';
                          }}
                        />
                      ) : (
                        <div className="w-full h-full bg-stone-50 flex items-center justify-center text-stone-300">
                          <ImageIcon size={20} />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="py-3 pr-3">
                    <div className="font-medium text-stone-900">{it.name}</div>
                    <div className="text-xs text-stone-500 line-clamp-1">{it.description || ''}</div>
                    <div className="text-[11px] font-mono text-stone-400">{it.id}</div>
                  </td>
                  <td className="py-3 text-xs text-stone-600">{it.category_name}</td>
                  <td className="py-3 font-bold text-stone-900">₱{it.price}</td>
                  <td className="py-3">
                    <button
                      onClick={() => toggleAvailability(it)}
                      className={`text-xs font-semibold px-2.5 py-1 rounded-full border transition ${
                        it.is_available ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-100 text-stone-500 border-stone-200'
                      }`}
                    >
                      {it.is_available ? 'Available' : 'Hidden'}
                    </button>
                  </td>
                  <td className="py-3 pr-5">
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => setEditingItem({ ...it })}
                        className="w-8 h-8 rounded-full border border-stone-200 bg-white flex items-center justify-center hover:bg-stone-50 text-stone-600 transition"
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        onClick={() => deleteItem(it.id)}
                        className="w-8 h-8 rounded-full border border-stone-200 bg-white flex items-center justify-center hover:bg-red-50 hover:text-red-600 hover:border-red-200 text-stone-400 transition"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {menu.length === 0 && <div className="p-10 text-center text-sm text-stone-400">No menu items for this stall — add one above.</div>}
      </div>

      {editingItem && (
        <div className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[24px] p-6 w-full max-w-lg space-y-3 max-h-[90vh] overflow-auto border border-stone-200 shadow-forkHover">
            <h3 className="font-serif font-bold text-lg text-stone-900">Edit — {editingItem.id}</h3>
            <input
              value={editingItem.name}
              onChange={e => setEditingItem({ ...editingItem, name: e.target.value })}
              placeholder="Name"
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
            />
            <input
              value={editingItem.price}
              onChange={e => setEditingItem({ ...editingItem, price: e.target.value })}
              placeholder="Price"
              type="number"
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
            />
            <input
              value={editingItem.description || ''}
              onChange={e => setEditingItem({ ...editingItem, description: e.target.value })}
              placeholder="Description"
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
            />
            <select
              value={editingItem.category_id}
              onChange={e => setEditingItem({ ...editingItem, category_id: e.target.value })}
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 text-stone-700"
            >
              {categories.map(c => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <div className="relative">
              <LinkIcon size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                value={editingItem.image_url || ''}
                onChange={e => setEditingItem({ ...editingItem, image_url: e.target.value })}
                placeholder="Image URL (https://...)"
                className="w-full bg-white border border-stone-200 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
              />
            </div>
            <div className="flex gap-2 items-center">
              <label className="flex-1 border border-stone-200 bg-white hover:bg-stone-50 rounded-xl px-4 py-2.5 text-sm font-medium flex items-center justify-center gap-2 cursor-pointer text-stone-700 transition">
                <Upload size={14} /> {editingItem.image_url ? 'Change Upload' : 'Upload Image'}
                <input type="file" accept="image/*" className="hidden" onChange={handleEditImageFile} />
              </label>
              {editingItem.image_url && (
                <button onClick={() => setEditingItem({ ...editingItem, image_url: '' })} className="border border-stone-200 bg-white px-4 py-2.5 rounded-xl text-sm text-stone-600 hover:bg-stone-50 transition">
                  Clear
                </button>
              )}
            </div>
            {editingItem.image_url ? (
              <div className="w-full h-40 rounded-xl overflow-hidden border border-stone-200 bg-stone-50">
                <img
                  src={editingItem.image_url}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  onError={e => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            ) : (
              <div className="w-full h-24 rounded-xl border border-dashed border-stone-200 bg-stone-50 flex items-center justify-center text-xs text-stone-400 gap-2">
                <ImageIcon size={16} className="text-stone-300" /> No image — will show fallback photo on Kiosk
              </div>
            )}
            <select
              value={String(editingItem.is_available)}
              onChange={e => setEditingItem({ ...editingItem, is_available: Number(e.target.value) })}
              className="w-full bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 text-stone-700"
            >
              <option value="1">Available</option>
              <option value="0">Hidden</option>
            </select>
            <div className="flex gap-2 pt-2">
              <button onClick={() => setEditingItem(null)} className="flex-1 border border-stone-200 bg-white py-3 rounded-full font-medium text-stone-700 hover:bg-stone-50 transition">
                Cancel
              </button>
              <button onClick={saveEdit} className="flex-1 bg-stone-900 text-white py-3 rounded-full font-semibold hover:bg-stone-800 transition">
                Save
              </button>
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
  const [showIn, setShowIn] = useState<string | null>(null);
  const [qty, setQty] = useState('');
  const load = async () => {
    setIngs(await api.get<any[]>('/api/inventory'));
    setLogs(await api.get<any[]>('/api/stock-logs?limit=50'));
  };
  useEffect(() => {
    load();
  }, []);
  async function stockIn(id: string) {
    await api.post(`/api/inventory/${id}/stock-in`, { quantity: Number(qty), reason: 'Admin stock-in' });
    setShowIn(null);
    setQty('');
    load();
  }
  async function stockOut(id: string) {
    const q = Number(prompt('Wastage quantity?'));
    if (!q) return;
    await api.post(`/api/inventory/${id}/stock-out`, { quantity: q, reason: 'Wastage' });
    load();
  }
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {ings.map(ing => (
          <div
            key={ing.id}
            className={`fork-card rounded-2xl p-5 transition ${ing.is_low ? 'border-amber-200 bg-amber-50/20' : 'border-stone-200'}`}
          >
            <div className="flex justify-between items-start gap-3">
              <div className="min-w-0">
                <div className="font-serif font-bold text-stone-900 leading-tight">{ing.name}</div>
                <div className="text-xs text-stone-500 mt-1">
                  {ing.id} · {ing.unit} · ₱{ing.cost_per_unit}/unit
                </div>
              </div>
              {ing.is_low && (
                <span className="shrink-0 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1 shadow-sm">
                  <AlertTriangle size={12} /> LOW
                </span>
              )}
            </div>
            <div className="mt-4 flex items-baseline gap-2">
              <span className="text-2xl font-serif font-bold text-stone-900">{ing.current_stock}</span>
              <span className="text-stone-500 text-sm">{ing.unit}</span>
              <span className="ml-auto text-xs text-stone-400 bg-white border border-stone-200 px-2 py-1 rounded-full">min {ing.min_threshold}</span>
            </div>
            <div className="w-full bg-stone-100 rounded-full h-2 mt-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${ing.is_low ? 'bg-amber-500' : 'bg-stone-900'}`}
                style={{ width: `${Math.min(100, (ing.current_stock / Math.max(ing.min_threshold * 2, 1)) * 100)}%` }}
              />
            </div>
            <div className="flex gap-2 mt-4">
              {showIn === ing.id ? (
                <div className="flex gap-2 flex-1">
                  <input
                    value={qty}
                    onChange={e => setQty(e.target.value)}
                    placeholder="Qty"
                    type="number"
                    className="flex-1 bg-white border border-stone-200 rounded-full px-4 py-2 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10"
                  />
                  <button onClick={() => stockIn(ing.id)} className="bg-stone-900 text-white px-4 rounded-full text-sm font-bold hover:bg-stone-800 transition">
                    Add
                  </button>
                  <button onClick={() => setShowIn(null)} className="border border-stone-200 bg-white px-3.5 rounded-full text-sm hover:bg-stone-50 transition text-stone-600">
                    Cancel
                  </button>
                </div>
              ) : (
                <button onClick={() => setShowIn(ing.id)} className="flex-1 bg-stone-900 text-white text-sm font-semibold py-2.5 rounded-full flex items-center justify-center gap-2 hover:bg-stone-800 transition">
                  <Plus size={14} /> Stock In
                </button>
              )}
              <button onClick={() => stockOut(ing.id)} className="border border-stone-200 bg-white text-sm px-4 py-2.5 rounded-full hover:bg-stone-50 transition text-stone-700 font-medium">
                Wastage
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="fork-card rounded-2xl overflow-hidden">
        <div className="p-5 font-serif font-bold text-stone-900 border-b border-stone-100">Recent Stock Logs</div>
        <div className="divide-y divide-stone-100 max-h-80 overflow-auto">
          {logs.map(l => (
            <div key={l.id} className="px-5 py-3 flex items-center gap-3 text-sm">
              <span
                className={`text-xs font-bold px-2.5 py-1 rounded-full border whitespace-nowrap ${
                  l.change_type === 'STOCK_IN'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : l.change_type === 'BOM_DEDUCTION'
                      ? 'bg-sky-50 text-sky-700 border-sky-200'
                      : l.change_type === 'WASTAGE'
                        ? 'bg-red-50 text-red-700 border-red-200'
                        : 'bg-stone-50 text-stone-600 border-stone-200'
                }`}
              >
                {l.change_type}
              </span>
              <span className="font-medium text-stone-900 truncate">{l.ingredient_name}</span>
              <span className={`font-semibold ${l.quantity_delta > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {l.quantity_delta > 0 ? '+' : ''}
                {l.quantity_delta}
              </span>
              <span className="text-stone-400 text-xs ml-auto whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</span>
            </div>
          ))}
          {logs.length === 0 && <div className="p-8 text-center text-sm text-stone-400">No logs yet</div>}
        </div>
      </div>
    </div>
  );
}

function BomTab() {
  const [boms, setBoms] = useState<any[]>([]);
  const [menu, setMenu] = useState<any[]>([]);
  const [ings, setIngs] = useState<any[]>([]);
  const [form, setForm] = useState({ menuItemId: '', ingredientId: '', quantityRequired: '' });
  const load = async () => {
    setBoms(await api.get<any[]>('/api/recipe-bom'));
    setMenu(await api.get<any[]>('/api/menu?includeUnavailable=1'));
    setIngs(await api.get<any[]>('/api/ingredients'));
  };
  useEffect(() => {
    load();
  }, []);
  async function add() {
    await api.post('/api/recipe-bom', { menuItemId: form.menuItemId, ingredientId: form.ingredientId, quantityRequired: Number(form.quantityRequired) });
    setForm({ menuItemId: '', ingredientId: '', quantityRequired: '' });
    load();
  }
  async function del(id: string) {
    if (!confirm('Delete BOM?')) return;
    await api.del(`/api/recipe-bom/${id}`);
    load();
  }
  return (
    <div className="space-y-5">
      <div className="fork-card rounded-2xl p-5 sm:p-6">
        <h3 className="font-serif font-bold text-stone-900">Add Recipe BOM link</h3>
        <div className="grid md:grid-cols-4 gap-3 mt-4">
          <select
            value={form.menuItemId}
            onChange={e => setForm({ ...form, menuItemId: e.target.value })}
            className="bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 text-stone-700"
          >
            <option value="">Menu item</option>
            {menu.map((m: any) => (
              <option key={m.id} value={m.id}>
                {m.name} ({m.stall_id})
              </option>
            ))}
          </select>
          <select
            value={form.ingredientId}
            onChange={e => setForm({ ...form, ingredientId: e.target.value })}
            className="bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 text-stone-700"
          >
            <option value="">Ingredient</option>
            {ings.map((i: any) => (
              <option key={i.id} value={i.id}>
                {i.name} ({i.unit})
              </option>
            ))}
          </select>
          <input
            value={form.quantityRequired}
            onChange={e => setForm({ ...form, quantityRequired: e.target.value })}
            placeholder="Qty per 1 serving (e.g. 150)"
            type="number"
            className="bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
          />
          <button onClick={add} className="bg-stone-900 text-white rounded-full font-semibold hover:bg-stone-800 transition py-2.5">
            Add BOM
          </button>
        </div>
        <p className="text-xs text-stone-400 mt-3 leading-relaxed">Example: Classic Burger → Beef Patty ×1 pcs. Atomic deduction multiplies by order quantity. ADMIN can edit any; STALL_OWNER filtered server-side to own stall.</p>
      </div>

      <div className="fork-card rounded-2xl overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr className="text-left text-xs font-semibold tracking-wide text-stone-500 uppercase">
                <th className="p-3.5 pl-5">Menu Item</th>
                <th className="py-3.5">Ingredient</th>
                <th className="py-3.5">Qty / serving</th>
                <th className="py-3.5 pr-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {boms.map((b: any) => (
                <tr key={b.id} className="hover:bg-stone-50/50">
                  <td className="p-3.5 pl-5 font-medium text-stone-900">{b.menu_item_name}</td>
                  <td className="py-3.5 text-stone-600">{b.ingredient_name}</td>
                  <td className="py-3.5 font-semibold text-stone-900">{b.quantity_required}</td>
                  <td className="py-3.5 pr-5">
                    <button onClick={() => del(b.id)} className="w-8 h-8 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {boms.length === 0 && <div className="p-10 text-center text-sm text-stone-400">No BOM links yet — create one above.</div>}
      </div>
    </div>
  );
}

function AuditTab() {
  const [ings, setIngs] = useState<any[]>([]);
  const [audits, setAudits] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const load = async () => {
    setIngs(await api.get<any[]>('/api/inventory'));
    try {
      setAudits(await api.get<any[]>(`/api/audits?date=${date}`));
    } catch {
      setAudits([]);
    }
  };
  useEffect(() => {
    load();
  }, [date]);
  async function submit() {
    const entries = Object.entries(counts)
      .filter(([_, v]) => v !== '')
      .map(([id, v]) => ({ ingredientId: id, physicalActualStock: Number(v) }));
    if (entries.length === 0) return alert('Enter at least one count');
    await api.post('/api/audits/bulk', { auditDate: date, entries });
    setCounts({});
    load();
  }
  return (
    <div className="space-y-5">
      <div className="fork-card rounded-2xl p-5 sm:p-6 border-stone-200">
        <h3 className="font-serif font-bold text-stone-900 flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center">
            <ClipboardCheck size={14} />
          </span>
          End-of-Day Variance Audit — ADMIN only
        </h3>
        <p className="text-sm text-stone-500 mt-2">System computes variance = physical − expected. Positive = overage, negative = shrinkage. Adjustment auto-applied.</p>
        <div className="flex gap-3 mt-4 flex-wrap">
          <input
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            className="bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 text-stone-700"
          />
          <button onClick={submit} className="bg-stone-900 text-white px-6 py-2.5 rounded-full font-semibold hover:bg-stone-800 transition">
            Submit Audit
          </button>
        </div>
      </div>

      <div className="fork-card rounded-2xl overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr className="text-left text-xs font-semibold tracking-wide text-stone-500 uppercase">
                <th className="p-3.5 pl-5">Ingredient</th>
                <th className="py-3.5">System Expected</th>
                <th className="py-3.5">Physical Count</th>
                <th className="py-3.5 pr-5">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {ings.map((ing: any) => (
                <tr key={ing.id} className="hover:bg-stone-50/50">
                  <td className="p-3.5 pl-5 font-medium text-stone-900">{ing.name}</td>
                  <td className="p-3.5 text-stone-600">{ing.current_stock}</td>
                  <td className="p-3.5">
                    <input
                      value={counts[ing.id] || ''}
                      onChange={e => setCounts({ ...counts, [ing.id]: e.target.value })}
                      placeholder="actual"
                      type="number"
                      className="bg-white border border-stone-200 rounded-xl px-3 py-2 w-28 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
                    />
                  </td>
                  <td className="py-3.5 pr-5 text-stone-500 text-xs">{ing.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="fork-card rounded-2xl overflow-hidden">
        <div className="p-5 font-serif font-bold text-stone-900 border-b border-stone-100">Audits for {date}</div>
        {audits.length === 0 ? (
          <div className="p-10 text-center text-stone-400 text-sm">No audits yet</div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead className="bg-stone-50 border-b border-stone-100">
                <tr className="text-left text-xs font-semibold tracking-wide text-stone-500 uppercase">
                  <th className="p-3.5 pl-5">Ingredient</th>
                  <th className="py-3.5">Expected</th>
                  <th className="py-3.5">Actual</th>
                  <th className="py-3.5 pr-5">Variance</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {audits.map((a: any) => (
                  <tr key={a.id} className="hover:bg-stone-50/50">
                    <td className="p-3.5 pl-5 text-stone-900 font-medium">{a.ingredient_name}</td>
                    <td className="py-3.5 text-stone-600">{a.system_expected_stock}</td>
                    <td className="py-3.5 text-stone-600">{a.physical_actual_stock}</td>
                    <td className={`py-3.5 pr-5 font-bold ${a.variance === 0 ? 'text-emerald-600' : a.variance < 0 ? 'text-red-600' : 'text-amber-600'}`}>
                      {a.variance > 0 ? '+' : ''}
                      {a.variance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function AnalyticsTab() {
  const [data, setData] = useState<any>(null);
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const load = async () => {
    try {
      setData(await api.get<any>(`/api/reports/summary?from=${date}&to=${date}`));
    } catch (e: any) {
      setData(null);
    }
  };
  useEffect(() => {
    load();
  }, [date]);
  const [dailyData, setDailyData] = useState<any>(null);
  useEffect(() => {
    api.get<any>(`/api/orders/analytics/daily?date=${date}`).then(setDailyData).catch(() => {});
  }, [date]);
  const summary = data?.daily?.[0] || dailyData?.revenue || { revenue: 0, orderCount: 0, orders: 0 };
  const topItems = data?.lowStocks ? [] : dailyData?.topItems;
  const hourly = dailyData?.hourly;
  return (
    <div className="space-y-5">
      <div className="flex gap-3 items-center flex-wrap">
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 text-stone-700"
        />
        <button
          onClick={() => {
            load();
            api.get<any>(`/api/orders/analytics/daily?date=${date}`).then(setDailyData).catch(() => {});
          }}
          className="border border-stone-200 bg-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-stone-50 transition text-stone-700"
        >
          Refresh
        </button>
        <span className="ml-auto hidden sm:inline text-xs text-stone-400">CampusBITE analytics · offline-first</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="fork-card rounded-2xl p-5">
          <div className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Revenue ({date})</div>
          <div className="font-serif text-2xl font-bold text-stone-900 mt-2">₱{Number(summary.revenue || summary.orders || 0).toFixed?.(2) || '0.00'}</div>
          <div className="text-xs text-stone-500 mt-1">{summary.orders || summary.orderCount || 0} orders · <span className="text-fork-green font-medium">live</span></div>
        </div>
        <div className="fork-card rounded-2xl p-5">
          <div className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Top Item</div>
          <div className="font-serif text-lg font-bold text-stone-900 mt-2 truncate">{topItems?.[0]?.name || '—'}</div>
          <div className="text-xs text-stone-500 mt-1">{topItems?.[0]?.qty || 0} sold</div>
        </div>
        <div className="fork-card rounded-2xl p-5">
          <div className="text-xs font-semibold tracking-wide text-stone-500 uppercase">Hourly Peak</div>
          <div className="font-serif text-lg font-bold text-stone-900 mt-2">{hourly?.length ? `${hourly.reduce((m: any, c: any) => (c.orders > m.orders ? c : m), hourly[0]).hour}:00` : '—'}</div>
          <div className="text-xs text-stone-500 mt-1">{hourly?.length || 0} active hours</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="fork-card rounded-2xl p-5 sm:p-6">
          <h4 className="font-serif font-bold text-stone-900">Top 5 Items</h4>
          <div className="mt-4 space-y-2">
            {(topItems || []).map((t: any) => (
              <div key={t.name} className="flex justify-between text-sm bg-white border border-stone-200 rounded-xl px-4 py-3">
                <span className="font-medium text-stone-900">{t.name}</span>
                <span className="font-bold text-stone-900">
                  {t.qty} × ₱{t.revenue}
                </span>
              </div>
            ))}
            {(!topItems || topItems.length === 0) && <div className="text-sm text-stone-400 border border-dashed border-stone-200 rounded-xl p-6 text-center bg-stone-50/50">No sales yet</div>}
          </div>
        </div>
        <div className="fork-card rounded-2xl p-5 sm:p-6">
          <h4 className="font-serif font-bold text-stone-900">Hourly Breakdown</h4>
          <div className="mt-4 space-y-2.5 max-h-64 overflow-auto pr-1">
            {(hourly || []).map((h: any) => (
              <div key={h.hour} className="flex items-center gap-3 text-sm">
                <span className="w-12 font-mono text-stone-600 text-xs">{h.hour}:00</span>
                <div className="flex-1 bg-stone-100 rounded-full h-2 overflow-hidden">
                  <div className="bg-stone-900 h-full rounded-full" style={{ width: `${Math.min(100, (h.orders / 10) * 100)}%` }} />
                </div>
                <span className="w-20 text-right text-xs text-stone-600">{h.orders} orders</span>
              </div>
            ))}
            {(!hourly || hourly.length === 0) && <div className="text-sm text-stone-400 border border-dashed border-stone-200 rounded-xl p-6 text-center bg-stone-50/50">No data</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [stalls, setStalls] = useState<any[]>([]);
  const [form, setForm] = useState({ username: '', pin: '', role: 'STALL_OWNER' as 'ADMIN' | 'STALL_OWNER', stallId: '', displayName: '' });
  const load = async () => {
    setUsers(await api.get<any[]>('/api/users'));
    setStalls(await api.get<any[]>('/api/stalls'));
  };
  useEffect(() => {
    load();
  }, []);
  async function create() {
    await api.post('/api/users', { username: form.username, pin: form.pin, role: form.role, stallId: form.role === 'STALL_OWNER' ? form.stallId : null, displayName: form.displayName || form.username });
    setForm({ username: '', pin: '', role: 'STALL_OWNER', stallId: '', displayName: '' });
    load();
  }
  async function remove(id: string) {
    if (!confirm('Delete user?')) return;
    await api.del(`/api/users/${id}`);
    load();
  }
  async function toggleActive(u: any) {
    await api.patch(`/api/users/${u.id}`, { is_active: u.is_active ? 0 : 1 });
    load();
  }
  return (
    <div className="space-y-5">
      <div className="fork-card rounded-2xl p-5 sm:p-6">
        <h3 className="font-serif font-bold text-stone-900 flex items-center gap-2">
          <span className="w-8 h-8 rounded-xl bg-stone-900 text-white flex items-center justify-center">
            <Users size={14} />
          </span>
          Create User — ADMIN only
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 mt-4">
          <input
            value={form.username}
            onChange={e => setForm({ ...form, username: e.target.value })}
            placeholder="username"
            className="bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
          />
          <input
            value={form.pin}
            onChange={e => setForm({ ...form, pin: e.target.value })}
            placeholder="PIN (e.g. potato123)"
            className="bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
          />
          <input
            value={form.displayName}
            onChange={e => setForm({ ...form, displayName: e.target.value })}
            placeholder="Display name"
            className="bg-white border border-stone-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 placeholder:text-stone-400"
          />
          <select
            value={form.role}
            onChange={e => setForm({ ...form, role: e.target.value as any })}
            className="bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 text-stone-700"
          >
            <option value="STALL_OWNER">STALL_OWNER</option>
            <option value="ADMIN">ADMIN</option>
          </select>
          <select
            value={form.stallId}
            onChange={e => setForm({ ...form, stallId: e.target.value })}
            className="bg-white border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-stone-900 focus:ring-2 focus:ring-stone-900/10 text-stone-700 disabled:bg-stone-50 disabled:text-stone-400"
            disabled={form.role === 'ADMIN'}
          >
            <option value="">Stall (if owner)</option>
            {stalls.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
        <button onClick={create} className="mt-4 bg-stone-900 text-white px-6 py-2.5 rounded-full font-semibold hover:bg-stone-800 transition">
          Create User
        </button>
      </div>

      <div className="fork-card rounded-2xl overflow-hidden">
        <div className="overflow-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-stone-50 border-b border-stone-100">
              <tr className="text-left text-xs font-semibold tracking-wide text-stone-500 uppercase">
                <th className="p-3.5 pl-5">User</th>
                <th className="py-3.5">Role</th>
                <th className="py-3.5">Stall</th>
                <th className="py-3.5">Active</th>
                <th className="py-3.5 pr-5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {users.map((u: any) => (
                <tr key={u.id} className="hover:bg-stone-50/50">
                  <td className="p-3.5 pl-5">
                    <div className="font-medium text-stone-900">{u.username}</div>
                    <div className="text-xs text-stone-500">
                      {u.display_name} · {u.id}
                    </div>
                  </td>
                  <td className="py-3.5">
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${u.role === 'ADMIN' ? 'bg-stone-900 text-white border-stone-900' : 'bg-white text-stone-700 border-stone-200'}`}>{u.role}</span>
                  </td>
                  <td className="py-3.5 text-xs text-stone-600">{u.stall_name || u.stall_id || '-'}</td>
                  <td className="py-3.5">
                    <button
                      onClick={() => toggleActive(u)}
                      className={`text-xs font-semibold px-3 py-1 rounded-full border transition ${u.is_active ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-stone-100 text-stone-500 border-stone-200'}`}
                    >
                      {u.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </td>
                  <td className="py-3.5 pr-5">
                    <button onClick={() => remove(u.id)} className="w-8 h-8 rounded-full border border-stone-200 bg-white flex items-center justify-center text-stone-400 hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {users.length === 0 && <div className="p-10 text-center text-sm text-stone-400">No users yet</div>}
      </div>
    </div>
  );
}
