import React, { useState, useMemo, useEffect } from 'react';
import { useOrder, Order, OrderStatus } from '../../context/OrderContext';
import { CartItem } from '../../context/CartContext';
import { 
  ChefHat, 
  CheckCircle2, 
  Clock, 
  PackageCheck, 
  AlertCircle, 
  Edit3, 
  Plus, 
  Minus, 
  Trash2, 
  X, 
  Search, 
  Phone, 
  ShieldCheck, 
  Save, 
  Calendar, 
  CalendarRange,
  FileText,
  UserCheck,
  ArrowUpDown,
  Receipt,
  TrendingUp,
  Filter,
  Users,
  Layers,
  ListFilter,
  Lock,
  ChevronDown,
  ChevronUp,
  RotateCcw
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { maskPhone, updateCustomerSpendDelta } from '../../services/customerService';
import { 
  DateFilterState, 
  DateFilterType, 
  SortOptionType, 
  filterOrdersByDate, 
  sortOrders, 
  getOrderCountsPerDay 
} from '../../utils/orderFilters';
import { 
  TableSession, 
  subscribeActiveSessions, 
  closeSession, 
  recalcSessionTotal 
} from '../../services/sessionService';

const DATE_PRESETS: { id: DateFilterType; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7days', label: 'Last 7 days' },
  { id: '30days', label: 'Last 30 days' },
  { id: 'custom', label: 'Custom range' },
  { id: 'all', label: 'All Time' },
];

export default function ManagerOrdersPage() {
  const { orders, confirmOrder, updateOrderStatus, updateOrderItems } = useOrder();
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<'sessions' | 'stream'>('sessions');

  // Real-time active sessions
  const [activeSessions, setActiveSessions] = useState<TableSession[]>([]);
  const [, setClockTick] = useState<number>(0);

  // Close Session Confirmation Modal
  const [closingSession, setClosingSession] = useState<TableSession | null>(null);
  const [isClosingAction, setIsClosingAction] = useState<boolean>(false);

  // Expanded session accordions in session view
  const [collapsedSessions, setCollapsedSessions] = useState<Record<string, boolean>>({});
  
  // Date and Sort filter states
  const [dateFilter, setDateFilter] = useState<DateFilterState>({
    type: 'today',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [sortBy, setSortBy] = useState<SortOptionType>('newest');

  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [editItems, setEditItems] = useState<CartItem[]>([]);
  const [editNotes, setEditNotes] = useState<string>('');
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [revealedPhones, setRevealedPhones] = useState<Record<string, boolean>>({});

  const managerName = typeof window !== 'undefined'
    ? sessionStorage.getItem('dineview_manager_name') || 'Kitchen Supervisor'
    : 'Kitchen Supervisor';

  // Real-time subscription to active table sessions
  useEffect(() => {
    const unsubscribe = subscribeActiveSessions((sessions) => {
      setActiveSessions(sessions);
    });
    return () => unsubscribe();
  }, []);

  // Timer tick every 30s to update elapsed duration badges
  useEffect(() => {
    const timer = setInterval(() => {
      setClockTick(prev => prev + 1);
    }, 30000);
    return () => clearInterval(timer);
  }, []);

  const handleDatePresetClick = (preset: DateFilterType) => {
    if (preset === 'today') {
      const todayStr = new Date().toISOString().split('T')[0];
      setDateFilter({ type: 'today', startDate: todayStr, endDate: todayStr });
    } else if (preset === '7days') {
      const now = new Date();
      const past7 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
      setDateFilter({
        type: '7days',
        startDate: past7.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      });
    } else if (preset === '30days') {
      const now = new Date();
      const past30 = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
      setDateFilter({
        type: '30days',
        startDate: past30.toISOString().split('T')[0],
        endDate: now.toISOString().split('T')[0],
      });
    } else if (preset === 'custom') {
      setDateFilter(prev => ({
        type: 'custom',
        startDate: prev.startDate || new Date().toISOString().split('T')[0],
        endDate: prev.endDate || new Date().toISOString().split('T')[0],
      }));
    } else {
      setDateFilter({ type: 'all' });
    }
  };

  // 1. Filter by Status & Search Query
  const baseFiltered = useMemo(() => {
    return orders.filter((order) => {
      const matchesStatus = selectedStatus === 'all' || order.status === selectedStatus;
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch =
        !q ||
        order.id.toLowerCase().includes(q) ||
        (order.tableId && order.tableId.toLowerCase().includes(q)) ||
        (order.tableName && order.tableName.toLowerCase().includes(q)) ||
        (order.customerPhone && order.customerPhone.toLowerCase().includes(q)) ||
        order.items.some((i) => i.name.toLowerCase().includes(q));

      return matchesStatus && matchesSearch;
    });
  }, [orders, selectedStatus, searchQuery]);

  // 2. Filter by Date (applied to orders by createdAt)
  const dateFiltered = useMemo(() => {
    return filterOrdersByDate(baseFiltered, dateFilter);
  }, [baseFiltered, dateFilter]);

  // 3. Sort orders
  const filteredOrders = useMemo(() => {
    return sortOrders(dateFiltered, sortBy);
  }, [dateFiltered, sortBy]);

  // 4. Counts per day
  const countsPerDay = useMemo(() => {
    return getOrderCountsPerDay(filteredOrders);
  }, [filteredOrders]);

  const totalFilteredSales = useMemo(() => {
    return filteredOrders.reduce((sum, o) => sum + o.total, 0);
  }, [filteredOrders]);

  const pendingOrders = filteredOrders.filter((o) => o.status === 'pending');
  const preparingOrders = filteredOrders.filter((o) => o.status === 'preparing');
  const readyOrders = filteredOrders.filter((o) => o.status === 'ready');
  const completedOrders = filteredOrders.filter((o) => o.status === 'completed');

  // Map of active session ID to TableSession
  const activeSessionMap = useMemo(() => {
    const map: Record<string, TableSession> = {};
    activeSessions.forEach(s => {
      map[s.id] = s;
    });
    return map;
  }, [activeSessions]);

  // Group filtered orders by table session
  const sessionGroups = useMemo(() => {
    const groups: {
      session: TableSession | null;
      key: string;
      title: string;
      orders: Order[];
      totalAmount: number;
      itemsCount: number;
    }[] = [];

    // Grouping dictionary
    const dict: Record<string, Order[]> = {};
    const counterOrders: Order[] = [];

    filteredOrders.forEach((o) => {
      if (o.tableSessionId) {
        if (!dict[o.tableSessionId]) dict[o.tableSessionId] = [];
        dict[o.tableSessionId].push(o);
      } else {
        counterOrders.push(o);
      }
    });

    // Add active sessions (even if they have orders outside current status filter)
    activeSessions.forEach((sess) => {
      const sessOrders = dict[sess.id] || [];
      const computedTotal = sessOrders.reduce((s, o) => s + (o.status !== 'cancelled' ? o.total : 0), 0);
      const computedItems = sessOrders.reduce(
        (s, o) => s + (o.status !== 'cancelled' ? (o.items || []).reduce((a, b) => a + (b.quantity || 1), 0) : 0),
        0
      );

      groups.push({
        session: sess,
        key: sess.id,
        title: `${sess.tableName || `Table ${sess.tableId}`} • #${sess.shortId}`,
        orders: sessOrders,
        totalAmount: sess.totalAmount || computedTotal,
        itemsCount: sess.itemsCount || computedItems,
      });

      delete dict[sess.id];
    });

    // Add any remaining historical closed sessions that have orders matching the filter
    Object.keys(dict).forEach((sessId) => {
      const sessOrders = dict[sessId];
      const firstOrder = sessOrders[0];
      const computedTotal = sessOrders.reduce((s, o) => s + (o.status !== 'cancelled' ? o.total : 0), 0);
      const computedItems = sessOrders.reduce(
        (s, o) => s + (o.status !== 'cancelled' ? (o.items || []).reduce((a, b) => a + (b.quantity || 1), 0) : 0),
        0
      );

      groups.push({
        session: null,
        key: sessId,
        title: `${firstOrder?.tableName || 'Table Session'} • Closed Tab`,
        orders: sessOrders,
        totalAmount: computedTotal,
        itemsCount: computedItems,
      });
    });

    // Add Counter / Takeaway group if any exist
    if (counterOrders.length > 0) {
      groups.push({
        session: null,
        key: 'COUNTER',
        title: 'Counter & Takeaway Tickets',
        orders: counterOrders,
        totalAmount: counterOrders.reduce((s, o) => s + o.total, 0),
        itemsCount: counterOrders.reduce((s, o) => s + (o.items || []).reduce((a, b) => a + (b.quantity || 1), 0), 0),
      });
    }

    return groups;
  }, [filteredOrders, activeSessions]);

  const handleOpenEdit = (order: Order) => {
    setEditingOrder(order);
    setEditItems(JSON.parse(JSON.stringify(order.items)));
    setEditNotes(order.kitchenNotes || '');
  };

  const handleUpdateItemQuantity = (cartItemId: string, newQty: number) => {
    if (newQty <= 0) {
      setEditItems((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
    } else {
      setEditItems((prev) =>
        prev.map((i) => (i.cartItemId === cartItemId ? { ...i, quantity: newQty } : i))
      );
    }
  };

  const handleRemoveItem = (cartItemId: string) => {
    setEditItems((prev) => prev.filter((i) => i.cartItemId !== cartItemId));
  };

  const calculateEditTotal = (): number => {
    return editItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  };

  const handleSaveEdit = async () => {
    if (!editingOrder) return;
    if (editItems.length === 0) {
      alert('Order must contain at least one dish.');
      return;
    }

    setIsSavingEdit(true);
    const newTotal = calculateEditTotal();
    const delta = newTotal - editingOrder.total;

    try {
      await updateOrderItems(editingOrder.id, editItems, newTotal, editNotes.trim());
      // Sync customer spend delta if customer phone is recorded
      if (editingOrder.customerPhone && delta !== 0) {
        await updateCustomerSpendDelta(editingOrder.customerPhone, delta);
      }
      setEditingOrder(null);
    } catch (err) {
      console.error('Failed to save order edit:', err);
      alert('Could not update order items. Please try again.');
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    try {
      await confirmOrder(orderId, managerName);
    } catch (err) {
      console.error('Failed to confirm order:', err);
    }
  };

  const handleCloseSessionConfirm = async () => {
    if (!closingSession) return;
    setIsClosingAction(true);
    try {
      await closeSession(closingSession.id, managerName);
      setClosingSession(null);
    } catch (err) {
      console.error('Failed to close session:', err);
      alert('Failed to close table session. Please try again.');
    } finally {
      setIsClosingAction(false);
    }
  };

  const togglePhoneReveal = (orderId: string) => {
    setRevealedPhones((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const toggleCollapseSession = (key: string) => {
    setCollapsedSessions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const getElapsedDuration = (startedAt: string): string => {
    const diff = Math.max(0, Date.now() - new Date(startedAt).getTime());
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m seated`;
    const hrs = Math.floor(mins / 60);
    const remMins = mins % 60;
    return `${hrs}h ${remMins}m seated`;
  };

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-50 text-amber-800 border border-amber-300">
            <Clock className="w-3.5 h-3.5 text-amber-600 animate-spin" />
            Pending Confirmation
          </span>
        );
      case 'preparing':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-blue-50 text-blue-800 border border-blue-200">
            <ChefHat className="w-3.5 h-3.5 text-blue-600" />
            Preparing
          </span>
        );
      case 'ready':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-emerald-50 text-emerald-800 border border-emerald-200">
            <PackageCheck className="w-3.5 h-3.5 text-emerald-600" />
            Ready for Table
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-neutral-100 text-neutral-600 border border-neutral-200">
            <CheckCircle2 className="w-3.5 h-3.5 text-neutral-500" />
            Completed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-red-50 text-red-700 border border-red-200">
            <X className="w-3.5 h-3.5 text-red-500" />
            Cancelled
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif text-text-primary">Kitchen Dispatch & Orders</h1>
          <p className="text-sm text-text-secondary mt-1">
            Real-time table session bill consolidation, live elapsed duration, and kitchen ticket dispatch.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-right">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
              Active Supervisor
            </span>
            <span className="text-sm font-bold text-text-primary">{managerName}</span>
          </div>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-border rounded-sm p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent block mb-1">
            Active Table Sessions
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-serif font-bold text-accent">{activeSessions.length}</span>
            <span className="inline-flex items-center gap-1 text-[10px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              LIVE
            </span>
          </div>
        </div>

        <div className="bg-white border border-border rounded-sm p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 block mb-1">
            Pending Confirmation
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-serif font-bold text-amber-900">{pendingOrders.length}</span>
            <span className={`w-2.5 h-2.5 rounded-full ${pendingOrders.length > 0 ? 'bg-amber-500 animate-ping' : 'bg-neutral-300'}`}></span>
          </div>
        </div>

        <div className="bg-white border border-border rounded-sm p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 block mb-1">
            In Kitchen (Preparing)
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-serif font-bold text-blue-900">{preparingOrders.length}</span>
            <ChefHat className="w-4 h-4 text-blue-500" />
          </div>
        </div>

        <div className="bg-white border border-border rounded-sm p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 block mb-1">
            Total Tickets Filtered
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-serif font-bold text-text-primary">{filteredOrders.length}</span>
            <span className="text-xs text-text-muted font-bold font-mono">
              {formatCurrency(totalFilteredSales)}
            </span>
          </div>
        </div>
      </div>

      {/* Date Filter & Sort Bar */}
      <div className="bg-white border border-border rounded-sm p-4 mb-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Date Presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5 me-2">
              <Calendar className="w-4 h-4 text-accent" />
              <span>Date Filter:</span>
            </span>

            {DATE_PRESETS.map((preset) => {
              const isActive = dateFilter.type === preset.id;
              return (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => handleDatePresetClick(preset.id)}
                  className={`px-3.5 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all ${
                    isActive
                      ? 'bg-text-primary text-white shadow-xs'
                      : 'bg-border/20 text-text-secondary hover:bg-border/50'
                  }`}
                >
                  {preset.label}
                  {countsPerDay[preset.id] !== undefined && (
                    <span className={`ms-1.5 text-[10px] px-1.5 py-0.2 rounded-full ${
                      isActive ? 'bg-white/20 text-white' : 'bg-border text-text-primary'
                    }`}>
                      {countsPerDay[preset.id]}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Sort Selector & View Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            {/* View Mode Toggle */}
            <div className="inline-flex rounded-sm p-1 bg-border/30 border border-border">
              <button
                type="button"
                onClick={() => setViewMode('sessions')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-bold uppercase tracking-wider transition-all ${
                  viewMode === 'sessions'
                    ? 'bg-white text-text-primary shadow-xs font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <Layers className="w-3.5 h-3.5 text-accent" />
                Group by Table Session
              </button>
              <button
                type="button"
                onClick={() => setViewMode('stream')}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-sm text-xs font-bold uppercase tracking-wider transition-all ${
                  viewMode === 'stream'
                    ? 'bg-white text-text-primary shadow-xs font-bold'
                    : 'text-text-secondary hover:text-text-primary'
                }`}
              >
                <ListFilter className="w-3.5 h-3.5" />
                Ticket Stream
              </button>
            </div>

            <div className="flex items-center gap-2">
              <ArrowUpDown className="w-3.5 h-3.5 text-text-muted" />
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOptionType)}
                className="bg-bg-primary border border-border rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-text-primary focus:outline-hidden"
              >
                <option value="newest">Newest First</option>
                <option value="oldest">Oldest First</option>
                <option value="highest-amount">Highest Amount</option>
                <option value="lowest-amount">Lowest Amount</option>
              </select>
            </div>
          </div>
        </div>

        {/* Custom Date Range Picker */}
        {dateFilter.type === 'custom' && (
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-4 text-xs font-medium">
            <span className="text-text-muted uppercase tracking-wider text-[10px] font-bold flex items-center gap-1">
              <CalendarRange className="w-3.5 h-3.5" /> Custom Date Span:
            </span>
            <div className="flex items-center gap-2">
              <label className="text-text-secondary">From:</label>
              <input
                type="date"
                value={dateFilter.startDate || ''}
                onChange={(e) => setDateFilter((prev) => ({ ...prev, startDate: e.target.value }))}
                className="bg-bg-primary border border-border px-2 py-1 rounded-sm text-xs font-mono"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-text-secondary">To:</label>
              <input
                type="date"
                value={dateFilter.endDate || ''}
                onChange={(e) => setDateFilter((prev) => ({ ...prev, endDate: e.target.value }))}
                className="bg-bg-primary border border-border px-2 py-1 rounded-sm text-xs font-mono"
              />
            </div>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col md:flex-row gap-4 mb-6">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by ticket #, table, dish name, or customer phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 bg-white border border-border rounded-sm text-sm focus:outline-hidden focus:border-text-primary"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          {['all', 'pending', 'preparing', 'ready', 'completed'].map((status) => (
            <button
              key={status}
              onClick={() => setSelectedStatus(status)}
              className={`px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors ${
                selectedStatus === status
                  ? 'bg-text-primary text-white'
                  : 'bg-white border border-border text-text-secondary hover:bg-border/30'
              }`}
            >
              {status}
            </button>
          ))}
        </div>
      </div>

      {/* VIEW MODE 1: GROUP BY TABLE SESSION */}
      {viewMode === 'sessions' ? (
        <div className="space-y-6">
          {sessionGroups.length === 0 ? (
            <div className="bg-white border border-border rounded-sm p-12 text-center">
              <Users className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <h3 className="font-serif text-lg text-text-primary mb-1">No Active Table Sessions</h3>
              <p className="text-xs text-text-secondary">
                When dining parties scan table QRs and submit orders, active sessions appear here consolidated.
              </p>
            </div>
          ) : (
            sessionGroups.map((group) => {
              const session = group.session;
              const isCollapsed = Boolean(collapsedSessions[group.key]);

              return (
                <div
                  key={group.key}
                  className={`bg-white border rounded-sm shadow-xs transition-all ${
                    session?.status === 'active'
                      ? 'border-accent/60 ring-1 ring-accent/20'
                      : 'border-border'
                  }`}
                >
                  {/* Session Header Card */}
                  <div className="p-5 border-b border-border bg-[#FDFCFB]">
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left: Table Title & Session ID */}
                      <div className="flex items-start sm:items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          session?.status === 'active'
                            ? 'bg-accent/15 text-accent'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className="font-serif text-xl font-bold text-text-primary">
                              {session?.tableName || (group.key === 'COUNTER' ? 'Counter & Takeaway' : `Table ${session?.tableId || ''}`)}
                            </h3>
                            {session?.shortId && (
                              <span className="px-2.5 py-0.5 rounded-full text-xs font-mono font-bold bg-accent/20 text-accent border border-accent/30">
                                Session #{session.shortId}
                              </span>
                            )}
                            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                              session?.status === 'active'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-neutral-100 text-neutral-600'
                            }`}>
                              {session?.status === 'active' ? 'Active Table' : (group.key === 'COUNTER' ? 'Quick Service' : 'Closed Tab')}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-3 text-xs text-text-secondary mt-1">
                            {session?.startedAt && (
                              <span className="flex items-center gap-1 font-medium">
                                <Clock className="w-3.5 h-3.5 text-text-muted" />
                                Started {new Date(session.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            {session?.startedAt && session.status === 'active' && (
                              <span className="px-2 py-0.5 rounded-sm bg-amber-50 text-amber-800 font-bold border border-amber-200 text-[11px]">
                                ⏳ {getElapsedDuration(session.startedAt)}
                              </span>
                            )}
                            {session?.createdByPhone && (
                              <span className="flex items-center gap-1 text-text-muted">
                                <Phone className="w-3 h-3" />
                                Host: {maskPhone(session.createdByPhone)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Right: Consolidated Totals & Actions */}
                      <div className="flex items-center gap-4 flex-wrap justify-between lg:justify-end">
                        <div className="text-right">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                            Consolidated Tab ({group.itemsCount} dishes)
                          </span>
                          <span className="text-xl font-serif font-bold text-text-primary">
                            {formatCurrency(group.totalAmount)}
                          </span>
                          <span className="text-[10px] text-text-secondary block">
                            {group.orders.length} sub-order{group.orders.length !== 1 ? 's' : ''} submitted
                          </span>
                        </div>

                        {/* Close Session Button (only for active sessions) */}
                        {session && session.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => setClosingSession(session)}
                            className="bg-text-primary text-white hover:bg-black px-4 py-2.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-1.5 shadow-xs"
                          >
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                            Close Session
                          </button>
                        )}

                        {/* Accordion toggle */}
                        <button
                          type="button"
                          onClick={() => toggleCollapseSession(group.key)}
                          className="p-2 text-text-muted hover:text-text-primary rounded-sm transition-colors"
                          title="Toggle sub-orders list"
                        >
                          {isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Sub-Orders List for this session */}
                  {!isCollapsed && (
                    <div className="p-5 bg-white">
                      {group.orders.length === 0 ? (
                        <p className="text-xs text-text-muted italic py-4 text-center">
                          No sub-orders currently match the selected status filter.
                        </p>
                      ) : (
                        <div className="space-y-4">
                          <span className="text-[10px] font-bold uppercase tracking-widest text-text-muted block">
                            Sub-Orders Placed in this Session ({group.orders.length})
                          </span>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {group.orders.map((order) => (
                              <div
                                key={order.id}
                                className="border border-border/70 rounded-sm p-4 bg-[#FAF9F8] flex flex-col justify-between"
                              >
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-mono font-bold text-sm text-text-primary">
                                        #{order.id}
                                      </span>
                                      <span className="text-xs text-text-muted">
                                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                      </span>
                                    </div>
                                    <div>{getStatusBadge(order.status)}</div>
                                  </div>

                                  {/* Guest Phone Info */}
                                  {order.customerPhone && (
                                    <div className="flex items-center gap-2 text-xs text-text-secondary mb-3">
                                      <Phone className="w-3.5 h-3.5 text-text-muted" />
                                      <span>
                                        {revealedPhones[order.id] ? order.customerPhone : maskPhone(order.customerPhone)}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => togglePhoneReveal(order.id)}
                                        className="text-[10px] text-accent font-bold uppercase underline"
                                      >
                                        {revealedPhones[order.id] ? 'Hide' : 'Reveal'}
                                      </button>
                                    </div>
                                  )}

                                  {/* Dish Items */}
                                  <div className="space-y-1.5 mb-3 border-t border-border/40 pt-2">
                                    {order.items.map((item) => (
                                      <div key={item.cartItemId} className="flex justify-between items-center text-xs">
                                        <span className="text-text-primary font-medium">
                                          {item.quantity}x {item.name}
                                        </span>
                                        <span className="text-text-secondary">
                                          {formatCurrency(item.price * item.quantity)}
                                        </span>
                                      </div>
                                    ))}
                                  </div>

                                  {order.kitchenNotes && (
                                    <div className="p-2 rounded bg-amber-50/70 border border-amber-200 text-xs text-amber-900 mb-3">
                                      <span className="font-bold">Note: </span>
                                      <span>{order.kitchenNotes}</span>
                                    </div>
                                  )}
                                </div>

                                {/* Order Action Buttons */}
                                <div className="border-t border-border/50 pt-3 flex items-center justify-between gap-2">
                                  <span className="font-bold text-sm text-text-primary">
                                    {formatCurrency(order.total)}
                                  </span>

                                  <div className="flex items-center gap-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenEdit(order)}
                                      className="p-1.5 text-text-secondary hover:text-text-primary border border-border rounded-sm hover:bg-white text-xs"
                                      title="Edit Order Dishes"
                                    >
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>

                                    {order.status === 'pending' && (
                                      <button
                                        type="button"
                                        onClick={() => handleConfirmOrder(order.id)}
                                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors"
                                      >
                                        Confirm
                                      </button>
                                    )}

                                    {order.status === 'preparing' && (
                                      <button
                                        type="button"
                                        onClick={() => updateOrderStatus(order.id, 'ready')}
                                        className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors"
                                      >
                                        Mark Ready
                                      </button>
                                    )}

                                    {order.status === 'ready' && (
                                      <button
                                        type="button"
                                        onClick={() => updateOrderStatus(order.id, 'completed')}
                                        className="bg-text-primary hover:bg-black text-white px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors"
                                      >
                                        Served
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : (
        /* VIEW MODE 2: TRADITIONAL TICKET STREAM */
        <div className="space-y-4">
          {filteredOrders.length === 0 ? (
            <div className="bg-white border border-border rounded-sm p-12 text-center">
              <Receipt className="w-10 h-10 text-text-muted mx-auto mb-3" />
              <h3 className="font-serif text-lg text-text-primary mb-1">No Orders Found</h3>
              <p className="text-xs text-text-secondary">Try adjusting your filters or date range.</p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const linkedSession = order.tableSessionId ? activeSessionMap[order.tableSessionId] : null;

              return (
                <div
                  key={order.id}
                  className="bg-white border border-border rounded-sm p-6 shadow-xs hover:border-text-secondary transition-colors"
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-4 pb-4 border-b border-border">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-xl font-bold text-text-primary">
                        #{order.id}
                      </span>
                      <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-border/20 border border-border text-text-primary">
                        <span>{order.tableId && order.tableId !== 'COUNTER' ? `Table ${order.tableId}` : 'Counter'}</span>
                      </div>
                      {order.tableSessionId && (
                        <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-accent/15 text-accent border border-accent/30">
                          Session #{linkedSession?.shortId || order.tableSessionId.substring(order.tableSessionId.length - 4).toUpperCase()}
                        </span>
                      )}
                      <div>{getStatusBadge(order.status)}</div>
                    </div>

                    <div className="flex items-center gap-4 text-xs text-text-secondary">
                      <span>{new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      <span className="text-xl font-serif font-bold text-text-primary">
                        {formatCurrency(order.total)}
                      </span>
                    </div>
                  </div>

                  {/* Customer Phone Information */}
                  {order.customerPhone && (
                    <div className="mb-4 flex items-center gap-2 text-xs text-text-secondary">
                      <Phone className="w-3.5 h-3.5 text-text-muted" />
                      <span>Customer: </span>
                      <span className="font-mono font-semibold text-text-primary">
                        {revealedPhones[order.id] ? order.customerPhone : maskPhone(order.customerPhone)}
                      </span>
                      <button
                        type="button"
                        onClick={() => togglePhoneReveal(order.id)}
                        className="text-[10px] text-accent font-bold uppercase underline ms-1"
                      >
                        {revealedPhones[order.id] ? 'Hide' : 'Reveal'}
                      </button>
                    </div>
                  )}

                  {/* Items list */}
                  <div className="space-y-2 mb-4">
                    {order.items.map((item) => (
                      <div key={item.cartItemId} className="flex justify-between items-center text-sm">
                        <span className="text-text-primary font-medium">
                          {item.quantity}x {item.name}
                        </span>
                        <span className="text-text-secondary">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  {order.kitchenNotes && (
                    <div className="p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 mb-4">
                      <span className="font-bold">Kitchen Instructions: </span>
                      <span>{order.kitchenNotes}</span>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-4 border-t border-border">
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(order)}
                      className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary border border-border px-3 py-1.5 rounded-sm"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      Edit Dishes
                    </button>

                    <div className="flex items-center gap-2">
                      {order.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => handleConfirmOrder(order.id)}
                          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider"
                        >
                          Confirm Order
                        </button>
                      )}
                      {order.status === 'preparing' && (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(order.id, 'ready')}
                          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider"
                        >
                          Mark Ready
                        </button>
                      )}
                      {order.status === 'ready' && (
                        <button
                          type="button"
                          onClick={() => updateOrderStatus(order.id, 'completed')}
                          className="bg-text-primary hover:bg-black text-white px-4 py-2 rounded-sm text-xs font-bold uppercase tracking-wider"
                        >
                          Mark Served
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Close Session Confirmation Modal */}
      {closingSession && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm max-w-md w-full p-6 shadow-xl border border-border animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div className="flex items-center gap-2 text-text-primary">
                <Lock className="w-5 h-5 text-accent" />
                <h3 className="font-serif text-xl font-bold">Close Table Session</h3>
              </div>
              <button
                type="button"
                onClick={() => setClosingSession(null)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 mb-6">
              <p className="text-sm text-text-secondary">
                Are you sure you want to close and settle the consolidated tab for{' '}
                <span className="font-bold text-text-primary">{closingSession.tableName}</span> (Session #{closingSession.shortId})?
              </p>

              <div className="bg-bg-primary p-4 rounded-sm border border-border space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Table:</span>
                  <span className="font-semibold text-text-primary">{closingSession.tableName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Session Started:</span>
                  <span className="font-semibold text-text-primary">
                    {new Date(closingSession.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Elapsed Dining Time:</span>
                  <span className="font-semibold text-text-primary">
                    {getElapsedDuration(closingSession.startedAt)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Total Dishes Served:</span>
                  <span className="font-semibold text-text-primary">{closingSession.itemsCount} items</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between text-sm">
                  <span className="font-bold text-text-primary">Final Consolidated Bill:</span>
                  <span className="font-serif font-bold text-text-primary text-base">
                    {formatCurrency(closingSession.totalAmount)}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-text-muted italic">
                Closing will archive this session. Any subsequent order scanned from this table will automatically open a fresh session.
              </p>
            </div>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setClosingSession(null)}
                disabled={isClosingAction}
                className="px-4 py-2 border border-border rounded-sm text-xs font-bold uppercase tracking-wider text-text-secondary hover:bg-border/30"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleCloseSessionConfirm}
                disabled={isClosingAction}
                className="px-5 py-2 bg-text-primary hover:bg-black text-white rounded-sm text-xs font-bold uppercase tracking-wider shadow-xs flex items-center gap-1.5"
              >
                {isClosingAction ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Closing Tab...
                  </>
                ) : (
                  <>
                    <Lock className="w-3.5 h-3.5 text-amber-400" />
                    Confirm & Close Session
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm max-w-lg w-full p-6 shadow-xl border border-border">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div>
                <h3 className="font-serif text-xl font-bold">Edit Order Dishes</h3>
                <span className="text-xs text-text-muted font-mono">Ticket #{editingOrder.id}</span>
              </div>
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto space-y-3 mb-4 pe-1">
              {editItems.map((item) => (
                <div key={item.cartItemId} className="flex items-center justify-between border-b border-border/40 pb-2">
                  <div>
                    <span className="text-sm font-semibold text-text-primary block">{item.name}</span>
                    <span className="text-xs text-text-muted">{formatCurrency(item.price)} each</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleUpdateItemQuantity(item.cartItemId, item.quantity - 1)}
                      className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-border/30"
                    >
                      <Minus className="w-3 h-3" />
                    </button>
                    <span className="text-sm font-bold w-6 text-center">{item.quantity}</span>
                    <button
                      type="button"
                      onClick={() => handleUpdateItemQuantity(item.cartItemId, item.quantity + 1)}
                      className="w-7 h-7 rounded border border-border flex items-center justify-center hover:bg-border/30"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.cartItemId)}
                      className="text-red-500 hover:text-red-700 ms-1"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="mb-4">
              <label className="text-xs font-bold uppercase tracking-wider text-text-secondary block mb-1">
                Kitchen Instructions / Special Prep Note
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="e.g. Extra spicy, dressing on the side, no onions..."
                rows={2}
                className="w-full text-xs p-2 border border-border rounded-sm bg-bg-primary focus:outline-hidden"
              />
            </div>

            <div className="flex items-center justify-between border-t border-border pt-4">
              <div>
                <span className="text-xs text-text-muted block">Updated Ticket Total:</span>
                <span className="text-lg font-serif font-bold text-text-primary">
                  {formatCurrency(calculateEditTotal())}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setEditingOrder(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 border border-border rounded-sm text-xs font-bold uppercase tracking-wider"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSavingEdit}
                  className="px-4 py-2 bg-text-primary text-white rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-black flex items-center gap-1.5"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingEdit ? 'Saving...' : 'Save & Sync Tab'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
