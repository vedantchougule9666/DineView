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
          fetchedOrders.push(doc.data() as Order);
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
    const orderId = Math.random().toString(36).substring(2, 9).toUpperCase();
    const resolvedTableId = tableId && tableId.trim() ? tableId.trim() : 'COUNTER';
    const resolvedTableName = tableName && tableName.trim()
      ? tableName.trim()
      : (resolvedTableId === 'COUNTER' ? 'Counter' : `Table ${resolvedTableId}`);

    // Step 1: ensureSession runs BEFORE order write (COUNTER orders bypass session creation)
    let tableSessionId: string | undefined = undefined;
    if (resolvedTableId !== 'COUNTER') {
      try {
        const session = await ensureSession(resolvedTableId, resolvedTableName, customerPhone);
        if (session) {
          tableSessionId = session.id;
        }
      } catch (sessErr) {
        console.error('Failed to ensure session before order placement:', sessErr);
      }
    }

    // Step 2: Build order entity
    const newOrder: Order = {
      id: orderId,
      items,
      total,
      status: 'pending',
      createdAt: new Date().toISOString(),
      tableId: resolvedTableId,
      tableName: resolvedTableName,
      tableSessionId,
      customerPhone: customerPhone ? customerPhone.trim() : '',
      phoneVerified: false,
    };
    
    // Step 3: Write order to Firestore
    await setDoc(doc(db, 'orders', orderId), newOrder);

    // Step 4: Atomically link order to table session
    if (tableSessionId) {
      try {
        const itemsCount = items.reduce((acc, it) => acc + (it.quantity || 1), 0);
        await addOrderToSession(tableSessionId, {
          id: orderId,
          total,
          itemsCount,
        });
      } catch (aggErr) {
        console.error('Failed to add order to session aggregate:', aggErr);
      }
    }

    return orderId;
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
