import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CartItem } from './CartContext';
import { db } from '../lib/firebase';
import { collection, doc, setDoc, updateDoc, onSnapshot, query, orderBy, limit } from 'firebase/firestore';

export type OrderStatus = 'pending' | 'preparing' | 'ready' | 'completed' | 'cancelled';

export interface Order {
  id: string;
  items: CartItem[];
  total: number;
  status: OrderStatus;
  createdAt: string;
  tableId?: string;
  tableName?: string;
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
  ) => string;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
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

    const q = query(collection(db, 'orders'), orderBy('createdAt', 'desc'), limit(50));
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

  const placeOrder = (
    items: CartItem[],
    total: number,
    tableId?: string,
    tableName?: string,
    customerPhone?: string
  ) => {
    const orderId = Math.random().toString(36).substring(2, 9).toUpperCase();
    const resolvedTableId = tableId && tableId.trim() ? tableId.trim() : 'COUNTER';
    const resolvedTableName = tableName && tableName.trim()
      ? tableName.trim()
      : (resolvedTableId === 'COUNTER' ? 'Counter' : `Table ${resolvedTableId}`);

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
    
    // Save to Firestore
    setDoc(doc(db, 'orders', orderId), newOrder).catch(err => {
      console.error("Failed to place order in Firestore", err);
    });

    return orderId;
  };

  const updateOrderStatus = (orderId: string, status: OrderStatus) => {
    // Update in Firestore
    updateDoc(doc(db, 'orders', orderId), { status }).catch(err => {
      console.error("Failed to update order status in Firestore", err);
    });
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
    await updateDoc(doc(db, 'orders', orderId), payload);
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

