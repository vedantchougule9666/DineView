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
}

interface OrderContextType {
  orders: Order[];
  placeOrder: (items: CartItem[], total: number, tableId?: string, tableName?: string) => string;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  getOrderById: (orderId: string) => Order | undefined;
}

const OrderContext = createContext<OrderContextType | undefined>(undefined);

export function OrderProvider({ children }: { children: ReactNode }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const location = useLocation();

  useEffect(() => {
    // Only subscribe to the global orders list if we are in the admin section
    if (!location.pathname.startsWith('/admin')) {
      setOrders([]); // Clear memory when leaving admin
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

  const placeOrder = (items: CartItem[], total: number, tableId?: string, tableName?: string) => {
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

  const getOrderById = (orderId: string) => {
    return orders.find((o) => o.id === orderId);
  };

  return (
    <OrderContext.Provider value={{ orders, placeOrder, updateOrderStatus, getOrderById }}>
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

