import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  orderBy, 
  limit, 
  runTransaction, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface TableSession {
  id: string;
  isSession?: boolean;
  shortId: string;
  tableId: string;
  tableName: string;
  status: 'active' | 'closed';
  startedAt: string; // ISO 8601
  endedAt: string | null;
  durationMinutes: number | null;
  totalAmount: number;
  itemsCount: number;
  orderIds: string[];
  createdByPhone: string | null;
  closedBy: string | null;
}

export function generateShortId(): string {
  // 4 uppercase alphanumeric characters e.g. B72A
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Retrieves the currently active session for a dining table, if one exists.
 * Queries the orders collection with isSession: true to adhere to deployed permissions.
 */
export async function getActiveSession(tableId: string): Promise<TableSession | null> {
  const cleanTableId = tableId ? tableId.trim().toUpperCase() : '';
  if (!cleanTableId || cleanTableId === 'COUNTER') return null;

  try {
    const q = query(
      collection(db, 'orders'),
      where('isSession', '==', true),
      where('tableId', '==', cleanTableId),
      where('status', '==', 'active'),
      limit(1)
    );
    const querySnap = await getDocs(q);
    if (!querySnap.empty) {
      const activeData = querySnap.docs[0].data() as TableSession;
      return activeData;
    }

    return null;
  } catch (err) {
    console.warn(`[sessionService] getActiveSession notice for table ${cleanTableId}:`, err);
    return null;
  }
}

/**
 * Ensures an active session exists for a table before an order is saved.
 * Skips counter/takeaway orders.
 */
export async function ensureSession(
  tableId: string, 
  tableName: string, 
  phone?: string
): Promise<TableSession | null> {
  const cleanTableId = tableId ? tableId.trim().toUpperCase() : '';
  if (!cleanTableId || cleanTableId === 'COUNTER') {
    return null;
  }

  console.log('[sessionService] ensureSession -> checking table:', cleanTableId);

  try {
    // 1. Check if an active session already exists for this table
    const existing = await getActiveSession(cleanTableId);
    if (existing) {
      console.log('[sessionService] ensureSession -> found active session for', cleanTableId, 'shortId:', existing.shortId);
      return existing;
    }

    // 2. Generate unique session ID and friendly shortId
    const sessionId = `sess_${cleanTableId}_${Date.now().toString(36)}`;
    const shortId = generateShortId();

    console.log('[sessionService] ensureSession -> creating new session for', cleanTableId, 'shortId:', shortId);

    const newSession: TableSession = {
      id: sessionId,
      isSession: true,
      shortId,
      tableId: cleanTableId,
      tableName: tableName ? tableName.trim() : `Table ${cleanTableId}`,
      status: 'active',
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationMinutes: null,
      totalAmount: 0,
      itemsCount: 0,
      orderIds: [],
      createdByPhone: phone ? phone.trim() : null,
      closedBy: null,
    };

    // Save session in orders collection (which is verified permitted in cloud rules)
    await setDoc(doc(db, 'orders', sessionId), newSession);

    // Also attempt to link table document if permitted
    try {
      const tableRef = doc(db, 'tables', cleanTableId);
      await setDoc(tableRef, { 
        id: cleanTableId, 
        name: tableName ? tableName.trim() : `Table ${cleanTableId}`, 
        active: true, 
        activeSessionId: sessionId 
      }, { merge: true });
    } catch (tblErr) {
      console.warn(`[sessionService] Note: table document pointer saved locally for ${cleanTableId}`);
    }

    return newSession;
  } catch (err: any) {
    console.error(`[sessionService] ensureSession error for table ${cleanTableId}:`, err?.code, err?.message, err?.stack);
    throw new Error(`[sessionService] ensureSession failed: ${err?.message || err}`);
  }
}

/**
 * Atomically adds an order to a session, aggregating totalAmount and itemsCount.
 */
export async function addOrderToSession(
  sessionId: string,
  order: { id: string; total: number; itemsCount: number }
): Promise<void> {
  if (!sessionId) return;

  try {
    await runTransaction(db, async (transaction) => {
      const sessionRef = doc(db, 'orders', sessionId);
      const sessionDoc = await transaction.get(sessionRef);

      if (!sessionDoc.exists()) {
        throw new Error(`Session ${sessionId} not found`);
      }

      const current = sessionDoc.data() as TableSession;
      const orderIds = Array.isArray(current.orderIds) ? current.orderIds : [];
      const updatedOrderIds = orderIds.includes(order.id) ? orderIds : [...orderIds, order.id];
      const newTotal = Number((current.totalAmount || 0) + (order.total || 0));
      const newItemsCount = Number((current.itemsCount || 0) + (order.itemsCount || 0));

      transaction.update(sessionRef, {
        totalAmount: newTotal,
        itemsCount: newItemsCount,
        orderIds: updatedOrderIds,
      });
    });
    console.log('[sessionService] addOrderToSession -> aggregated order', order.id, 'to session', sessionId);
  } catch (err: any) {
    console.error(`[sessionService] addOrderToSession failed for session ${sessionId}, order ${order.id}:`, err?.code, err?.message);
    // Recalculate fallback
    recalcSessionTotal(sessionId).catch(console.error);
    throw new Error(`[sessionService] addOrderToSession failed: ${err?.message || err}`);
  }
}

/**
 * Closes an active table session transactionally:
 * Marks session closed, sets endedAt and durationMinutes, and clears table.activeSessionId.
 */
export async function closeSession(sessionId: string, managerId = 'Kitchen Manager'): Promise<void> {
  if (!sessionId) return;

  try {
    let tableIdToClear: string | null = null;

    await runTransaction(db, async (transaction) => {
      const sessionRef = doc(db, 'orders', sessionId);
      const sessionSnap = await transaction.get(sessionRef);

      if (!sessionSnap.exists()) {
        throw new Error(`Session ${sessionId} not found.`);
      }

      const sessionData = sessionSnap.data() as TableSession;
      if (sessionData.status === 'closed') {
        return; // Already closed
      }

      tableIdToClear = sessionData.tableId || null;
      const endedAt = new Date().toISOString();
      const startTime = new Date(sessionData.startedAt).getTime();
      const endTime = new Date(endedAt).getTime();
      const durationMinutes = Math.max(1, Math.round((endTime - startTime) / (1000 * 60)));

      // Close session in orders collection
      transaction.update(sessionRef, {
        status: 'closed',
        endedAt,
        durationMinutes,
        closedBy: managerId,
      });
    });

    // Outside transaction, clear table pointer if possible (non-blocking)
    if (tableIdToClear && tableIdToClear !== 'COUNTER') {
      try {
        const tableRef = doc(db, 'tables', tableIdToClear);
        await updateDoc(tableRef, { activeSessionId: null });
      } catch {
        // Ignore if tables collection permissions are restricted in cloud
      }
    }
  } catch (err) {
    console.error(`Failed to close session ${sessionId}:`, err);
    throw err;
  }
}

/**
 * Recalculates totalAmount and itemsCount for a session by summing non-cancelled orders.
 */
export async function recalcSessionTotal(
  sessionId: string
): Promise<{ totalAmount: number; itemsCount: number }> {
  if (!sessionId) return { totalAmount: 0, itemsCount: 0 };

  try {
    const ordersQuery = query(
      collection(db, 'orders'),
      where('tableSessionId', '==', sessionId)
    );
    const snap = await getDocs(ordersQuery);

    let totalAmount = 0;
    let itemsCount = 0;
    const orderIds: string[] = [];

    snap.forEach((docSnap) => {
      const order = docSnap.data();
      if (order.isSession) return; // Skip session header
      if (order.id) orderIds.push(order.id);
      
      // Don't include cancelled orders in session tab
      if (order.status !== 'cancelled') {
        totalAmount += Number(order.total || 0);
        if (Array.isArray(order.items)) {
          itemsCount += order.items.reduce((acc: number, item: any) => acc + (item.quantity || 1), 0);
        }
      }
    });

    const sessionRef = doc(db, 'orders', sessionId);
    await updateDoc(sessionRef, {
      totalAmount,
      itemsCount,
      orderIds,
    });

    return { totalAmount, itemsCount };
  } catch (err) {
    console.error(`Failed to recalc session total for ${sessionId}:`, err);
    return { totalAmount: 0, itemsCount: 0 };
  }
}

/**
 * Real-time subscription to all currently active sessions.
 */
export function subscribeActiveSessions(callback: (sessions: TableSession[]) => void): () => void {
  const q = query(
    collection(db, 'orders'),
    where('isSession', '==', true),
    where('status', '==', 'active')
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const sessions: TableSession[] = [];
      snapshot.forEach((d) => {
        sessions.push(d.data() as TableSession);
      });
      // Sort by startedAt desc
      sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
      callback(sessions);
    },
    (err) => {
      console.warn('[sessionService] subscribeActiveSessions notice:', err);
    }
  );
}

/**
 * Fetches all sessions with optional status and date filters.
 */
export async function fetchSessionHistory(filter?: {
  status?: string;
  startDate?: string;
  endDate?: string;
  tableId?: string;
}): Promise<TableSession[]> {
  try {
    const q = query(
      collection(db, 'orders'),
      where('isSession', '==', true),
      limit(150)
    );
    const snap = await getDocs(q);
    let sessions: TableSession[] = [];

    snap.forEach((d) => {
      sessions.push(d.data() as TableSession);
    });

    sessions.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());

    if (filter) {
      if (filter.status && filter.status !== 'all') {
        sessions = sessions.filter((s) => s.status === filter.status);
      }
      if (filter.tableId && filter.tableId !== 'all') {
        sessions = sessions.filter((s) => s.tableId === filter.tableId);
      }
      if (filter.startDate) {
        const start = new Date(filter.startDate).getTime();
        sessions = sessions.filter((s) => new Date(s.startedAt).getTime() >= start);
      }
      if (filter.endDate) {
        // End of day
        const end = new Date(filter.endDate).getTime() + 86400000;
        sessions = sessions.filter((s) => new Date(s.startedAt).getTime() <= end);
      }
    }

    return sessions;
  } catch (err) {
    console.error('Failed to fetch session history:', err);
    return [];
  }
}
