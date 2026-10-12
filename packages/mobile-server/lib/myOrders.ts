// Per-device order tracking (no customer accounts).
// Stores only the unguessable order UUID plus display hints; the server is the
// source of truth via public GET /api/orders/:id. Never track by pickup code.
import AsyncStorage from '@react-native-async-storage/async-storage';

export const MY_ORDERS_KEY = 'campusbite_my_orders';
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // forget orders after 12h
const MAX_ORDERS = 20;
export const DONE_STATUSES = ['COMPLETED', 'CANCELLED'];

export type SavedOrder = {
  id: string;
  pickup_code: string;
  stall_id: string;
  stall_name?: string | null;
  total_amount?: number;
  status?: string;
  created_at: string;
};

function fresh(o: SavedOrder) {
  const t = Date.parse(o.created_at);
  return Number.isNaN(t) || Date.now() - t < MAX_AGE_MS;
}

export async function getMyOrders(): Promise<SavedOrder[]> {
  try {
    const raw = await AsyncStorage.getItem(MY_ORDERS_KEY);
    const list: SavedOrder[] = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter(o => o?.id && fresh(o)) : [];
  } catch {
    return [];
  }
}

async function write(list: SavedOrder[]) {
  try { await AsyncStorage.setItem(MY_ORDERS_KEY, JSON.stringify(list.slice(0, MAX_ORDERS))); } catch {}
}

/** Add (or refresh) an order on this device. Newest first. */
export async function saveMyOrder(order: any, stallName?: string | null) {
  if (!order?.id) return;
  const list = await getMyOrders();
  const entry: SavedOrder = {
    id: order.id,
    pickup_code: order.pickup_code,
    stall_id: order.stall_id,
    stall_name: stallName ?? order.stall_name ?? null,
    total_amount: order.total_amount,
    status: order.status,
    created_at: order.created_at || new Date().toISOString(),
  };
  await write([entry, ...list.filter(o => o.id !== order.id)]);
}

/** Merge latest server fields (status etc.) into saved entries. */
export async function updateMyOrders(updates: Partial<SavedOrder>[]) {
  const list = await getMyOrders();
  const byId = new Map(updates.filter(u => u.id).map(u => [u.id!, u]));
  await write(list.map(o => (byId.has(o.id) ? { ...o, ...byId.get(o.id) } : o)));
}

export async function removeMyOrder(id: string) {
  const list = await getMyOrders();
  await write(list.filter(o => o.id !== id));
}

export async function clearFinishedOrders() {
  const list = await getMyOrders();
  await write(list.filter(o => !DONE_STATUSES.includes(o.status || '')));
}

export function activeCount(list: SavedOrder[]) {
  return list.filter(o => !DONE_STATUSES.includes(o.status || '')).length;
}
