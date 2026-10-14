import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs } from 'firebase/firestore';
import { db } from '../lib/firebase';

export interface RestaurantTable {
  id: string; // e.g. "T05"
  name: string; // e.g. "Table 5"
  active: boolean;
  createdAt: string;
}

export type Table = RestaurantTable;

export interface TableContextType {
  tables: RestaurantTable[];
  allTables: RestaurantTable[];
  loading: boolean;
  activeTableId: string;
  activeTableName: string;
  setActiveTable: (id: string) => void;
  refresh: () => Promise<void>;
  addTable: (id: string, name: string) => Promise<void>;
  toggleTableActive: (id: string, active: boolean) => Promise<void>;
  deleteTable: (id: string) => Promise<void>;
}

const TableContext = createContext<TableContextType | undefined>(undefined);

export const isValidDemoTablePattern = (id: string): boolean => {
  return /^T[0-9]{1,2}$/i.test(id.trim());
};

export const formatDemoTableName = (id: string): string => {
  const clean = id.trim().toUpperCase();
  const num = parseInt(clean.replace(/^T0*/, '') || clean.replace(/^T/, ''), 10);
  return num ? `Table ${num}` : `Table ${clean}`;
};

export function TableProvider({ children }: { children: ReactNode }) {
  // Helper to get initial table ID synchronously on mount to avoid UI flash
  const getInitialTable = (): { id: string; name: string } => {
    if (typeof window === 'undefined') {
      return { id: 'COUNTER', name: 'Counter' };
    }
    const params = new URLSearchParams(window.location.search);
    const tableParam = params.get('table');
    if (tableParam) {
      const clean = tableParam.trim().toUpperCase();
      if (isValidDemoTablePattern(clean)) {
        try {
          localStorage.setItem('dineview_table', clean);
        } catch {}
        return { id: clean, name: formatDemoTableName(clean) };
      }
    }
    try {
      const saved = localStorage.getItem('dineview_table');
      if (saved && saved !== 'COUNTER' && isValidDemoTablePattern(saved)) {
        const clean = saved.trim().toUpperCase();
        return { id: clean, name: formatDemoTableName(clean) };
      }
    } catch {}
    return { id: 'COUNTER', name: 'Counter' };
  };

  const initial = getInitialTable();
  const [activeTableId, setActiveTableId] = useState<string>(initial.id);
  const [activeTableName, setActiveTableName] = useState<string>(initial.name);

  // Initialize tables from local cache if present for demo
  const [allTables, setAllTables] = useState<RestaurantTable[]>(() => {
    try {
      const cached = localStorage.getItem('dineview_demo_tables');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch {}
    return [];
  });

  const [tables, setTables] = useState<RestaurantTable[]>(() => {
    try {
      const cached = localStorage.getItem('dineview_demo_tables');
      if (cached) {
        const parsed: RestaurantTable[] = JSON.parse(cached);
        return parsed.filter(t => t.active);
      }
    } catch {}
    return [];
  });

  const [loading, setLoading] = useState<boolean>(true);
  const location = useLocation();

  // Subscribe to Firestore tables collection with onSnapshot
  useEffect(() => {
    const unsubscribe = onSnapshot(
      collection(db, 'tables'),
      (snapshot) => {
        const fetched: RestaurantTable[] = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          fetched.push({
            id: docSnap.id,
            name: data.name || docSnap.id,
            active: data.active ?? true,
            createdAt: data.createdAt || new Date().toISOString(),
          });
        });

        if (fetched.length > 0) {
          // Sort tables by ID (e.g. T01, T02...)
          fetched.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));

          const activeOnly = fetched.filter((t) => t.active);
          setAllTables(fetched);
          setTables(activeOnly);
          try {
            localStorage.setItem('dineview_demo_tables', JSON.stringify(fetched));
          } catch {}
        }
        setLoading(false);
      },
      (error) => {
        console.warn('Firestore tables collection subscription error (using local demo tables if available):', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  // Sync activeTable with URL params and localStorage, validating against loaded tables
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tableParam = params.get('table');

    if (tableParam !== null) {
      const cleanParam = tableParam.trim().toUpperCase();
      // If tables collection is populated, validate against active tables
      if (tables.length > 0) {
        const matched = tables.find((t) => t.id.toUpperCase() === cleanParam);
        if (matched) {
          setActiveTableId(matched.id);
          setActiveTableName(matched.name);
          try {
            localStorage.setItem('dineview_table', matched.id);
          } catch {}
          return;
        } else {
          // Explicit invalid table param -> fallback to COUNTER
          setActiveTableId('COUNTER');
          setActiveTableName('Counter');
          try {
            localStorage.removeItem('dineview_table');
          } catch {}
          return;
        }
      } else {
        // Tables empty (demo mode): accept T01-T99 pattern
        if (isValidDemoTablePattern(cleanParam)) {
          setActiveTableId(cleanParam);
          setActiveTableName(formatDemoTableName(cleanParam));
          try {
            localStorage.setItem('dineview_table', cleanParam);
          } catch {}
          return;
        } else {
          setActiveTableId('COUNTER');
          setActiveTableName('Counter');
          try {
            localStorage.removeItem('dineview_table');
          } catch {}
          return;
        }
      }
    }

    // No table param in URL: load from localStorage
    try {
      const saved = localStorage.getItem('dineview_table');
      if (saved && saved !== 'COUNTER') {
        const cleanSaved = saved.trim().toUpperCase();
        if (tables.length > 0) {
          const matched = tables.find((t) => t.id.toUpperCase() === cleanSaved);
          if (matched) {
            setActiveTableId(matched.id);
            setActiveTableName(matched.name);
            return;
          } else {
            // Saved table is no longer in active tables
            setActiveTableId('COUNTER');
            setActiveTableName('Counter');
            localStorage.removeItem('dineview_table');
            return;
          }
        } else if (isValidDemoTablePattern(cleanSaved)) {
          setActiveTableId(cleanSaved);
          setActiveTableName(formatDemoTableName(cleanSaved));
          return;
        }
      }
    } catch {}

    // Fallback to COUNTER
    setActiveTableId('COUNTER');
    setActiveTableName('Counter');
  }, [location.search, tables]);

  const setActiveTable = useCallback((id: string) => {
    const clean = id.trim().toUpperCase();
    if (!clean || clean === 'COUNTER') {
      setActiveTableId('COUNTER');
      setActiveTableName('Counter');
      try {
        localStorage.removeItem('dineview_table');
      } catch {}
      return;
    }

    const matched = tables.find((t) => t.id.toUpperCase() === clean);
    if (matched) {
      setActiveTableId(matched.id);
      setActiveTableName(matched.name);
      try {
        localStorage.setItem('dineview_table', matched.id);
      } catch {}
    } else if (isValidDemoTablePattern(clean)) {
      setActiveTableId(clean);
      setActiveTableName(formatDemoTableName(clean));
      try {
        localStorage.setItem('dineview_table', clean);
      } catch {}
    } else {
      setActiveTableId('COUNTER');
      setActiveTableName('Counter');
      try {
        localStorage.removeItem('dineview_table');
      } catch {}
    }
  }, [tables]);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const snapshot = await getDocs(collection(db, 'tables'));
      const fetched: RestaurantTable[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        fetched.push({
          id: docSnap.id,
          name: data.name || docSnap.id,
          active: data.active ?? true,
          createdAt: data.createdAt || new Date().toISOString(),
        });
      });
      fetched.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      setAllTables(fetched);
      setTables(fetched.filter((t) => t.active));
    } catch (err) {
      console.error('Failed to refresh tables:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const addTable = useCallback(async (id: string, name: string) => {
    const cleanId = id.trim().toUpperCase();
    const cleanName = name.trim() || formatDemoTableName(cleanId);
    const newTable: RestaurantTable = {
      id: cleanId,
      name: cleanName,
      active: true,
      createdAt: new Date().toISOString(),
    };
    try {
      await setDoc(doc(db, 'tables', cleanId), newTable);
    } catch (err) {
      console.warn('Firestore setDoc failed, saving table locally:', err);
    }
    setAllTables((prev) => {
      const existing = prev.filter((t) => t.id !== cleanId);
      const updated = [...existing, newTable].sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
      try { localStorage.setItem('dineview_demo_tables', JSON.stringify(updated)); } catch {}
      return updated;
    });
    setTables((prev) => {
      const existing = prev.filter((t) => t.id !== cleanId);
      return [...existing, newTable].filter((t) => t.active).sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
    });
  }, []);

  const toggleTableActive = useCallback(async (id: string, active: boolean) => {
    const cleanId = id.trim().toUpperCase();
    try {
      await updateDoc(doc(db, 'tables', cleanId), { active });
    } catch (err) {
      console.warn('Firestore updateDoc failed, updating table locally:', err);
    }
    setAllTables((prev) => {
      const updated = prev.map((t) => (t.id === cleanId ? { ...t, active } : t));
      try { localStorage.setItem('dineview_demo_tables', JSON.stringify(updated)); } catch {}
      return updated;
    });
    setTables((prev) => {
      return prev.map((t) => (t.id === cleanId ? { ...t, active } : t)).filter((t) => t.active);
    });
  }, []);

  const deleteTable = useCallback(async (id: string) => {
    const cleanId = id.trim().toUpperCase();
    try {
      await deleteDoc(doc(db, 'tables', cleanId));
    } catch (err) {
      console.warn('Firestore deleteDoc failed, deleting table locally:', err);
    }
    setAllTables((prev) => {
      const updated = prev.filter((t) => t.id !== cleanId);
      try { localStorage.setItem('dineview_demo_tables', JSON.stringify(updated)); } catch {}
      return updated;
    });
    setTables((prev) => prev.filter((t) => t.id !== cleanId));
  }, []);

  return (
    <TableContext.Provider
      value={{
        tables,
        allTables,
        loading,
        activeTableId,
        activeTableName,
        setActiveTable,
        refresh,
        addTable,
        toggleTableActive,
        deleteTable,
      }}
    >
      {children}
    </TableContext.Provider>
  );
}

export function useTable() {
  const context = useContext(TableContext);
  if (!context) {
    throw new Error('useTable must be used within a TableProvider');
  }
  return context;
}
