import React, { createContext, useContext, useState, ReactNode } from 'react';
import { MENU_DATA, MenuCategory, MenuItem } from '../data/menu';

interface MenuContextType {
  categories: MenuCategory[];
  addMenuItem: (categoryId: string, item: MenuItem) => void;
  updateMenuItem: (categoryId: string, itemId: string, item: Partial<MenuItem>) => void;
  deleteMenuItem: (categoryId: string, itemId: string) => void;
  toggleItemAvailability: (categoryId: string, itemId: string) => void;
  
  addCategory: (category: MenuCategory) => void;
  updateCategory: (categoryId: string, name: string) => void;
  deleteCategory: (categoryId: string) => void;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

export function MenuProvider({ children }: { children: ReactNode }) {
  // Start with default MENU_DATA
  // All items are considered available by default unless specified otherwise.
  const [categories, setCategories] = useState<MenuCategory[]>(
    MENU_DATA.map(cat => ({
      ...cat,
      items: cat.items.map(item => ({ ...item, available: item.available ?? true }))
    }))
  );

  const addMenuItem = (categoryId: string, item: MenuItem) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        return { ...cat, items: [...cat.items, { ...item, available: item.available ?? true }] };
      }
      return cat;
    }));
  };

  const updateMenuItem = (categoryId: string, itemId: string, updatedItem: Partial<MenuItem>) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          items: cat.items.map(item => item.id === itemId ? { ...item, ...updatedItem } : item)
        };
      }
      return cat;
    }));
  };

  const deleteMenuItem = (categoryId: string, itemId: string) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          items: cat.items.filter(item => item.id !== itemId)
        };
      }
      return cat;
    }));
  };

  const toggleItemAvailability = (categoryId: string, itemId: string) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          items: cat.items.map(item => item.id === itemId ? { ...item, available: !item.available } : item)
        };
      }
      return cat;
    }));
  };

  const addCategory = (category: MenuCategory) => {
    setCategories(prev => [...prev, category]);
  };

  const updateCategory = (categoryId: string, name: string) => {
    setCategories(prev => prev.map(cat => {
      if (cat.id === categoryId) {
        return { ...cat, name };
      }
      return cat;
    }));
  };

  const deleteCategory = (categoryId: string) => {
    setCategories(prev => prev.filter(cat => cat.id !== categoryId));
  };

  return (
    <MenuContext.Provider value={{
      categories,
      addMenuItem,
      updateMenuItem,
      deleteMenuItem,
      toggleItemAvailability,
      addCategory,
      updateCategory,
      deleteCategory
    }}>
      {children}
    </MenuContext.Provider>
  );
}

export function useMenu() {
  const context = useContext(MenuContext);
  if (context === undefined) {
    throw new Error('useMenu must be used within a MenuProvider');
  }
  return context;
}
