import { Order } from '../context/OrderContext';

export type DateFilterType = 'all' | 'today' | '7days' | '30days' | 'custom';
export type SortOptionType = 'newest' | 'oldest' | 'total-high-low';

export interface DateFilterState {
  type: DateFilterType;
  startDate?: string; // YYYY-MM-DD
  endDate?: string;   // YYYY-MM-DD
}

/**
 * Filter orders array by createdAt timestamp
 */
export function filterOrdersByDate(
  orders: Order[],
  filter: DateFilterState
): Order[] {
  if (filter.type === 'all') return orders;

  const now = new Date();
  
  if (filter.type === 'today') {
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;
    return orders.filter(o => {
      const t = new Date(o.createdAt).getTime();
      return !isNaN(t) && t >= startOfToday && t <= endOfToday;
    });
  }

  if (filter.type === '7days') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6).getTime();
    return orders.filter(o => {
      const t = new Date(o.createdAt).getTime();
      return !isNaN(t) && t >= start;
    });
  }

  if (filter.type === '30days') {
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29).getTime();
    return orders.filter(o => {
      const t = new Date(o.createdAt).getTime();
      return !isNaN(t) && t >= start;
    });
  }

  if (filter.type === 'custom') {
    const start = filter.startDate ? new Date(`${filter.startDate}T00:00:00`).getTime() : 0;
    const end = filter.endDate ? new Date(`${filter.endDate}T23:59:59.999`).getTime() : Infinity;
    return orders.filter(o => {
      const t = new Date(o.createdAt).getTime();
      return !isNaN(t) && t >= start && t <= end;
    });
  }

  return orders;
}

/**
 * Sort orders array by Newest first, Oldest first, or Total High-Low
 */
export function sortOrders(
  orders: Order[],
  sortBy: SortOptionType
): Order[] {
  return [...orders].sort((a, b) => {
    if (sortBy === 'newest') {
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
    if (sortBy === 'oldest') {
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    }
    if (sortBy === 'total-high-low') {
      return b.total - a.total;
    }
    return 0;
  });
}

/**
 * Group orders and calculate counts per calendar day
 */
export function getOrderCountsPerDay(orders: Order[]): Record<string, number> {
  const counts: Record<string, number> = {};
  // Sort orders descending to keep days ordered newest to oldest
  const sorted = [...orders].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  sorted.forEach(o => {
    const d = new Date(o.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
    counts[d] = (counts[d] || 0) + 1;
  });
  return counts;
}
