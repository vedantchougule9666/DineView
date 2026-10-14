import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useOrder } from '../../context/OrderContext';
import { useTable } from '../../context/TableContext';
import { ChevronLeft, Plus, Minus, Trash2 } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { getMenuItemName } from '../../data/menu';

export default function CartPage() {
  const { items, updateQuantity, removeItem, total, clearCart } = useCart();
  const { placeOrder } = useOrder();
  const { activeTableId, activeTableName } = useTable();
  const navigate = useNavigate();
  const { lang, t } = useOutletContext<{ lang: string; t: Record<string, string>; isRTL?: boolean }>();

  const handlePlaceOrder = () => {
    if (items.length === 0) return;
    const orderId = placeOrder(items, total, activeTableId, activeTableName);
    clearCart();
    navigate(`/order/${orderId}`);
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

        <div className="lg:w-80 shrink-0">
          <div className="bg-border/20 rounded-sm p-8 sticky top-32">
            <h3 className="font-serif text-xl mb-6">
              {t.cart_order_summary || 'Order Summary'}
            </h3>

            <div className="flex justify-between items-center mb-4 text-sm text-text-secondary">
              <span>{t.cart_table || 'Table'}</span>
              <span className="font-bold text-text-primary">
                {activeTableId && activeTableId !== 'COUNTER' ? `Table ${activeTableId}` : 'Counter'}
              </span>
            </div>
            
            <div className="flex justify-between items-center mb-4 text-sm text-text-secondary">
              <span>{t.cart_subtotal || 'Subtotal'}</span>
              <span>{formatCurrency(total)}</span>
            </div>
            <div className="flex justify-between items-center mb-6 text-sm text-text-secondary">
              <span>{t.cart_taxes || 'Taxes'}</span>
              <span>{t.cart_taxes_notice || 'Calculated at counter'}</span>
            </div>
            
            <div className="border-t border-border/50 pt-4 mb-8 flex justify-between items-center font-medium">
              <span className="text-text-primary">{t.cart_total || 'Total'}</span>
              <span className="text-2xl font-serif text-text-primary">{formatCurrency(total)}</span>
            </div>

            <button 
              onClick={handlePlaceOrder}
              className="w-full bg-text-primary text-white px-8 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] transition-all hover:scale-105 active:scale-95"
            >
              {t.cart_place_order || 'Place Order'}
            </button>
            <p className="text-center text-[10px] text-text-muted mt-4 uppercase tracking-widest font-bold">
              {t.cart_pay_at_counter || 'Pay at the counter'}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
