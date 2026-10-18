import React, { useState, useMemo } from 'react';
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
  Filter
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

  const togglePhoneReveal = (orderId: string) => {
    setRevealedPhones((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
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
            Review, modify item quantities, and confirm pending table orders to the kitchen line.
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
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Ready to Serve
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-serif font-bold text-emerald-900">{readyOrders.length}</span>
            <PackageCheck className="w-4 h-4 text-emerald-500" />
          </div>
        </div>

        <div className="bg-white border border-border rounded-sm p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-neutral-600 block mb-1">
            Total Tickets
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-serif font-bold text-text-primary">{orders.length}</span>
            <span className="text-xs text-text-muted font-bold font-mono">LIVE</span>
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
                      : 'bg-bg-primary text-text-secondary hover:text-text-primary hover:bg-neutral-200/70 border border-border/60'
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Custom Date Range Pickers (shown when custom is selected) */}
            {dateFilter.type === 'custom' && (
              <div className="flex items-center gap-2 bg-bg-primary p-2 rounded-sm border border-border text-xs animate-in fade-in duration-150">
                <CalendarRange className="w-4 h-4 text-text-muted shrink-0" />
                <input
                  type="date"
                  value={dateFilter.startDate || ''}
                  onChange={(e) =>
                    setDateFilter(prev => ({ ...prev, startDate: e.target.value }))
                  }
                  className="bg-white border border-border px-2.5 py-1 rounded-sm text-xs text-text-primary outline-none focus:border-text-secondary"
                  aria-label="Start Date"
                />
                <span className="text-text-muted font-bold">—</span>
                <input
                  type="date"
                  value={dateFilter.endDate || ''}
                  onChange={(e) =>
                    setDateFilter(prev => ({ ...prev, endDate: e.target.value }))
                  }
                  className="bg-white border border-border px-2.5 py-1 rounded-sm text-xs text-text-primary outline-none focus:border-text-secondary"
                  aria-label="End Date"
                />
              </div>
            )}

            {/* Sort Dropdown: Newest first / Oldest first / Total High-Low */}
            <div className="flex items-center gap-2 bg-bg-primary border border-border px-3 py-1.5 rounded-sm shadow-2xs">
              <ArrowUpDown className="w-4 h-4 text-text-muted" />
              <label htmlFor="sort-dropdown-mgr" className="text-xs font-bold uppercase tracking-wider text-text-secondary whitespace-nowrap">
                Sort:
              </label>
              <select
                id="sort-dropdown-mgr"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOptionType)}
                className="bg-transparent text-xs font-medium text-text-primary outline-none cursor-pointer"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="total-high-low">Total High-Low</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Status Filters and Search Bar */}
      <div className="bg-white border border-border rounded-sm p-4 mb-4 shadow-xs flex flex-col md:flex-row gap-4 items-center justify-between">
        {/* Status Tab Buttons */}
        <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
          {[
            { id: 'all', label: `All (${filteredOrders.length})` },
            { id: 'pending', label: `Pending (${pendingOrders.length})` },
            { id: 'preparing', label: `Preparing (${preparingOrders.length})` },
            { id: 'ready', label: `Ready (${readyOrders.length})` },
            { id: 'completed', label: `Completed (${completedOrders.length})` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setSelectedStatus(tab.id)}
              className={`px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-colors ${
                selectedStatus === tab.id
                  ? 'bg-text-primary text-white shadow-xs'
                  : 'bg-bg-primary text-text-secondary hover:text-text-primary hover:bg-neutral-200/70'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search order #, table, dish, phone..."
            className="w-full text-xs px-3 py-2 ps-9 border border-border rounded-sm bg-bg-primary text-text-primary focus:outline-none focus:border-text-primary"
          />
          <Search className="w-4 h-4 text-text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
        </div>
      </div>

      {/* Active Filter Chips & Counts Per Day Bar */}
      <div className="bg-white border border-border rounded-sm p-4 mb-6 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-border/60 pb-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Active Filters:
            </span>

            {/* Date Chip */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-accent/10 text-accent border border-accent/20">
              <Calendar className="w-3.5 h-3.5" />
              <span>
                {dateFilter.type === 'today' && 'Today'}
                {dateFilter.type === '7days' && 'Last 7 days'}
                {dateFilter.type === '30days' && 'Last 30 days'}
                {dateFilter.type === 'custom' && `${dateFilter.startDate || 'Start'} to ${dateFilter.endDate || 'End'}`}
                {dateFilter.type === 'all' && 'All Time'}
              </span>
            </span>

            {/* Status Chip */}
            {selectedStatus !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 capitalize">
                <Filter className="w-3.5 h-3.5" />
                <span>Status: {selectedStatus}</span>
              </span>
            )}

            {/* Sort Chip */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700 border border-border">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>
                {sortBy === 'newest' && 'Newest first'}
                {sortBy === 'oldest' && 'Oldest first'}
                {sortBy === 'total-high-low' && 'Total High-Low'}
              </span>
            </span>

            {/* Total Results */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-text-primary text-white">
              <Receipt className="w-3.5 h-3.5" />
              <span>{filteredOrders.length} {filteredOrders.length === 1 ? 'Ticket' : 'Tickets'}</span>
            </span>

            {/* Volume */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>{formatCurrency(totalFilteredSales)}</span>
            </span>
          </div>

          {(dateFilter.type !== 'today' || selectedStatus !== 'all' || sortBy !== 'newest' || searchQuery) && (
            <button
              type="button"
              onClick={() => {
                handleDatePresetClick('today');
                setSelectedStatus('all');
                setSortBy('newest');
                setSearchQuery('');
              }}
              className="text-[10px] font-bold uppercase tracking-wider text-accent hover:underline cursor-pointer"
            >
              Reset Filters
            </button>
          )}
        </div>

        {/* Counts Per Day Chips */}
        <div>
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-2">
            Counts Per Day:
          </span>
          <div className="flex flex-wrap items-center gap-2">
            {Object.keys(countsPerDay).length === 0 ? (
              <span className="text-xs text-text-muted italic">No orders found for the selected date range</span>
            ) : (
              Object.entries(countsPerDay).map(([dateStr, count]) => (
                <span
                  key={dateStr}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-sm text-xs font-medium bg-bg-primary text-text-primary border border-border shadow-2xs"
                >
                  <Calendar className="w-3.5 h-3.5 text-accent" />
                  <span className="font-semibold">{dateStr}:</span>
                  <span className="px-2 py-0.5 rounded-full bg-text-primary text-white text-[10px] font-bold">
                    {count} {count === 1 ? 'order' : 'orders'}
                  </span>
                </span>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Order Cards Grid */}
      {filteredOrders.length === 0 ? (
        <div className="bg-white border border-border rounded-sm p-12 text-center text-text-secondary">
          <ChefHat className="w-10 h-10 text-text-muted mx-auto mb-3" />
          <h3 className="text-lg font-serif text-text-primary mb-1">No Orders Found</h3>
          <p className="text-xs text-text-secondary">
            {selectedStatus !== 'all'
              ? `There are no orders with status "${selectedStatus}".`
              : 'Waiting for guests to place orders.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.map((order) => {
            const isPending = order.status === 'pending';
            const isPreparing = order.status === 'preparing';
            const isReady = order.status === 'ready';
            const isRevealed = Boolean(revealedPhones[order.id]);

            return (
              <div
                key={order.id}
                className={`bg-white border rounded-sm p-5 shadow-sm flex flex-col justify-between transition-all ${
                  isPending
                    ? 'border-amber-400 ring-2 ring-amber-400/20 bg-amber-50/10'
                    : 'border-border hover:border-text-primary/40'
                }`}
              >
                <div>
                  {/* Top Card Bar */}
                  <div className="flex items-start justify-between gap-2 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-base font-bold text-text-primary">
                          #{order.id}
                        </span>
                        <span className="px-2 py-0.5 rounded-sm bg-neutral-100 border border-neutral-200 text-xs font-bold text-text-primary">
                          {order.tableId && order.tableId !== 'COUNTER'
                            ? `Table ${order.tableId}`
                            : 'Counter'}
                        </span>
                      </div>
                      <span className="text-[10px] text-text-muted flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3" />
                        {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div>{getStatusBadge(order.status)}</div>
                  </div>

                  {/* Customer Phone Bar */}
                  {order.customerPhone && (
                    <div className="mb-3 px-2.5 py-1.5 bg-bg-primary rounded-sm border border-border/60 flex items-center justify-between text-xs">
                      <div className="flex items-center gap-1.5 text-text-secondary">
                        <Phone className="w-3 h-3 text-accent" />
                        <span className="font-mono font-medium">
                          {isRevealed ? order.customerPhone : maskPhone(order.customerPhone)}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => togglePhoneReveal(order.id)}
                        className="text-[10px] font-bold text-accent hover:underline uppercase"
                      >
                        {isRevealed ? 'Hide' : 'Reveal'}
                      </button>
                    </div>
                  )}

                  {/* Manager Confirmation Badge */}
                  {order.managerConfirmed && (
                    <div className="mb-3 px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-[10px] text-emerald-900 flex items-center gap-1">
                      <UserCheck className="w-3 h-3 text-emerald-600" />
                      <span>
                        Confirmed by <strong>{order.managerConfirmedBy || 'Kitchen'}</strong> at{' '}
                        {order.managerConfirmedAt ? new Date(order.managerConfirmedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                      </span>
                    </div>
                  )}

                  {/* Kitchen Notes */}
                  {order.kitchenNotes && (
                    <div className="mb-3 px-2.5 py-1.5 bg-amber-50 border border-amber-200/80 rounded text-xs text-amber-900 flex items-start gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-amber-700 shrink-0 mt-0.5" />
                      <div className="leading-snug">
                        <span className="font-bold text-[10px] uppercase tracking-wider block text-amber-800">
                          Kitchen Note:
                        </span>
                        <span>{order.kitchenNotes}</span>
                      </div>
                    </div>
                  )}

                  {/* Ordered Items Table */}
                  <div className="border-t border-b border-border/60 py-3 my-3 space-y-2">
                    {order.items.map((item) => (
                      <div key={item.cartItemId} className="flex justify-between items-center text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-bold text-accent w-5">{item.quantity}x</span>
                          <span className="font-medium text-text-primary">{item.name}</span>
                        </div>
                        <span className="font-mono text-text-secondary">
                          {formatCurrency(item.price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center text-sm font-bold text-text-primary mb-4">
                    <span>Total Ticket</span>
                    <span className="font-serif text-lg">{formatCurrency(order.total)}</span>
                  </div>
                </div>

                {/* Manager Action Buttons */}
                <div className="pt-2 border-t border-border/50 flex flex-col gap-2">
                  {isPending && (
                    <button
                      onClick={() => handleConfirmOrder(order.id)}
                      className="w-full bg-emerald-600 text-white py-2 px-4 rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-emerald-700 transition-colors flex items-center justify-center gap-1.5 shadow-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Confirm & Send to Kitchen</span>
                    </button>
                  )}

                  <div className="flex items-center gap-2">
                    {/* Edit items button */}
                    <button
                      onClick={() => handleOpenEdit(order)}
                      className="flex-1 py-1.5 px-3 border border-border rounded-sm text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary hover:bg-neutral-50 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      <span>Edit Ticket</span>
                    </button>

                    {/* Status progression buttons */}
                    {isPreparing && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'ready')}
                        className="flex-1 py-1.5 px-3 bg-blue-600 text-white rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-blue-700 transition-colors flex items-center justify-center gap-1 shadow-xs"
                      >
                        <PackageCheck className="w-3.5 h-3.5" />
                        <span>Mark Ready</span>
                      </button>
                    )}

                    {isReady && (
                      <button
                        onClick={() => updateOrderStatus(order.id, 'completed')}
                        className="flex-1 py-1.5 px-3 bg-neutral-800 text-white rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-black transition-colors flex items-center justify-center gap-1 shadow-xs"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Complete</span>
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Ticket Modal */}
      {editingOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-md border border-border max-w-lg w-full p-6 shadow-xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-border">
              <div>
                <h3 className="font-serif text-xl text-text-primary">
                  Edit Ticket #{editingOrder.id}
                </h3>
                <span className="text-xs text-text-secondary">
                  {editingOrder.tableId && editingOrder.tableId !== 'COUNTER'
                    ? `Table ${editingOrder.tableId}`
                    : 'Counter'}
                </span>
              </div>
              <button
                onClick={() => setEditingOrder(null)}
                className="p-1 text-text-muted hover:text-text-primary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Editable Items */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                Adjust Dish Quantities
              </span>
              {editItems.map((item) => (
                <div
                  key={item.cartItemId}
                  className="flex items-center justify-between p-2.5 bg-bg-primary rounded-sm border border-border/60"
                >
                  <div className="flex-1">
                    <span className="font-medium text-sm text-text-primary block">{item.name}</span>
                    <span className="text-xs text-text-secondary font-mono">
                      {formatCurrency(item.price)} each
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <div className="flex items-center border border-border rounded bg-white">
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQuantity(item.cartItemId, item.quantity - 1)}
                        className="p-1 hover:bg-neutral-100 text-text-secondary"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>
                      <span className="w-8 text-center text-xs font-bold font-mono">{item.quantity}</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateItemQuantity(item.cartItemId, item.quantity + 1)}
                        className="p-1 hover:bg-neutral-100 text-text-secondary"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveItem(item.cartItemId)}
                      className="p-1.5 text-text-muted hover:text-red-600 transition-colors"
                      title="Remove dish from ticket"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              {/* Kitchen Notes Input */}
              <div className="pt-2">
                <label className="block text-[10px] font-bold uppercase tracking-wider text-text-secondary mb-1">
                  Kitchen Notes & Special Instructions
                </label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="e.g. Allergies, cooking preference, extra sauce..."
                  rows={2}
                  className="w-full text-xs p-2.5 border border-border rounded-sm bg-bg-primary text-text-primary focus:outline-none focus:border-text-primary"
                />
              </div>

              {/* Adjusted Total & Delta */}
              <div className="p-3 bg-neutral-50 border border-neutral-200 rounded-sm flex items-center justify-between">
                <div>
                  <span className="text-xs text-text-secondary block">New Total:</span>
                  <span className="text-xl font-serif font-bold text-text-primary">
                    {formatCurrency(calculateEditTotal())}
                  </span>
                </div>
                {calculateEditTotal() !== editingOrder.total && (
                  <span className={`text-xs font-mono font-bold px-2 py-1 rounded ${
                    calculateEditTotal() > editingOrder.total
                      ? 'bg-blue-100 text-blue-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}>
                    Delta: {calculateEditTotal() > editingOrder.total ? '+' : ''}
                    {formatCurrency(calculateEditTotal() - editingOrder.total)}
                  </span>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditingOrder(null)}
                className="px-4 py-2 border border-border rounded-sm text-xs font-bold uppercase tracking-wider text-text-secondary hover:bg-bg-primary"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSavingEdit || editItems.length === 0}
                onClick={handleSaveEdit}
                className="px-5 py-2 bg-text-primary text-white rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-[#333] transition-colors flex items-center gap-1.5 shadow-xs disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingEdit ? 'Saving...' : 'Save Ticket Changes'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
