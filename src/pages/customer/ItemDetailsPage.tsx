import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useOutletContext } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useMenu } from '../../context/MenuContext';
import { ChevronLeft, Plus, Minus, Flame, Footprints, Box } from 'lucide-react';
import { formatCurrency } from '../../utils/currency';
import { ModelViewerModal } from '../../components/ModelViewerModal';
import { getMenuItemName, getMenuItemDescription } from '../../data/menu';

export default function ItemDetailsPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { lang, t } = useOutletContext<{ lang: string; t: Record<string, string>; isRTL?: boolean }>();
  const { items, addItem, updateQuantity } = useCart();
  const { categories } = useMenu();

  // Automatically scroll to top whenever navigating to an item details page or switching items
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [id]);

  // Find item by ID across all categories
  const item = categories.flatMap((cat) => cat.items).find((i) => i.id === id);

  if (!item) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
        <h2 className="text-2xl font-serif text-text-primary mb-4">{t.item_not_found || 'Item not found'}</h2>
        <button 
          onClick={() => navigate(-1)}
          className="bg-text-primary text-white px-6 py-2 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-[#333] transition-colors"
        >
          {t.go_back || 'Go Back'}
        </button>
      </div>
    );
  }

  const walkTime = Math.round(item.calories / 5);
  const existingCartItem = items.find((i) => i.id === item.id);
  
  const actualModelUrl = item.modelUrl || item.modelUrlAr;

  const displayName = getMenuItemName(item, lang);
  const displayDescription = getMenuItemDescription(item, lang);

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-12 py-12 relative">
      <button 
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-text-secondary hover:text-text-primary transition-colors mb-8 font-bold uppercase tracking-widest text-[10px]"
      >
        <ChevronLeft className="w-4 h-4 rtl:rotate-180" />
        {t.back_to_menu || 'Back to Menu'}
      </button>

      <div className="flex flex-col md:flex-row gap-12">
        <div className="flex-1">
          <div className="w-full aspect-square bg-border rounded-sm overflow-hidden relative">
            <img 
              src={item.image} 
              alt={displayName} 
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          </div>
          
          {actualModelUrl && (
            <ModelViewerModal
              modelUrl={actualModelUrl}
              modelUrlAr={item.modelUrlAr || actualModelUrl}
              iosSrc={item.iosSrc}
              poster={item.image}
              itemName={displayName}
              buttonClassName="mt-6 w-full flex items-center justify-center gap-2 border border-border text-text-primary px-8 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest hover:border-text-secondary transition-colors"
              iconClassName="w-4 h-4"
            />
          )}
        </div>
        
        <div className="flex-1 flex flex-col justify-center">
          <div className="mb-6">
            <div className="flex flex-wrap gap-2 mb-4">
              {item.tags?.map((tag) => (
                <span
                  key={tag.id}
                  className="text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-sm border border-border/70 text-text-secondary"
                >
                  {t[`tag_${tag.id}`] || tag.label}
                </span>
              ))}
            </div>
            <h1 className="text-4xl md:text-5xl font-serif text-text-primary mb-4 leading-tight">{displayName}</h1>
            <span className="text-2xl font-serif text-text-primary/90">{formatCurrency(item.price)}</span>
          </div>

          <p className="text-base text-text-secondary leading-relaxed mb-8">
            {displayDescription}
          </p>

          <div className="flex items-center gap-6 mb-12 text-sm font-medium text-text-muted">
            <div className="flex items-center gap-2">
              <Flame className="w-4 h-4" />
              <span>{item.calories} {t.kcal || 'kcal'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Footprints className="w-4 h-4" />
              <span>{walkTime} {t.walk_min || 'min walk'}</span>
            </div>
          </div>

          <div className="border-t border-border/50 pt-8 mt-auto">
            {existingCartItem ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center border border-border rounded-full p-1">
                  <button 
                    onClick={() => updateQuantity(existingCartItem.cartItemId, existingCartItem.quantity - 1)}
                    className="p-2 text-text-secondary hover:text-text-primary transition-colors"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-8 text-center font-medium">{existingCartItem.quantity}</span>
                  <button 
                    onClick={() => updateQuantity(existingCartItem.cartItemId, existingCartItem.quantity + 1)}
                    disabled={existingCartItem.quantity >= (item.maxPerOrder ?? 20)}
                    className={`p-2 transition-colors ${
                      existingCartItem.quantity >= (item.maxPerOrder ?? 20)
                        ? 'text-text-muted cursor-not-allowed opacity-50'
                        : 'text-text-secondary hover:text-text-primary'
                    }`}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <button 
                  onClick={() => navigate('/cart')}
                  className="flex-1 bg-text-primary text-white px-8 py-3.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] transition-all hover:scale-105 active:scale-95 text-center"
                >
                  {t.view_cart || 'View Cart'}
                </button>
              </div>
            ) : (
              <button 
                onClick={() => addItem(item)}
                disabled={item.maxPerOrder === 0}
                className={`w-full px-8 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                  item.maxPerOrder === 0
                    ? 'bg-text-muted text-white cursor-not-allowed opacity-50'
                    : 'bg-text-primary text-white hover:bg-[#333] hover:scale-105 active:scale-95'
                }`}
              >
                <Plus className="w-4 h-4" />
                {t.add_to_cart || 'Add to Cart'} — {formatCurrency(item.price)}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
