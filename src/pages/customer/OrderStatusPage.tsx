import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { Order } from '../../context/OrderContext';
import { CheckCircle2, Clock, ChefHat, PackageCheck, ChevronLeft, Users, Receipt } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import { formatCurrency } from '../../utils/currency';
import { getMenuItemName } from '../../data/menu';
import { TableSession } from '../../services/sessionService';

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const [order, setOrder] = useState<Order | null>(null);
  const [session, setSession] = useState<TableSession | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { lang, t } = useOutletContext<{ lang: string; t: Record<string, string>; isRTL?: boolean }>();

  // Fetch specific order using onSnapshot for real-time updates
  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    
    const unsubscribe = onSnapshot(
      doc(db, 'orders', id),
      (docSnapshot) => {
        if (docSnapshot.exists()) {
          setOrder(docSnapshot.data() as Order);
        } else {
          setOrder(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error('Failed to subscribe to order updates:', error);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [id]);

  // Subscribe to parent table session if linked
  useEffect(() => {
    if (!order?.tableSessionId) {
      setSession(null);
      return;
    }

    const unsubscribeSession = onSnapshot(
      doc(db, 'sessions', order.tableSessionId),
      (sessDoc) => {
        if (sessDoc.exists()) {
          setSession(sessDoc.data() as TableSession);
        } else {
          setSession(null);
        }
      },
      (err) => {
        console.warn('Could not subscribe to session:', err);
      }
    );

    return () => unsubscribeSession();
  }, [order?.tableSessionId]);

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-xl font-serif text-text-primary">
          {t.order_loading || 'Loading order...'}
        </h2>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-serif text-text-primary mb-4">
          {t.order_not_found || 'Order not found'}
        </h2>
        <button 
          onClick={() => navigate('/')}
          className="bg-text-primary text-white px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
        >
          {t.order_return_to_menu || 'Return to Menu'}
        </button>
      </div>
    );
  }

  const steps = [
    { id: 'pending', label: t.order_step_placed || 'Order Placed', icon: Clock },
    { id: 'preparing', label: t.order_step_preparing || 'Preparing', icon: ChefHat },
    { id: 'ready', label: t.order_step_ready || 'Ready to Serve', icon: PackageCheck },
    { id: 'completed', label: t.order_step_completed || 'Completed', icon: CheckCircle2 },
  ];

  const currentStepIndex = steps.findIndex(s => s.id === order.status);

  // Format session start time
  const sessionStartTime = session?.startedAt 
    ? new Date(session.startedAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : null;

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <button 
        onClick={() => navigate('/')}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-8 font-bold uppercase tracking-widest text-[10px]"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        {t.back_to_menu || 'Back to Menu'}
      </button>

      <div className="text-center mb-12">
        <h1 className="text-4xl font-serif text-text-primary mb-3">
          {t.order_number || 'Order'} #{order.id}
        </h1>

        {/* Shared Table Session Badge */}
        {session && session.shortId ? (
          <div className="inline-flex flex-wrap items-center justify-center gap-2 px-4 py-1.5 rounded-full border border-accent/40 bg-accent/10 text-xs font-bold uppercase tracking-wider text-text-primary mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Table {order.tableId || session.tableId}</span>
            <span className="text-text-muted">•</span>
            <span className="text-accent font-semibold">Session #{session.shortId}</span>
            {sessionStartTime && (
              <>
                <span className="text-text-muted">•</span>
                <span className="text-text-secondary font-medium">Started {sessionStartTime}</span>
              </>
            )}
          </div>
        ) : (
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full border border-border bg-border/20 text-xs font-bold uppercase tracking-wider text-text-primary mb-3">
            <span className={`w-1.5 h-1.5 rounded-full ${order.tableId && order.tableId !== 'COUNTER' ? 'bg-accent' : 'bg-neutral-400'}`}></span>
            <span>{order.tableId && order.tableId !== 'COUNTER' ? `Table ${order.tableId}` : 'Counter'}</span>
          </div>
        )}

        <p className="text-text-secondary text-sm">
          {order.tableId && order.tableId !== 'COUNTER'
            ? 'Your dishes are being prepared by our culinary team and will be brought directly to your table.'
            : (t.order_pay_counter_desc || 'Please proceed to the counter to pay and mention your order number.')}
        </p>

        {/* Live Shared Table Session Card */}
        {session && (
          <div className="mt-5 p-4 rounded-md border border-border bg-white text-left shadow-xs">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-text-primary">
                <Users className="w-4 h-4 text-accent" />
                <span>Shared Table Tab</span>
              </div>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                session.status === 'active' ? 'bg-emerald-100 text-emerald-800' : 'bg-neutral-100 text-neutral-600'
              }`}>
                {session.status === 'active' ? 'Active Session' : 'Closed Tab'}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs text-text-secondary">
              <span>All phones at Table {session.tableId} combined:</span>
              <span className="font-semibold text-text-primary text-sm">
                {session.itemsCount} items • {formatCurrency(session.totalAmount)}
              </span>
            </div>
            {session.status === 'closed' && (
              <p className="mt-2 text-[11px] text-text-muted italic border-t border-border pt-2">
                This table session has been closed by the manager. Any subsequent order placed from this table will automatically start a fresh session.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="relative mb-16">
        {/* Progress Line */}
        <div className="absolute top-1/2 left-0 right-0 w-full h-0.5 bg-border -z-10 -translate-y-1/2"></div>
        <div 
          className="absolute top-1/2 left-0 rtl:left-auto rtl:right-0 h-0.5 bg-accent -z-10 -translate-y-1/2 transition-all duration-500"
          style={{ width: `${(Math.max(0, currentStepIndex) / (steps.length - 1)) * 100}%` }}
        ></div>

        <div className="flex justify-between relative">
          {steps.map((step, index) => {
            const isCompleted = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;
            const Icon = step.icon;
            
            return (
              <div key={step.id} className="flex flex-col items-center gap-4 bg-bg-primary px-2">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors duration-500 ${
                  isCompleted ? 'bg-accent text-white' : 'bg-bg-primary border-2 border-border text-text-muted'
                } ${isCurrent ? 'ring-4 ring-accent/20' : ''}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`text-[10px] font-bold uppercase tracking-widest ${
                  isCurrent ? 'text-text-primary' : 'text-text-muted'
                }`}>
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Order Items Breakdown */}
      <div className="bg-border/20 rounded-sm p-8">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-serif text-xl">
            {t.order_details || 'This Order Items'}
          </h3>
          <span className="text-xs text-text-secondary uppercase tracking-widest font-bold">
            Order #{order.id}
          </span>
        </div>
        
        <div className="flex flex-col gap-4 mb-6">
          {order.items.map(item => {
            const itemName = getMenuItemName(item, lang);
            return (
              <div key={item.cartItemId} className="flex justify-between items-center text-sm">
                <span className="text-text-primary font-medium">{item.quantity}x {itemName}</span>
                <span className="text-text-secondary">{formatCurrency(item.price * item.quantity)}</span>
              </div>
            );
          })}
        </div>

        <div className="border-t border-border/50 pt-4 mb-2 flex justify-between items-center text-sm text-text-secondary">
          <span>Table</span>
          <span className="font-semibold text-text-primary">
            {order.tableId && order.tableId !== 'COUNTER' ? `Table ${order.tableId}` : 'Counter'}
          </span>
        </div>

        {order.kitchenNotes && (
          <div className="border-t border-border/50 pt-3 mb-2 text-xs text-text-secondary">
            <span className="font-semibold text-text-primary">Kitchen Note: </span>
            <span>{order.kitchenNotes}</span>
          </div>
        )}

        <div className="border-t border-border/50 pt-4 flex justify-between items-center font-medium">
          <span className="text-text-primary">Order Total</span>
          <span className="text-xl font-serif text-text-primary">{formatCurrency(order.total)}</span>
        </div>
      </div>
    </div>
  );
}
