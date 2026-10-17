import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Order } from '../context/OrderContext';
import { CartItem } from '../context/CartContext';
import { MENU_DATA } from '../data/menu';

export interface RecentDishItem {
  id: string;
  name: string;
  quantity: number;
  orderedAt: string;
}

export interface CustomerProfile {
  phone: string;
  uid?: string;
  firstSeenAt: string;
  lastOrderAt: string;
  totalOrders: number;
  totalSpent: number;
  favoriteDishIds: string[];
  recentOrderIds: string[];
  recentDishes: RecentDishItem[];
  lastTableId?: string;
}

/**
 * Normalizes input to E.164 standard phone format (+[country code][digits]).
 * Default country code is +91 (India) if none provided.
 */
export function formatPhone(raw: string, defaultCountryCode = '+91'): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  // Strip spaces, dashes, parentheses
  const sanitized = trimmed.replace(/[\s\-()]/g, '');
  
  if (sanitized.startsWith('+')) {
    return sanitized;
  }
  
  if (sanitized.startsWith('00')) {
    return `+${sanitized.slice(2)}`;
  }
  
  // If 10 digits standard mobile number, prepend default country code
  if (/^\d{10}$/.test(sanitized)) {
    return `${defaultCountryCode}${sanitized}`;
  }
  
  // Fallback: prepend '+' if just numbers
  return `+${sanitized.replace(/^\+/, '')}`;
}

/**
 * Masks phone number for elegant privacy display in UI:
 * e.g. "+919876543210" -> "+91 ••••• ••210"
 */
export function maskPhone(phone: string): string {
  if (!phone) return '';
  const normalized = formatPhone(phone);
  if (normalized.length < 7) return normalized;
  
  const last3 = normalized.slice(-3);
  const prefix = normalized.slice(0, 3); // e.g. +91
  return `${prefix} ••••• ••${last3}`;
}

/**
 * Fetches existing customer profile by normalized phone number
 */
export async function getCustomerProfile(phone: string): Promise<CustomerProfile | null> {
  if (!phone) return null;
  const normalized = formatPhone(phone);

  // Try Firestore first
  try {
    const snap = await getDoc(doc(db, 'customers', normalized));
    if (snap.exists()) {
      const data = snap.data() as CustomerProfile;
      try {
        localStorage.setItem(`dineview_cust_${normalized}`, JSON.stringify(data));
      } catch {}
      return data;
    }
  } catch (error) {
    console.warn('Could not fetch customer profile from Firestore, checking local storage cache:', error);
  }

  // Fallback to localStorage cache
  try {
    const cached = localStorage.getItem(`dineview_cust_${normalized}`);
    if (cached) {
      return JSON.parse(cached) as CustomerProfile;
    }
  } catch {}

  return null;
}

/**
 * Records or updates a customer profile upon placing an order
 */
export async function recordCustomerOrder(
  order: Order,
  phone: string,
  uid?: string
): Promise<CustomerProfile | null> {
  if (!phone) return null;
  const normalized = formatPhone(phone);
  const now = new Date().toISOString();

  try {
    const existing = await getCustomerProfile(normalized);

    const newRecentDishes: RecentDishItem[] = order.items.map((item: CartItem) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      orderedAt: order.createdAt || now,
    }));

    // Aggregate recent dishes (up to 15 latest)
    const combinedDishes = [...newRecentDishes, ...(existing?.recentDishes || [])].slice(0, 15);

    // Track recent order IDs (up to 5 latest)
    const recentOrderIds = [order.id, ...(existing?.recentOrderIds || []).filter((id) => id !== order.id)].slice(0, 5);

    // Compute favorite dish IDs based on frequency in recent dishes
    const frequencyMap: Record<string, number> = {};
    for (const d of combinedDishes) {
      frequencyMap[d.id] = (frequencyMap[d.id] || 0) + (d.quantity || 1);
    }
    const favoriteDishIds = Object.keys(frequencyMap).sort(
      (a, b) => frequencyMap[b] - frequencyMap[a]
    ).slice(0, 5);

    const updatedProfile: CustomerProfile = {
      phone: normalized,
      uid: uid || existing?.uid || '',
      firstSeenAt: existing?.firstSeenAt || order.createdAt || now,
      lastOrderAt: order.createdAt || now,
      totalOrders: (existing?.totalOrders || 0) + 1,
      totalSpent: (existing?.totalSpent || 0) + (order.total || 0),
      favoriteDishIds,
      recentOrderIds,
      recentDishes: combinedDishes,
      lastTableId: order.tableId || existing?.lastTableId || 'COUNTER',
    };

    // Cache to localStorage
    try {
      localStorage.setItem(`dineview_cust_${normalized}`, JSON.stringify(updatedProfile));
    } catch {}

    // Sync to Firestore
    try {
      await setDoc(doc(db, 'customers', normalized), updatedProfile, { merge: true });
    } catch (fsErr) {
      console.warn('Firestore customer profile write notice (cached locally):', fsErr);
    }

    return updatedProfile;
  } catch (error) {
    console.warn('Failed to record customer profile:', error);
    return null;
  }
}

/**
 * Synchronizes spend changes when manager updates order items/prices
 */
export async function updateCustomerSpendDelta(phone: string, deltaAmount: number): Promise<void> {
  if (!phone || deltaAmount === 0) return;
  const normalized = formatPhone(phone);
  try {
    const existing = await getCustomerProfile(normalized);
    if (!existing) return;
    const newTotal = Math.max(0, (existing.totalSpent || 0) + deltaAmount);
    await updateDoc(doc(db, 'customers', normalized), {
      totalSpent: newTotal,
    });
  } catch (err) {
    console.warn('Could not update customer spend delta:', err);
  }
}

export interface LastCustomerOrderResult {
  orderId?: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    price: number;
    calories?: number;
    image?: string;
  }>;
  date: string;
  table: string;
  total: number;
}

/**
 * Fetches last customer order by orderedAt desc from customers/{phone}.recentDishes + orders where phone==
 */
export async function fetchLastCustomerOrder(phone: string): Promise<LastCustomerOrderResult | null> {
  if (!phone) return null;
  const normalized = formatPhone(phone);

  const allMenuItems = MENU_DATA.flatMap(c => c.items);

  let profileOrder: LastCustomerOrderResult | null = null;
  let firestoreOrder: LastCustomerOrderResult | null = null;

  // 1. Fetch customer profile
  const profile = await getCustomerProfile(normalized);

  if (profile && profile.recentDishes && profile.recentDishes.length > 0) {
    // Sort recent dishes by orderedAt desc
    const sortedDishes = [...profile.recentDishes].sort((a, b) => {
      const timeA = new Date(a.orderedAt).getTime() || 0;
      const timeB = new Date(b.orderedAt).getTime() || 0;
      return timeB - timeA;
    });

    const latestOrderedAt = sortedDishes[0]?.orderedAt;
    // Group all dishes ordered at this latest timestamp (within 60 seconds)
    const latestTimestamp = new Date(latestOrderedAt).getTime();
    const batchDishes = sortedDishes.filter(d => {
      const t = new Date(d.orderedAt).getTime();
      return Math.abs(t - latestTimestamp) <= 60000;
    });

    let total = 0;
    const items = batchDishes.map(d => {
      const match = allMenuItems.find(m => m.id === d.id);
      const price = match ? match.price : 0;
      const calories = match ? match.calories : undefined;
      const image = match ? match.image : '';
      total += price * (d.quantity || 1);
      return {
        id: d.id,
        name: d.name || match?.name || d.id,
        quantity: d.quantity || 1,
        price,
        calories,
        image,
      };
    });

    profileOrder = {
      orderId: profile.recentOrderIds?.[0],
      items,
      date: latestOrderedAt || profile.lastOrderAt || new Date().toISOString(),
      table: profile.lastTableId ? (profile.lastTableId === 'COUNTER' ? 'Counter' : (profile.lastTableId.startsWith('Table') ? profile.lastTableId : `Table ${profile.lastTableId}`)) : 'Table T01',
      total: total > 0 ? total : (profile.totalSpent || 0),
    };
  }

  // 2. Fetch from orders collection where customerPhone == normalized or phone
  try {
    const ordersList: Order[] = [];

    // Check recentOrderIds[0] directly first if known
    if (profile?.recentOrderIds && profile.recentOrderIds.length > 0) {
      try {
        const snap = await getDoc(doc(db, 'orders', profile.recentOrderIds[0]));
        if (snap.exists()) {
          ordersList.push(snap.data() as Order);
        }
      } catch {}
    }

    // Query orders collection where customerPhone == normalized
    try {
      const q = query(collection(db, 'orders'), where('customerPhone', '==', normalized));
      const snaps = await getDocs(q);
      snaps.forEach(s => {
        const o = s.data() as Order;
        if (!ordersList.some(existing => existing.id === o.id)) {
          ordersList.push(o);
        }
      });
    } catch {}

    // Query orders collection where customerPhone == raw phone if different
    if (phone !== normalized) {
      try {
        const qRaw = query(collection(db, 'orders'), where('customerPhone', '==', phone));
        const snapsRaw = await getDocs(qRaw);
        snapsRaw.forEach(s => {
          const o = s.data() as Order;
          if (!ordersList.some(existing => existing.id === o.id)) {
            ordersList.push(o);
          }
        });
      } catch {}
    }

    if (ordersList.length > 0) {
      // Sort orders by createdAt desc
      ordersList.sort((a, b) => {
        const timeA = new Date(a.createdAt).getTime() || 0;
        const timeB = new Date(b.createdAt).getTime() || 0;
        return timeB - timeA;
      });

      const best = ordersList[0];
      const items = (best.items || []).map(i => {
        const match = allMenuItems.find(m => m.id === i.id);
        return {
          id: i.id,
          name: i.name,
          quantity: i.quantity,
          price: i.price,
          calories: match?.calories,
          image: match?.image || i.image,
        };
      });

      firestoreOrder = {
        orderId: best.id,
        items,
        date: best.createdAt,
        table: best.tableName || (best.tableId ? (best.tableId === 'COUNTER' ? 'Counter' : (best.tableId.startsWith('Table') ? best.tableId : `Table ${best.tableId}`)) : 'Table T01'),
        total: best.total,
      };
    }
  } catch (err) {
    console.warn('Could not query orders collection for phone:', err);
  }

  // 3. Compare orderedAt desc between customers/{phone}.recentDishes and orders
  if (profileOrder && firestoreOrder) {
    const profileTime = new Date(profileOrder.date).getTime() || 0;
    const firestoreTime = new Date(firestoreOrder.date).getTime() || 0;
    // Return whichever has newer orderedAt desc (or prefer firestoreOrder if within 10s because of rich order data)
    if (firestoreTime >= profileTime - 10000) {
      return firestoreOrder;
    }
    return profileOrder;
  }

  return firestoreOrder || profileOrder || null;
}
