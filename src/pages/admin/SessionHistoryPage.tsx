import React, { useState, useEffect, useMemo } from 'react';
import { 
  Users, 
  Calendar, 
  CalendarRange, 
  Clock, 
  Receipt, 
  TrendingUp, 
  Filter, 
  CheckCircle2, 
  Lock, 
  Eye, 
  X, 
  Phone, 
  Layers, 
  RefreshCw 
} from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { maskPhone } from '../../services/customerService';
import { TableSession, fetchSessionHistory } from '../../services/sessionService';
import { useOrder, Order } from '../../context/OrderContext';
import { useTable } from '../../context/TableContext';
import { DateFilterState, DateFilterType } from '../../utils/orderFilters';

const DATE_PRESETS: { id: DateFilterType; label: string }[] = [
  { id: 'today', label: 'Today' },
  { id: '7days', label: 'Last 7 days' },
  { id: '30days', label: 'Last 30 days' },
  { id: 'custom', label: 'Custom range' },
  { id: 'all', label: 'All Time' },
];

export default function SessionHistoryPage() {
  const { orders } = useOrder();
  const { allTables } = useTable();
  const [sessions, setSessions] = useState<TableSession[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'closed'>('all');
  const [tableFilter, setTableFilter] = useState<string>('all');
  const [dateFilter, setDateFilter] = useState<DateFilterState>({
    type: 'today',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
  });

  // Modal inspecting sub-orders of a specific session
  const [inspectSession, setInspectSession] = useState<TableSession | null>(null);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await fetchSessionHistory();
      setSessions(data);
    } catch (err) {
      console.error('Failed to load sessions:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
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

  // Combine tables for filter
  const availableTableIds = useMemo(() => {
    const ids = new Set<string>();
    allTables.forEach(t => ids.add(t.id));
    sessions.forEach(s => {
      if (s.tableId && s.tableId !== 'COUNTER') ids.add(s.tableId);
    });
    return Array.from(ids).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  }, [allTables, sessions]);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    return sessions.filter((s) => {
      // 1. Status filter
      if (statusFilter !== 'all' && s.status !== statusFilter) return false;

      // 2. Table filter
      if (tableFilter !== 'all' && s.tableId !== tableFilter) return false;

      // 3. Date filter
      if (dateFilter.type !== 'all' && s.startedAt) {
        const sessionTime = new Date(s.startedAt).getTime();
        if (dateFilter.startDate) {
          const startTime = new Date(dateFilter.startDate).getTime();
          if (sessionTime < startTime) return false;
        }
        if (dateFilter.endDate) {
          const endTime = new Date(dateFilter.endDate).getTime() + 86400000;
          if (sessionTime > endTime) return false;
        }
      }

      return true;
    });
  }, [sessions, statusFilter, tableFilter, dateFilter]);

  // Aggregate stats
  const totalSales = useMemo(() => {
    return filteredSessions.reduce((sum, s) => sum + (s.totalAmount || 0), 0);
  }, [filteredSessions]);

  const activeCount = useMemo(() => {
    return filteredSessions.filter(s => s.status === 'active').length;
  }, [filteredSessions]);

  const avgDurationMins = useMemo(() => {
    const closedSessions = filteredSessions.filter(s => s.durationMinutes && s.durationMinutes > 0);
    if (closedSessions.length === 0) return 0;
    const sum = closedSessions.reduce((acc, s) => acc + (s.durationMinutes || 0), 0);
    return Math.round(sum / closedSessions.length);
  }, [filteredSessions]);

  // Orders linked to inspected session
  const inspectOrders = useMemo(() => {
    if (!inspectSession) return [];
    return orders.filter(o => o.tableSessionId === inspectSession.id);
  }, [inspectSession, orders]);

  return (
    <div>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif text-text-primary">Shared Table Sessions</h1>
          <p className="text-sm text-text-secondary mt-1">
            Historical audit log of shared table sessions, consolidated tabs, and time slot durations.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadSessions}
            className="flex items-center gap-2 px-3.5 py-2 bg-white border border-border rounded-sm text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary hover:bg-border/20 transition-colors shadow-2xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Log
          </button>
        </div>
      </div>

      {/* Metrics Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <div className="bg-white border border-border rounded-sm p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-1">
            Filtered Sessions
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-serif font-bold text-text-primary">{filteredSessions.length}</span>
            <Users className="w-4 h-4 text-accent" />
          </div>
        </div>

        <div className="bg-white border border-border rounded-sm p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
            Active Tables
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-serif font-bold text-emerald-900">{activeCount}</span>
            <span className={`w-2.5 h-2.5 rounded-full ${activeCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-300'}`}></span>
          </div>
        </div>

        <div className="bg-white border border-border rounded-sm p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block mb-1">
            Avg Seated Duration
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-serif font-bold text-text-primary">
              {avgDurationMins > 0 ? `${avgDurationMins} min` : '—'}
            </span>
            <Clock className="w-4 h-4 text-blue-500" />
          </div>
        </div>

        <div className="bg-white border border-border rounded-sm p-4 shadow-xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent block mb-1">
            Total Consolidated Revenue
          </span>
          <div className="flex items-baseline justify-between">
            <span className="text-2xl font-serif font-bold text-accent">{formatCurrency(totalSales)}</span>
            <TrendingUp className="w-4 h-4 text-accent" />
          </div>
        </div>
      </div>

      {/* Filters Card */}
      <div className="bg-white border border-border rounded-sm p-5 mb-6 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-border">
          {/* Status Tabs */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary me-2">Status:</span>
            {(['all', 'active', 'closed'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`px-3.5 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider transition-all ${
                  statusFilter === st
                    ? 'bg-text-primary text-white shadow-xs'
                    : 'bg-border/20 text-text-secondary hover:bg-border/50'
                }`}
              >
                {st}
              </button>
            ))}
          </div>

          {/* Table Selector */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-text-muted" />
            <span className="text-xs font-bold uppercase tracking-wider text-text-secondary">Table:</span>
            <select
              value={tableFilter}
              onChange={(e) => setTableFilter(e.target.value)}
              className="bg-bg-primary border border-border rounded-sm px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-text-primary focus:outline-hidden"
            >
              <option value="all">All Tables</option>
              {availableTableIds.map((tid) => (
                <option key={tid} value={tid}>Table {tid}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Date Presets */}
        <div className="pt-4 flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-text-secondary flex items-center gap-1.5 me-2">
            <Calendar className="w-4 h-4 text-accent" />
            <span>Date Range:</span>
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
              </button>
            );
          })}
        </div>

        {dateFilter.type === 'custom' && (
          <div className="mt-3 pt-3 border-t border-border flex flex-wrap items-center gap-4 text-xs font-medium">
            <span className="text-text-muted uppercase tracking-wider text-[10px] font-bold flex items-center gap-1">
              <CalendarRange className="w-3.5 h-3.5" /> Date Bounds:
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

      {/* Sessions List Table */}
      <div className="bg-white border border-border rounded-sm overflow-hidden shadow-xs">
        {filteredSessions.length === 0 ? (
          <div className="p-12 text-center text-text-secondary">
            <Users className="w-10 h-10 text-text-muted mx-auto mb-3" />
            <h3 className="font-serif text-lg text-text-primary mb-1">No Table Sessions Found</h3>
            <p className="text-xs text-text-muted">
              {loading ? 'Loading session records from database...' : 'Try adjusting the date range or status filters.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-bg-primary border-b border-border text-xs uppercase tracking-widest text-text-muted">
                <tr>
                  <th className="px-6 py-4 font-bold">Session ID</th>
                  <th className="px-6 py-4 font-bold">Table</th>
                  <th className="px-6 py-4 font-bold">Status</th>
                  <th className="px-6 py-4 font-bold">Started At</th>
                  <th className="px-6 py-4 font-bold">Duration</th>
                  <th className="px-6 py-4 font-bold">Items Count</th>
                  <th className="px-6 py-4 font-bold">Consolidated Total</th>
                  <th className="px-6 py-4 font-bold">Host Phone</th>
                  <th className="px-6 py-4 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/50 text-sm">
                {filteredSessions.map((sess) => {
                  const startDate = new Date(sess.startedAt);
                  const isCurrentActive = sess.status === 'active';

                  return (
                    <tr key={sess.id} className="hover:bg-bg-primary/50 transition-colors">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-xs bg-accent/15 text-accent px-2 py-0.5 rounded-full border border-accent/20">
                          #{sess.shortId || sess.id.slice(-4).toUpperCase()}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-text-primary">
                        <div className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full bg-accent"></span>
                          <span>{sess.tableName || `Table ${sess.tableId}`}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${
                          isCurrentActive
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : 'bg-neutral-100 text-neutral-600'
                        }`}>
                          {isCurrentActive && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>}
                          {sess.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-text-secondary whitespace-nowrap">
                        <div className="font-medium text-text-primary">
                          {startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        <span className="text-[11px] text-text-muted">
                          {startDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-xs text-text-primary whitespace-nowrap font-medium">
                        {isCurrentActive ? (
                          <span className="text-amber-700 font-bold">
                            Live Seated
                          </span>
                        ) : sess.durationMinutes ? (
                          <span>{sess.durationMinutes} min</span>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-xs text-text-secondary">
                        <span className="font-semibold text-text-primary">{sess.itemsCount}</span> dishes
                      </td>
                      <td className="px-6 py-4 font-serif font-bold text-text-primary whitespace-nowrap">
                        {formatCurrency(sess.totalAmount)}
                      </td>
                      <td className="px-6 py-4 text-xs text-text-secondary whitespace-nowrap font-mono">
                        {sess.createdByPhone ? maskPhone(sess.createdByPhone) : <span className="text-text-muted italic">Walk-in</span>}
                      </td>
                      <td className="px-6 py-4 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setInspectSession(sess)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-sm text-xs font-bold uppercase tracking-wider text-text-secondary hover:text-text-primary hover:bg-border/30 border border-border transition-colors"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          View Orders
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inspect Session Orders Modal */}
      {inspectSession && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-sm max-w-2xl w-full p-6 shadow-xl border border-border max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between pb-4 border-b border-border mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-serif text-xl font-bold text-text-primary">
                    {inspectSession.tableName} Session Breakdown
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono font-bold bg-accent/20 text-accent">
                    #{inspectSession.shortId}
                  </span>
                </div>
                <span className="text-xs text-text-muted">
                  Started {new Date(inspectSession.startedAt).toLocaleString()}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setInspectSession(null)}
                className="text-text-muted hover:text-text-primary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Session Stats banner */}
            <div className="grid grid-cols-3 gap-3 p-3 bg-bg-primary rounded-sm border border-border mb-4 text-xs">
              <div>
                <span className="text-text-muted block text-[10px] uppercase font-bold">Total Tab</span>
                <span className="font-serif font-bold text-base text-text-primary">
                  {formatCurrency(inspectSession.totalAmount)}
                </span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px] uppercase font-bold">Total Dishes</span>
                <span className="font-bold text-sm text-text-primary">{inspectSession.itemsCount} items</span>
              </div>
              <div>
                <span className="text-text-muted block text-[10px] uppercase font-bold">Duration</span>
                <span className="font-bold text-sm text-text-primary">
                  {inspectSession.durationMinutes ? `${inspectSession.durationMinutes} min` : 'Active'}
                </span>
              </div>
            </div>

            {/* Orders list in this session */}
            <div className="flex-1 overflow-y-auto space-y-3 pe-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-text-muted block">
                Sub-Orders Linked to this Session ({inspectOrders.length})
              </span>

              {inspectOrders.length === 0 ? (
                <div className="p-8 text-center border border-border/60 rounded-sm">
                  <p className="text-xs text-text-muted italic">
                    Sub-orders are stored in the historical archive.
                  </p>
                </div>
              ) : (
                inspectOrders.map((order) => (
                  <div key={order.id} className="border border-border/80 rounded-sm p-4 bg-[#FAF9F8]">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-xs text-text-primary">#{order.id}</span>
                        <span className="text-xs text-text-muted">
                          {new Date(order.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-border/40 text-text-secondary">
                        {order.status}
                      </span>
                    </div>

                    <div className="space-y-1 mb-2 border-t border-border/40 pt-2 text-xs">
                      {order.items.map((it) => (
                        <div key={it.cartItemId} className="flex justify-between">
                          <span className="text-text-primary">{it.quantity}x {it.name}</span>
                          <span className="text-text-secondary">{formatCurrency(it.price * it.quantity)}</span>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-border/50 pt-2 flex justify-between items-center text-xs font-bold text-text-primary">
                      <span>Sub-Order Total:</span>
                      <span className="font-serif">{formatCurrency(order.total)}</span>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="pt-4 border-t border-border mt-4 flex justify-end">
              <button
                type="button"
                onClick={() => setInspectSession(null)}
                className="px-4 py-2 bg-text-primary text-white rounded-sm text-xs font-bold uppercase tracking-wider hover:bg-black"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
