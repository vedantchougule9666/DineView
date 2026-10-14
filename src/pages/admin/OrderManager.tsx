import React, { useState } from 'react';
import { useOrder, OrderStatus } from '../../context/OrderContext';
import { useTable } from '../../context/TableContext';
import { formatCurrency } from '../../utils/currency';
import { Filter } from 'lucide-react';

export default function OrderManager() {
  const { orders, updateOrderStatus } = useOrder();
  const { allTables } = useTable();
  const [tableFilter, setTableFilter] = useState<string>('all');

  const statuses: OrderStatus[] = ['pending', 'preparing', 'ready', 'completed', 'cancelled'];

  // Combine tables from table context and existing orders
  const availableTableIds = Array.from(
    new Set([
      ...allTables.map(t => t.id),
      ...orders.map(o => o.tableId).filter((id): id is string => Boolean(id && id !== 'COUNTER'))
    ])
  ).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  const filteredOrders = orders.filter((order) => {
    if (tableFilter === 'all') return true;
    if (tableFilter === 'COUNTER') {
      return !order.tableId || order.tableId === 'COUNTER';
    }
    return order.tableId === tableFilter;
  });

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-serif text-text-primary">Order Management</h1>
          <p className="text-sm text-text-secondary mt-1">
            Track and update dine-in table and counter orders in real time.
          </p>
        </div>

        {/* Dropdown Filter */}
        <div className="flex items-center gap-2 self-start sm:self-auto bg-white border border-border px-3 py-2 rounded-sm shadow-sm">
          <Filter className="w-4 h-4 text-text-muted" />
          <label htmlFor="table-filter" className="text-xs font-bold uppercase tracking-wider text-text-secondary">
            Filter:
          </label>
          <select
            id="table-filter"
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="bg-transparent text-xs font-medium text-text-primary outline-none cursor-pointer"
          >
            <option value="all">All ({orders.length})</option>
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
      </div>

      <div className="bg-white border border-border rounded-sm overflow-hidden">
        {filteredOrders.length === 0 ? (
          <div className="p-8 text-center text-text-secondary">
            {orders.length === 0 ? 'No orders found.' : 'No orders found matching the selected filter.'}
          </div>
        ) : (
          <table className="w-full text-left">
            <thead className="bg-bg-primary border-b border-border text-xs uppercase tracking-widest text-text-muted">
              <tr>
                <th className="px-6 py-4 font-bold">Order ID</th>
                <th className="px-6 py-4 font-bold">Table</th>
                <th className="px-6 py-4 font-bold">Time</th>
                <th className="px-6 py-4 font-bold">Items</th>
                <th className="px-6 py-4 font-bold">Total</th>
                <th className="px-6 py-4 font-bold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {filteredOrders.map(order => (
                <tr key={order.id} className="hover:bg-bg-primary/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-text-primary">#{order.id}</td>
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
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    {new Date(order.createdAt).toLocaleTimeString()}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    {order.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                  </td>
                  <td className="px-6 py-4 text-sm font-medium text-text-primary">
                    {formatCurrency(order.total)}
                  </td>
                  <td className="px-6 py-4">
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
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
