import React, { useState, useEffect } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useOrder } from '../../context/OrderContext';
import { useTable } from '../../context/TableContext';
import { ChevronLeft, Plus, Minus, Trash2, Phone, ArrowRight, Loader2, Sparkles, AlertCircle, X } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { getMenuItemName } from '../../data/menu';
import { formatPhone, recordCustomerOrder } from '../../services/customerService';

const COUNTRY_CODES = [
  { code: '+91', country: 'IN', label: '+91 (IN)' },
  { code: '+1', country: 'US', label: '+1 (US)' },
  { code: '+44', country: 'GB', label: '+44 (UK)' },
  { code: '+971', country: 'AE', label: '+971 (UAE)' },
  { code: '+65', country: 'SG', label: '+65 (SG)' },
  { code: '+61', country: 'AU', label: '+61 (AU)' },
];

export default function CartPage() {
  const { items, updateQuantity, removeItem, total, clearCart } = useCart();
  const { placeOrder } = useOrder();
  const { activeTableId, activeTableName } = useTable();
  const navigate = useNavigate();
  const { lang, t } = useOutletContext<{ lang: string; t: Record<string, string>; isRTL?: boolean }>();

  // Guard scrollTo(0,0) to 'only on first load' so opening /cart lands at top, not bottom,
  // without triggering re-scrolls when adjusting item quantities or typing.
  const hasScrolledOnMountRef = React.useRef(false);
  useEffect(() => {
    if (!hasScrolledOnMountRef.current) {
      hasScrolledOnMountRef.current = true;
      window.scrollTo(0, 0);
    }
  }, []);

  // Optional Phone state for AI memory & customer profile
  const [selectedCountryCode, setSelectedCountryCode] = useState('+91');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<{ code: string; message: string } | null>(null);

  // Initialize phone from localStorage if returning guest
  useEffect(() => {
    try {
      const savedPhone = localStorage.getItem('dineview_phone');
      if (savedPhone) {
        const matched = COUNTRY_CODES.find((c) => savedPhone.startsWith(c.code));
        if (matched) {
          setSelectedCountryCode(matched.code);
          setPhoneNumber(savedPhone.slice(matched.code.length));
        } else if (savedPhone.startsWith('+')) {
          setPhoneNumber(savedPhone);
        } else {
          setPhoneNumber(savedPhone);
        }
      }
    } catch {}
  }, []);

  const getFullPhoneNumber = (): string => {
    const raw = phoneNumber.trim();
    if (!raw) return '';
    if (raw.startsWith('+')) {
      return formatPhone(raw);
    }
    return formatPhone(`${selectedCountryCode}${raw}`);
  };

  const handlePlaceOrder = async () => {
    if (items.length === 0 || isSubmitting) return;

    setIsSubmitting(true);
    setOrderError(null);
    try {
      const fullPhone = getFullPhoneNumber();

      // If user provided a phone number, persist to localStorage for AI memory
      if (fullPhone) {
        try {
          localStorage.setItem('dineview_phone', fullPhone);
        } catch {}
      }

      // Place order in Firestore
      const orderId = await placeOrder(
        items,
        total,
        activeTableId,
        activeTableName,
        fullPhone || undefined
      );

      // Record customer profile in Firestore for AI assistant history if phone provided
      if (fullPhone) {
        try {
          await recordCustomerOrder(
            {
              id: orderId,
              items,
              total,
              status: 'pending',
              createdAt: new Date().toISOString(),
              tableId: activeTableId,
              tableName: activeTableName,
              customerPhone: fullPhone,
              phoneVerified: false,
            },
            fullPhone
          );
        } catch (err) {
          console.warn('Could not record customer profile:', err);
        }
      }

      clearCart();
      navigate(`/order/${orderId}`);
    } catch (err: any) {
      console.error('[CartPage] Failed to place order:', err);
      const code = err?.code || (err?.message?.includes(':') ? err.message.split(':')[0].trim() : 'ORDER_FAILED');
      const message = err?.message || 'Could not place order. Please try again.';
      setOrderError({ code, message });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 px-6 text-center">
        <h2 className="text-3xl font-serif text-text-primary mb-6">
          {t.cart_empty_title || 'Your cart is empty'}
        </h2>
        <p className="text-text-secondary mb-10">
          {t.cart_empty_desc || 'Add some delicious items from our menu.'}
        </p>
        <button 
          onClick={() => navigate('/')}
          className="bg-text-primary text-white px-8 py-3.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] transition-all hover:scale-105 active:scale-95"
        >
          {t.cart_view_menu || 'View Menu'}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-12 py-12">
      <div className="flex items-center justify-between mb-12">
        <button 
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors font-bold uppercase tracking-widest text-[10px]"
        >
          <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
          {t.cart_continue_browsing || 'Continue Browsing'}
        </button>
        <h1 className="text-3xl font-serif text-text-primary">
          {t.cart_title || 'Your Order'}
        </h1>
      </div>

      <div className="flex flex-col lg:flex-row gap-12">
        {/* Cart Items List */}
        <div className="flex-1 flex flex-col gap-8">
          {items.map((item) => {
            const itemName = getMenuItemName(item, lang);
            return (
              <div key={item.cartItemId} className="flex gap-6 items-center py-4 border-b border-border/50">
                <div className="w-20 h-20 bg-border rounded-sm overflow-hidden shrink-0">
                  <img src={item.image} alt={itemName} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                </div>
                <div className="flex-1">
                  <h3 className="font-serif text-lg text-text-primary mb-1">{itemName}</h3>
                  <span className="font-serif text-text-primary/90">{formatCurrency(item.price)}</span>
                </div>
                
                <div className="flex items-center border border-border rounded-full p-1 shrink-0">
                  <button 
                    onClick={() => updateQuantity(item.cartItemId, item.quantity - 1)}
                    className="p-1.5 text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 text-center text-sm font-medium">{item.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(item.cartItemId, item.quantity + 1)}
                    disabled={item.quantity >= (item.maxPerOrder ?? 20)}
                    className={`p-1.5 transition-colors ${
                      item.quantity >= (item.maxPerOrder ?? 20)
                        ? 'text-text-muted cursor-not-allowed opacity-50'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <button 
                  onClick={() => removeItem(item.cartItemId)}
                  className="p-2 text-text-muted hover:text-red-500 transition-colors ms-2 shrink-0"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>

        {/* Checkout Summary & Place Order */}
        <div className="lg:w-96 shrink-0">
          <div className="bg-white border border-border rounded-sm p-6 sm:p-8 shadow-xs sticky top-32">
            <h3 className="font-serif text-xl mb-4">
              {t.cart_order_summary || 'Order Summary'}
            </h3>

            {/* Table Assignment Badge */}
            <div className="flex justify-between items-center mb-3 text-sm text-text-secondary pb-3 border-b border-border/50">
              <span>{t.cart_table || 'Seating / Table'}</span>
              <span className="inline-flex items-center gap-1.5 font-bold text-text-primary px-2.5 py-0.5 rounded-full bg-border/30 text-xs">
                <span className={`w-2 h-2 rounded-full ${activeTableId && activeTableId !== 'COUNTER' ? 'bg-accent' : 'bg-neutral-400'}`}></span>
                {activeTableId && activeTableId !== 'COUNTER' ? `Table ${activeTableId}` : 'Counter'}
              </span>
            </div>
            
            <div className="flex justify-between items-center mb-2 text-sm text-text-secondary">
              <span>{t.cart_subtotal || 'Subtotal'}</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between items-center mb-4 text-sm text-text-secondary">
              <span>{t.cart_taxes || 'Taxes & Service'}</span>
              <span>{t.cart_taxes_notice || 'Inclusive'}</span>
            </div>
            
            <div className="border-t border-border/60 pt-3 mb-6 flex justify-between items-center font-medium">
              <span className="text-text-primary font-bold">{t.cart_total || 'Total'}</span>
              <span className="text-2xl font-serif text-text-primary">{formatCurrency(total)}</span>
            </div>

            {/* Optional Phone Input for AI Memory */}
            <div className="border-t border-border pt-4 mb-6">
              <div className="flex items-center justify-between mb-1">
                <label className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-text-primary">
                  <Phone className="w-3.5 h-3.5 text-accent" />
                  <span>Mobile Phone (Optional)</span>
                </label>
                <span className="text-[10px] text-text-muted font-medium">For AI Concierge Memory</span>
              </div>
              <p className="text-[11px] text-text-secondary mb-3 leading-snug">
                Enter your mobile number so our AI Concierge remembers your dining preferences next time.
              </p>

              <div className="flex gap-2">
                <select
                  value={selectedCountryCode}
                  onChange={(e) => setSelectedCountryCode(e.target.value)}
                  className="border border-border bg-bg-primary px-2 py-2 rounded-sm text-xs font-medium text-text-primary focus:outline-none focus:border-text-primary shrink-0"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>

                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 9876543210 (Optional)"
                  className="flex-1 min-w-0 border border-border px-3 py-2 rounded-sm text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-text-primary"
                  autoComplete="tel"
                />
              </div>
            </div>

            {/* Error Surface Toast */}
            {orderError && (
              <div className="mb-4 p-3.5 rounded-sm bg-red-50 border border-red-300 text-red-900 animate-in fade-in slide-in-from-top-1 text-left">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-xs uppercase tracking-wider text-red-900">Order Error</span>
                        <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-red-200/80 text-red-900 font-bold">
                          {orderError.code}
                        </span>
                      </div>
                      <p className="text-xs text-red-800 mt-1 leading-snug">{orderError.message}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setOrderError(null)}
                    className="text-red-500 hover:text-red-800 shrink-0 p-0.5"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* Direct Place Order Button */}
            <button
              onClick={handlePlaceOrder}
              disabled={isSubmitting || items.length === 0}
              className="w-full bg-text-primary text-white py-3.5 px-6 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-[#333] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-xs"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Placing Order...</span>
                </>
              ) : (
                <>
                  <span>Place Order</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-center text-[10px] text-text-muted mt-4 uppercase tracking-widest font-bold">
              {activeTableId && activeTableId !== 'COUNTER' ? 'Direct Table Order' : 'Pay at the counter'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
