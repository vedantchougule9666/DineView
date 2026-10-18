import React, { useState, useMemo } from 'react';
import { useOrder, OrderStatus } from '../../context/OrderContext';
import { useTable } from '../../context/TableContext';
import { formatCurrency } from '../../utils/currency';
import { 
  Filter, 
  ArrowUpDown, 
  Calendar, 
  Clock, 
  CalendarRange, 
  ChevronRight,
  TrendingUp,
  Receipt
} from 'lucide-react';
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

export default function OrderManager() {
  const { orders, updateOrderStatus } = useOrder();
  const { allTables } = useTable();

  // Date and Sort filter states
  const [dateFilter, setDateFilter] = useState<DateFilterState>({
    type: 'today',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });
  const [sortBy, setSortBy] = useState<SortOptionType>('newest');
  const [tableFilter, setTableFilter] = useState<string>('all');

  const statuses: OrderStatus[] = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

  // Combine tables from table context and existing orders
  const availableTableIds = Array.from(
    new Set([
      ...allTables.map(t => t.id),
      ...orders.map(o => o.tableId).filter((id): id is string => Boolean(id && id !== 'COUNTER'))
    ])
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

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

  // 1. Filter by Table
  const tableFiltered = useMemo(() => {
    return orders.filter((order) => {
      if (tableFilter === 'all') return true;
      if (tableFilter === 'COUNTER') {
        return !order.tableId || order.tableId === 'COUNTER';
      }
      return order.tableId === tableFilter;
    });
  }, [orders, tableFilter]);

  // 2. Filter by Date (applied to orders by createdAt)
  const dateFiltered = useMemo(() => {
    return filterOrdersByDate(tableFiltered, dateFilter);
  }, [tableFiltered, dateFilter]);

  // 3. Sort orders
  const sortedOrders = useMemo(() => {
    return sortOrders(dateFiltered, sortBy);
  }, [dateFiltered, sortBy]);

  // 4. Calculate counts per day
  const countsPerDay = useMemo(() => {
    return getOrderCountsPerDay(sortedOrders);
  }, [sortedOrders]);

  // Total sales for current filtered orders
  const totalSales = useMemo(() => {
    return sortedOrders.reduce((sum, o) => sum + o.total, 0);
  }, [sortedOrders]);

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-serif text-text-primary">Order Management</h1>
          <p className="text-sm text-text-secondary mt-1">
            Track, filter, and update dine-in table and counter orders in real time.
          </p>
        </div>

        {/* Controls: Table Filter & Sort Dropdown */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Table Filter */}
          <div className="flex items-center gap-2 bg-white border border-border px-3 py-2 rounded-sm shadow-xs">
            <Filter className="w-4 h-4 text-text-muted" />
            <label htmlFor="table-filter" className="text-xs font-bold uppercase tracking-wider text-text-secondary whitespace-nowrap">
              Table:
            </label>
            <select
              id="table-filter"
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="bg-transparent text-xs font-medium text-text-primary outline-none cursor-pointer"
            >
              <option value="all">All Tables ({orders.length})</option>
              <option value="COUNTER">Counter</option>
              {availableTableIds.map((tid) => {
                const matchedTable = allTables.find((t) => t.id === tid);
                const label = matchedTable ? `${matchedTable.name} (${tid})` : `Table ${tid}`;
                return (
                  <option key={tid} value={tid}>
                    {label}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Sort Dropdown: Newest first / Oldest first / Total High-Low */}
          <div className="flex items-center gap-2 bg-white border border-border px-3 py-2 rounded-sm shadow-xs">
            <ArrowUpDown className="w-4 h-4 text-text-muted" />
            <label htmlFor="sort-order" className="text-xs font-bold uppercase tracking-wider text-text-secondary whitespace-nowrap">
              Sort:
            </label>
            <select
              id="sort-order"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOptionType)}
              className="bg-transparent text-xs font-medium text-text-primary outline-none cursor-pointer font-sans"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="total-high-low">Total High-Low</option>
            </select>
          </div>
        </div>
      </div>

      {/* Date Filter Bar */}
      <div className="bg-white border border-border rounded-sm p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5 me-2">
              <Calendar className="w-4 h-4 text-accent" />
              <span>Date Filter:</span>
            </span>

            {/* Presets: Today, Last 7 days, Last 30 days, Custom range, All Time */}
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

          {/* Custom Date Range Pickers (shown when custom is selected) */}
          {dateFilter.type === 'custom' && (
            <div className="flex flex-wrap items-center gap-2 bg-bg-primary p-2 rounded-sm border border-border animate-in fade-in duration-150">
              <CalendarRange className="w-4 h-4 text-text-muted shrink-0" />
              <div className="flex items-center gap-2 text-xs">
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
            </div>
          )}
        </div>
      </div>

      {/* Table Summary Bar & Filter Chips & Counts Per Day */}
      <div className="bg-white border border-border rounded-sm p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 text-xs border-b border-border/60 pb-3">
          {/* Active Filter Chips */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted">
              Active Filters:
            </span>
            
            {/* Date filter chip */}
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

            {/* Table filter chip */}
            {tableFilter !== 'all' && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                <Filter className="w-3.5 h-3.5" />
                <span>Table: {tableFilter}</span>
              </span>
            )}

            {/* Sort chip */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700 border border-border">
              <ArrowUpDown className="w-3.5 h-3.5" />
              <span>
                {sortBy === 'newest' && 'Newest first'}
                {sortBy === 'oldest' && 'Oldest first'}
                {sortBy === 'total-high-low' && 'Total High-Low'}
              </span>
            </span>

            {/* Total Results Chip */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-text-primary text-white">
              <Receipt className="w-3.5 h-3.5" />
              <span>{sortedOrders.length} {sortedOrders.length === 1 ? 'Order' : 'Orders'}</span>
            </span>

            {/* Total Volume */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>{formatCurrency(totalSales)}</span>
            </span>
          </div>

          {/* Quick reset */}
          {(dateFilter.type !== 'today' || tableFilter !== 'all' || sortBy !== 'newest') && (
            <button
              type="button"
              onClick={() => {
                handleDatePresetClick('today');
                setTableFilter('all');
                setSortBy('newest');
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

      {/* Orders Table */}
      <div className="bg-white border border-border rounded-sm overflow-hidden shadow-xs">
        {sortedOrders.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">
            <p className="font-serif text-lg mb-1">No orders found</p>
            <p className="text-xs text-text-muted">
              {orders.length === 0 
                ? 'No orders have been recorded yet.' 
                : 'No orders matched the selected date and table filters.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-bg-primary border-b border-border text-xs uppercase tracking-widest text-text-muted">
              <tr>
                <th className="px-6 py-4 font-bold">Order ID</th>
                <th className="px-6 py-4 font-bold">Table</th>
                <th className="px-6 py-4 font-bold">Date & Time</th>
                <th className="px-6 py-4 font-bold">Items</th>
                <th className="px-6 py-4 font-bold">Total</th>
                <th className="px-6 py-4 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {sortedOrders.map(order => {
                const dateObj = new Date(order.createdAt);
                const formattedDate = dateObj.toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                });
                const formattedTime = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <tr key={order.id} className="hover:bg-bg-primary/50 transition-colors">
                    <td className="px-6 py-4 font-medium text-text-primary">
                      <span className="font-mono text-xs">#{order.id}</span>
                      {order.customerPhone && (
                        <span className="block text-[11px] text-text-muted mt-0.5">
                          {order.customerPhone}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {order.tableId && order.tableId !== 'COUNTER' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                          Table {order.tableId}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-neutral-100 text-neutral-600 border border-neutral-200">
                          Counter
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-xs text-text-secondary whitespace-nowrap">
                      <div className="flex items-center gap-1 text-text-primary font-medium">
                        <Clock className="w-3.5 h-3.5 text-text-muted" />
                        <span>{formattedTime}</span>
                      </div>
                      <span className="text-[11px] text-text-muted block mt-0.5">{formattedDate}</span>
                    </td>
                    <td className="px-6 py-4 text-sm text-text-secondary max-w-xs">
                      <div className="line-clamp-2">
                        {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm font-semibold text-text-primary whitespace-nowrap">
                      {formatCurrency(order.total)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <select
                        value={order.status}
                        onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                        className={`text-xs font-bold uppercase tracking-wider px-3 py-1.5 rounded-sm outline-none cursor-pointer border ${
                          order.status === 'completed' ? 'border-green-200 bg-green-50 text-green-700' :
                          order.status === 'cancelled' ? 'border-red-200 bg-red-50 text-red-700' :
                          order.status === 'ready' ? 'border-blue-200 bg-blue-50 text-blue-700' :
                          'border-orange-200 bg-orange-50 text-orange-700'
                        }`}
                      >
                        {statuses.map(status => (
                          <option key={status} value={status} className="bg-white text-text-primary">
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
