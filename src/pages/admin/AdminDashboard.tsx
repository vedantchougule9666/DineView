import React from 'react';
import { useOrder } from '../../context/OrderContext';
import { MENU_DATA } from '../../data/menu';
import { DollarSign, ShoppingBag, Clock } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';

export default function AdminDashboard() {
  const { orders } = useOrder();
  
  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === new Date().toDateString());
  const todayRevenue = todayOrders.reduce((sum, o) => sum + o.total, 0);
  const pendingOrders = orders.filter(o => o.status === 'pending' || o.status === 'preparing');
  
  const totalItems = MENU_DATA.reduce((sum, cat) => sum + cat.items.length, 0);

  return (
    <div>
      <h1 className="text-3xl font-serif text-text-primary mb-8">Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
        <div className="bg-white p-6 border border-border rounded-sm flex items-start gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-text-secondary mb-1">Today's Revenue</p>
            <h3 className="text-2xl font-bold">{formatCurrency(todayRevenue)}</h3>
          </div>
        </div>
        
        <div className="bg-white p-6 border border-border rounded-sm flex items-start gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-text-secondary mb-1">Active Orders</p>
            <h3 className="text-2xl font-bold">{pendingOrders.length}</h3>
          </div>
        </div>
        
        <div className="bg-white p-6 border border-border rounded-sm flex items-start gap-4">
          <div className="w-12 h-12 bg-orange-50 text-orange-600 rounded-full flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm text-text-secondary mb-1">Total Menu Items</p>
            <h3 className="text-2xl font-bold">{totalItems}</h3>
          </div>
        </div>
      </div>

      <div className="bg-white border border-border rounded-sm p-8">
        <h2 className="text-xl font-serif text-text-primary mb-6">Recent Activity</h2>
        {orders.length === 0 ? (
          <p className="text-text-secondary text-sm">No recent activity.</p>
        ) : (
          <div className="flex flex-col gap-4">
            {orders.slice(0, 5).map(order => (
              <div key={order.id} className="flex justify-between items-center py-3 border-b border-border/50 last:border-0">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-text-primary">Order #{order.id}</p>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border border-border bg-border/20 text-text-secondary">
                      {order.tableId && order.tableId !== 'COUNTER' ? `Table ${order.tableId}` : 'Counter'}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary">{new Date(order.createdAt).toLocaleTimeString()}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-text-primary">{formatCurrency(order.total)}</p>
                  <span className={`text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded-sm ${
                    order.status === 'completed' ? 'bg-green-100 text-green-700' :
                    order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                    'bg-orange-100 text-orange-700'
                  }`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
