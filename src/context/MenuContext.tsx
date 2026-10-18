import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode, useRef } from 'react';
import { MENU_DATA, MenuCategory, MenuItem } from '../data/menu';
import { db } from '../lib/firebase';
import { 
  collection, 
  doc, 
  query, 
  orderBy, 
  onSnapshot, 
  setDoc, 
  deleteDoc, 
  getDocs, 
  getDoc 
} from 'firebase/firestore';

const BROADCAST_CHANNEL_NAME = 'dineview-menu';
const CUSTOM_EVENT_NAME = 'menu-updated';

const DEFAULT_POSITIONS: Record<string, number> = {
  'starters': 1,
  'main-courses': 2,
  'sides': 3,
  'desserts': 4,
  'beverages': 5,
};

function getCategoryPosition(categoryId: string, index: number = 0): number {
  return DEFAULT_POSITIONS[categoryId] ?? (index + 1);
}

export interface MenuContextType {
  categories: MenuCategory[];
  addMenuItem: (categoryId: string, item: MenuItem) => Promise<void>;
  updateMenuItem: (categoryId: string, itemId: string, item: Partial<MenuItem>) => Promise<void>;
  deleteMenuItem: (categoryId: string, itemId: string) => Promise<void>;
  toggleItemAvailability: (categoryId: string, itemId: string) => Promise<void>;
  
  addCategory: (category: MenuCategory) => Promise<void>;
  updateCategory: (categoryId: string, name: string) => Promise<void>;
  deleteCategory: (categoryId: string) => Promise<void>;
  
  refreshMenu: () => Promise<void>;
  invalidateCache: () => void;
  broadcastUpdate: (updatedCategories: MenuCategory[]) => void;
}

const MenuContext = createContext<MenuContextType | undefined>(undefined);

// Dev / offline fallback categories (never stored in localStorage)
const getDevFallbackCategories = (): MenuCategory[] => {
  return MENU_DATA.map((cat, idx) => ({
    ...cat,
    position: getCategoryPosition(cat.id, idx),
    items: cat.items.map(item => ({ ...item, available: item.available ?? true }))
  }));
};

export function MenuProvider({ children }: { children: ReactNode }) {
  // Source of truth: live Firestore /menu/categories via onSnapshot;
  // Initialize with fallback in memory to avoid empty menu cards on slow network/offline
  const [categories, setCategories] = useState<MenuCategory[]>(() => {
    return getDevFallbackCategories();
  });

  const categoriesRef = useRef<MenuCategory[]>(categories);
  categoriesRef.current = categories;

  // Broadcast update helper for instant multi-tab / cross-window sync
  const broadcastUpdate = useCallback((updatedCategories: MenuCategory[]) => {
    // 1. BroadcastChannel 'dineview-menu'
    try {
      if (typeof BroadcastChannel !== 'undefined') {
        const bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.postMessage({ 
          type: 'menu-updated', 
          categories: updatedCategories, 
          timestamp: Date.now() 
        });
        bc.close();
      }
    } catch (e) {
      console.warn('[MenuContext] BroadcastChannel post error:', e);
    }

    // 2. CustomEvent 'menu-updated'
    try {
      window.dispatchEvent(
        new CustomEvent(CUSTOM_EVENT_NAME, { detail: updatedCategories })
      );
    } catch {}
  }, []);

  // Update in-memory state and dispatch real-time events without touching localStorage.dineview_menu
  const applyCategoriesUpdate = useCallback((newCategories: MenuCategory[], shouldBroadcast: boolean = true) => {
    setCategories(newCategories);
    if (shouldBroadcast) {
      broadcastUpdate(newCategories);
    }
  }, [broadcastUpdate]);

  // Seed default menu to Firestore if collection or /menu/categories is empty
  const seedFirestoreIfEmpty = useCallback(async () => {
    try {
      const catDoc = await getDoc(doc(db, 'menu', 'categories'));
      if (!catDoc.exists() || !catDoc.data()?.categories?.length) {
        console.log('[MenuContext] Firestore /menu/categories is empty. Seeding initial categories...');
        const initialList = getDevFallbackCategories();
        for (let idx = 0; idx < initialList.length; idx++) {
          const cat = initialList[idx];
          const pos = getCategoryPosition(cat.id, idx);
          await setDoc(doc(db, 'menu', cat.id), {
            id: cat.id,
            name: cat.name,
            position: pos,
            items: cat.items,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        }
        // Also write aggregated doc for fast multi-consumer reads
        await setDoc(doc(db, 'menu', 'categories'), {
          categories: initialList,
          position: 0,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
    } catch (err) {
      console.warn('[MenuContext] Could not seed Firestore /menu:', err);
    }
  }, []);

  // Invalidate cache
  const invalidateCache = useCallback(() => {
    try {
      sessionStorage.removeItem('dineview_menu_cache_tag');
    } catch {}
  }, []);

  // Re-fetch latest menu from Firestore /menu/categories
  const refreshMenu = useCallback(async () => {
    invalidateCache();

    // 1. Try reading direct /menu/categories doc first
    try {
      const catDoc = await getDoc(doc(db, 'menu', 'categories'));
      if (catDoc.exists()) {
        const d = catDoc.data();
        if (d?.categories && Array.isArray(d.categories) && d.categories.length > 0) {
          applyCategoriesUpdate(d.categories, true);
          console.log('[MenuContext] snapshot size ->', d.categories.length);
          return;
        }
      }
    } catch (err) {
      console.warn('[MenuContext] refreshMenu doc error:', err);
    }

    // 2. Try querying /menu ordered by position
    try {
      const menuQuery = query(collection(db, 'menu'), orderBy('position'));
      const snapshot = await getDocs(menuQuery);
      
      const fetchedCats: MenuCategory[] = [];
      snapshot.forEach((docSnap) => {
        if (docSnap.id === 'categories') {
          const d = docSnap.data();
          if (d?.categories && Array.isArray(d.categories) && fetchedCats.length === 0) {
            fetchedCats.push(...d.categories);
          }
        } else {
          const d = docSnap.data();
          if (d?.items && Array.isArray(d.items)) {
            fetchedCats.push({
              id: docSnap.id,
              name: d.name || docSnap.id,
              items: d.items
            });
          }
        }
      });

      if (fetchedCats.length > 0) {
        applyCategoriesUpdate(fetchedCats, true);
        console.log('[MenuContext] snapshot size ->', fetchedCats.length);
        return;
      }
    } catch (err) {
      console.warn('[MenuContext] refreshMenu query error:', err);
    }
  }, [invalidateCache, applyCategoriesUpdate]);

  // Firestore onSnapshot listener on Firestore /menu/categories and collection(db, 'menu')
  useEffect(() => {
    let isSubscribed = true;
    let bc: BroadcastChannel | null = null;

    // 1. Setup BroadcastChannel 'dineview-menu' listener
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
        bc.onmessage = (event) => {
          if (event.data?.type === 'menu-updated' && Array.isArray(event.data?.categories)) {
            if (isSubscribed) {
              setCategories(event.data.categories);
              console.log('[MenuContext] snapshot size ->', event.data.categories.length);
            }
          }
        };
      } catch (e) {
        console.warn('[MenuContext] BroadcastChannel init error:', e);
      }
    }

    // 2. Setup CustomEvent 'menu-updated' listener
    const handleCustomEvent = (e: Event) => {
      const customEvent = e as CustomEvent<MenuCategory[]>;
      if (customEvent.detail && Array.isArray(customEvent.detail) && isSubscribed) {
        setCategories(customEvent.detail);
        console.log('[MenuContext] snapshot size ->', customEvent.detail.length);
      }
    };
    window.addEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);

    // 3. Setup Firestore onSnapshot listener directly on /menu/categories doc
    let unsubscribeCatDoc: (() => void) | null = null;
    let unsubscribeFirestoreCol: (() => void) | null = null;

    try {
      const categoriesDocRef = doc(db, 'menu', 'categories');
      unsubscribeCatDoc = onSnapshot(
        categoriesDocRef,
        (docSnap) => {
          if (!isSubscribed) return;
          if (docSnap.exists()) {
            const data = docSnap.data();
            if (data?.categories && Array.isArray(data.categories) && data.categories.length > 0) {
              setCategories(data.categories);
              broadcastUpdate(data.categories);
              console.log('[MenuContext] snapshot size ->', data.categories.length);
              return;
            }
          }
        },
        (error) => {
          console.warn('[MenuContext] Firestore /menu/categories onSnapshot error, falling back to MENU_DATA:', error);
          // Falls back to MENU_DATA only when offline or error
          if (categoriesRef.current.length === 0) {
            const fallback = getDevFallbackCategories();
            setCategories(fallback);
            console.log('[MenuContext] snapshot size (offline fallback) ->', fallback.length);
          }
        }
      );
    } catch (err) {
      console.warn('[MenuContext] Failed to attach onSnapshot to /menu/categories:', err);
    }

    // Also listen to collection(db, 'menu'), orderBy('position') for individual doc updates
    try {
      const menuQuery = query(collection(db, 'menu'), orderBy('position'));
      unsubscribeFirestoreCol = onSnapshot(
        menuQuery,
        (snapshot) => {
          if (!isSubscribed) return;

          const fetchedCats: MenuCategory[] = [];
          let aggregatedCategoriesDoc: MenuCategory[] | null = null;

          snapshot.forEach((docSnap) => {
            if (docSnap.id === 'categories') {
              const d = docSnap.data();
              if (d?.categories && Array.isArray(d.categories)) {
                aggregatedCategoriesDoc = d.categories;
              }
            } else {
              const d = docSnap.data();
              if (d?.items && Array.isArray(d.items)) {
                fetchedCats.push({
                  id: docSnap.id,
                  name: d.name || docSnap.id,
                  items: d.items
                });
              }
            }
          });

          const finalCategories = fetchedCats.length > 0 
            ? fetchedCats 
            : (aggregatedCategoriesDoc || []);

          if (finalCategories.length > 0) {
            setCategories(finalCategories);
            broadcastUpdate(finalCategories);
            console.log('[MenuContext] snapshot size ->', finalCategories.length);
          } else if (snapshot.empty) {
            // Attempt auto-seed if empty
            seedFirestoreIfEmpty().then(() => {
              if (categoriesRef.current.length === 0) {
                const fallback = getDevFallbackCategories();
                setCategories(fallback);
                console.log('[MenuContext] snapshot size (seed fallback) ->', fallback.length);
              }
            });
          }
        },
        (error) => {
          console.warn('[MenuContext] Firestore collection onSnapshot error:', error);
          if (categoriesRef.current.length === 0) {
            const fallback = getDevFallbackCategories();
            setCategories(fallback);
            console.log('[MenuContext] snapshot size (offline fallback) ->', fallback.length);
          }
        }
      );
    } catch (err) {
      console.warn('[MenuContext] Failed to attach collection onSnapshot:', err);
    }

    return () => {
      isSubscribed = false;
      if (bc) bc.close();
      window.removeEventListener(CUSTOM_EVENT_NAME, handleCustomEvent);
      if (unsubscribeCatDoc) unsubscribeCatDoc();
      if (unsubscribeFirestoreCol) unsubscribeFirestoreCol();
    };
  }, [broadcastUpdate, seedFirestoreIfEmpty]);

  // Admin Write Operations - Direct to Firestore docs with same docId as customer menu, NO localStorage.dineview_menu writes
  const persistCategoryDoc = async (categoryId: string, updatedCat: MenuCategory, allCats: MenuCategory[]) => {
    // 1. Instant local update & real-time broadcast
    applyCategoriesUpdate(allCats, true);

    // 2. Write to Firestore doc with docId = categoryId
    try {
      const pos = getCategoryPosition(categoryId, allCats.findIndex(c => c.id === categoryId));
      await setDoc(doc(db, 'menu', categoryId), {
        id: categoryId,
        name: updatedCat.name,
        position: pos,
        items: updatedCat.items,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn(`[MenuContext] Failed to write Firestore doc /menu/${categoryId}:`, err);
    }

    // 3. Write unified categories doc /menu/categories
    try {
      await setDoc(doc(db, 'menu', 'categories'), {
        categories: allCats,
        position: 0,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('[MenuContext] Failed to write /menu/categories:', err);
    }
  };

  const addMenuItem = async (categoryId: string, item: MenuItem) => {
    const updated = categories.map(cat => {
      if (cat.id === categoryId) {
        return { 
          ...cat, 
          items: [...cat.items, { ...item, available: item.available ?? true }] 
        };
      }
      return cat;
    });
    const targetCat = updated.find(c => c.id === categoryId);
    if (targetCat) {
      await persistCategoryDoc(categoryId, targetCat, updated);
    }
  };

  const updateMenuItem = async (categoryId: string, itemId: string, updatedItem: Partial<MenuItem>) => {
    const updated = categories.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          items: cat.items.map(item => item.id === itemId ? { ...item, ...updatedItem } : item)
        };
      }
      return cat;
    });
    const targetCat = updated.find(c => c.id === categoryId);
    if (targetCat) {
      await persistCategoryDoc(categoryId, targetCat, updated);
    }
  };

  const deleteMenuItem = async (categoryId: string, itemId: string) => {
    const updated = categories.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          items: cat.items.filter(item => item.id !== itemId)
        };
      }
      return cat;
    });
    const targetCat = updated.find(c => c.id === categoryId);
    if (targetCat) {
      await persistCategoryDoc(categoryId, targetCat, updated);
    }
  };

  const toggleItemAvailability = async (categoryId: string, itemId: string) => {
    const updated = categories.map(cat => {
      if (cat.id === categoryId) {
        return {
          ...cat,
          items: cat.items.map(item => item.id === itemId ? { ...item, available: !item.available } : item)
        };
      }
      return cat;
    });
    const targetCat = updated.find(c => c.id === categoryId);
    if (targetCat) {
      await persistCategoryDoc(categoryId, targetCat, updated);
    }
  };

  const addCategory = async (category: MenuCategory) => {
    const updated = [...categories, category];
    await persistCategoryDoc(category.id, category, updated);
  };

  const updateCategory = async (categoryId: string, name: string) => {
    const updated = categories.map(cat => {
      if (cat.id === categoryId) {
        return { ...cat, name };
      }
      return cat;
    });
    const targetCat = updated.find(c => c.id === categoryId);
    if (targetCat) {
      await persistCategoryDoc(categoryId, targetCat, updated);
    }
  };

  const deleteCategory = async (categoryId: string) => {
    const updated = categories.filter(cat => cat.id !== categoryId);
    applyCategoriesUpdate(updated, true);

    try {
      await deleteDoc(doc(db, 'menu', categoryId));
      await setDoc(doc(db, 'menu', 'categories'), {
        categories: updated,
        position: 0,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn(`[MenuContext] Failed to delete Firestore doc /menu/${categoryId}:`, err);
    }
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
      deleteCategory,
      refreshMenu,
      invalidateCache,
      broadcastUpdate
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
