import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MenuItem } from '../data/menu';

export interface CartItem extends MenuItem {
  cartItemId: string;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (item: MenuItem, quantity?: number) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
  itemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = (item: MenuItem, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.id === item.id);
      const limit = item.maxPerOrder ?? 20;
      
      if (existing) {
        return prev.map((i) => {
          if (i.id === item.id) {
            const newQuantity = Math.min(i.quantity + quantity, limit);
            return { ...i, quantity: newQuantity };
          }
          return i;
        });
      }
      const newQuantity = Math.min(quantity, limit);
      const cartItemId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : 'cart-' + Date.now() + '-' + Math.random().toString(36).substring(2, 9);
      return [...prev, { ...item, cartItemId, quantity: newQuantity }];
    });
  };

  const removeItem = (cartItemId: string) => {
    setItems((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
  };

  const updateQuantity = (cartItemId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(cartItemId);
      return;
    }
    setItems((prev) =>
      prev.map((i) => {
        if (i.cartItemId === cartItemId) {
          const limit = i.maxPerOrder ?? 20;
          const newQuantity = quantity > limit ? limit : quantity;
          return { ...i, quantity: newQuantity };
        }
        return i;
      })
    );
  };

  const clearCart = () => setItems([]);

  const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{ items, addItem, removeItem, updateQuantity, clearCart, total, itemCount }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}
