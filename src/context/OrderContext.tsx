import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CartItem } from './CartContext';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, limit, getDoc } from 'firebase/firestore';
import { ensureSession, addOrderToSession, recalcSessionTotal } from '../services/sessionService';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  tableId?: string;
  tableName?: string;
  tableSessionId?: string;
  customerPhone?: string;
  phoneVerified?: boolean;
  guestUid?: string;
  managerConfirmed?: boolean;
  managerConfirmedAt?: string;
  managerConfirmedBy?: string;
  kitchenNotes?: string;
}

interface OrderContextType {
  orders: Order[];
  placeOrder: (
    items: CartItem[],
    total: number,
    tableId?: string,
    tableName?: string,
    customerPhone?: string
  ) => Promise<string>;
  updateOrderStatus: (orderId: string, status: OrderStatus) => Promise<void>;
  updateOrderItems: (
    orderId: string,
    items: CartItem[],
    total: number,
    kitchenNotes?: string
  ) => Promise<void>;
  confirmOrder: (
    orderId: string,
    managerName?: string,
    kitchenNotes?: string
  ) => Promise<void>;
  getOrderById: (orderId: string) => Order | undefined;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const location = useLocation();

  useEffect(() => {
    // Subscribe to the global orders list if we are in admin or manager sections
    const isStaffSection = location.pathname.startsWith('/admin') || location.pathname.startsWith('/manager');
    if (!isStaffSection) {
      setOrders([]); // Clear memory when leaving staff areas
      return;
    }

    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(100));
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const fetchedOrders: Order[] = [];
        snapshot.forEach((doc) => {
          const data = doc.data() as any;
          if (!data.isSession && data.items && Array.isArray(data.items)) {
            fetchedOrders.push(data as Order);
          }
        });
        setOrders(fetchedOrders);
      },
      (error) => {
        console.error('Failed to subscribe to orders collection:', error);
      }
    );

    return () => unsubscribe();
  }, [location.pathname]);

  const placeOrder = async (
    items: CartItem[],
    total: number,
    tableId?: string,
    tableName?: string,
    customerPhone?: string
  ): Promise<string> => {
    try {
      // 1. Validate cart inputs
      if (!items || items.length === 0) {
        const err: any = new Error('Your cart is empty. Please add menu items before ordering.');
        err.code = 'CART_EMPTY';
        throw err;
      }

      if (typeof total !== 'number' || total <= 0) {
        const err: any = new Error('Invalid order total.');
        err.code = 'INVALID_TOTAL';
        throw err;
      }

      // 2. Validate inputs before session
      const resolvedTableId = tableId && tableId.trim() ? tableId.trim().toUpperCase() : 'COUNTER';
      const resolvedTableName = tableName && tableName.trim()
        ? tableName.trim()
        : (resolvedTableId === 'COUNTER' ? 'Counter' : `Table ${resolvedTableId}`);

      let tableSessionId: string | undefined = undefined;

      // If tableId === 'COUNTER' skip ensureSession entirely and set tableSessionId = undefined
      if (resolvedTableId !== 'COUNTER') {
        try {
          const session = await ensureSession(resolvedTableId, resolvedTableName, customerPhone);
          if (session?.id) {
            tableSessionId = session.id;
          }
        } catch (sessErr: any) {
          console.error('[placeOrder] ensureSession failed for table', resolvedTableId, sessErr);
          throw sessErr;
        }
      }

      // 3. Create order entity with tableSessionId
      const orderId = Math.random().toString(36).substring(2, 9).toUpperCase();
      const newOrder: Order = {
        id: orderId,
        items,
        total,
        status: 'pending',
        createdAt: new Date().toISOString(),
        tableId: resolvedTableId,
        tableName: resolvedTableName,
        customerPhone: customerPhone ? customerPhone.trim() : '',
        phoneVerified: false,
      };

      // Only attach tableSessionId if defined (avoiding undefined in Firestore)
      if (tableSessionId) {
        newOrder.tableSessionId = tableSessionId;
      }

      // Write order to Firestore
      await setDoc(doc(db, 'orders', orderId), newOrder);
      console.log('[placeOrder] Order created in firestore:', orderId, 'table:', resolvedTableId, 'session:', tableSessionId);

      // 4. Atomically link order to table session
      if (tableSessionId) {
        try {
          const itemsCount = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
          await addOrderToSession(tableSessionId, {
            id: orderId,
            total,
            itemsCount,
          });
        } catch (sessionErr: any) {
          console.error('[placeOrder] addOrderToSession failed, marking order failed:', sessionErr);
          // If addOrderToSession fails, mark order as cancelled/failed
          try {
            await updateDoc(doc(db, 'orders', orderId), { 
              status: 'cancelled',
              kitchenNotes: `Session aggregation failed: ${sessionErr?.message || sessionErr}`
            });
          } catch (cleanupErr) {
            console.warn('[placeOrder] Could not mark orphan order cancelled:', cleanupErr);
          }
          throw sessionErr;
        }
      }

      return orderId;
    } catch (error: any) {
      console.error('[placeOrder] error', error?.code, error?.message, error?.stack);
      throw error;
    }
  };

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    try {
      const orderRef = doc(db, 'orders', orderId);
      await updateDoc(orderRef, { status });

      // If order was cancelled, recalculate session totals
      if (status === 'cancelled') {
        const order = orders.find(o => o.id === orderId);
        let sessionId = order?.tableSessionId;
        if (!sessionId) {
          const snap = await getDoc(orderRef);
          sessionId = snap.data()?.tableSessionId;
        }
        if (sessionId) {
          await recalcSessionTotal(sessionId);
        }
      }
    } catch (err) {
      console.error('Failed to update order status in Firestore', err);
      throw err;
    }
  };

  const updateOrderItems = async (
    orderId: string,
    items: CartItem[],
    total: number,
    kitchenNotes?: string
  ) => {
    const payload: Partial<Order> = {
      items,
      total,
    };
    if (kitchenNotes !== undefined) {
      payload.kitchenNotes = kitchenNotes;
    }

    const orderRef = doc(db, 'orders', orderId);
    await updateDoc(orderRef, payload);

    // Recalculate parent table session to keep bill in sync
    const order = orders.find(o => o.id === orderId);
    let sessionId = order?.tableSessionId;
    if (!sessionId) {
      const snap = await getDoc(orderRef);
      sessionId = snap.data()?.tableSessionId;
    }
    if (sessionId) {
      await recalcSessionTotal(sessionId);
    }
  };

  const confirmOrder = async (
    orderId: string,
    managerName = 'Kitchen Manager',
    kitchenNotes?: string
  ) => {
    const payload: Partial<Order> = {
      status: 'preparing',
      managerConfirmed: true,
      managerConfirmedAt: new Date().toISOString(),
      managerConfirmedBy: managerName,
    };
    if (kitchenNotes !== undefined) {
      payload.kitchenNotes = kitchenNotes;
    }
    await updateDoc(doc(db, 'orders', orderId), payload);
  };

  const getOrderById = (orderId: string) => {
    return orders.find((o) => o.id === orderId);
  };

  return (
    <OrderContext.Provider
      value={{
        orders,
        placeOrder,
        updateOrderStatus,
        updateOrderItems,
        confirmOrder,
        getOrderById,
      }}
    >
      {children}
    </OrderContext.Provider>
  );
}

export function useOrder() {
  const context = useContext(OrderContext);
  if (context === undefined) {
    throw new Error('useOrder must be used within an OrderProvider');
  }
  return context;
}
