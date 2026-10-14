import React, { memo, useState } from 'react';
import { DietaryTag, MenuItem, getMenuItemName, getMenuItemDescription } from '../data/menu';
import { Flame, Footprints, Plus, Minus, Box } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { formatCurrency } from '../utils/currency';
import { ModelViewerModal } from './ModelViewerModal';
import { saveMenuScrollPosition } from '../utils/scrollRestoration';

interface Props {
  item: MenuItem;
  lang: string;
  t: Record<string, string>;
  cartQuantity: number;
  cartItemId?: string;
  addItem: (item: MenuItem) => void;
  updateQuantity: (id: string, qty: number) => void;
}

export const MenuItemCard: React.FC<Props> = memo(({ 
  item, 
  lang, 
  t, 
  cartQuantity,
  cartItemId,
  addItem,
  updateQuantity
}) => {
  const walkTime = Math.round(item.calories / 5);
  const navigate = useNavigate();
  
  const isBurger = item.name.toLowerCase().includes('burger');
  const actualModelUrl = item.modelUrl || (isBurger ? '/models/burger.glb' : undefined);

  const displayName = getMenuItemName(item, lang);
  const displayDescription = getMenuItemDescription(item, lang);

  const handleItemClick = () => {
    saveMenuScrollPosition();
    navigate(`/item/${item.id}`);
  };

  return (
    <div className="flex flex-col group relative transition-opacity duration-300 hover:opacity-95">
      <div 
        className="relative w-full aspect-square md:aspect-[4/3] bg-border rounded-sm overflow-hidden mb-6 cursor-pointer"
        onClick={handleItemClick}
      >
        <img
          src={item.image}
          alt={displayName}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          loading="lazy"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
      </div>
      
      <div className="flex justify-between items-start gap-4">
        <h3 
          className="text-xl md:text-2xl font-serif text-text-primary leading-tight cursor-pointer hover:text-accent transition-colors"
          onClick={handleItemClick}
        >
          {displayName}
        </h3>
        <span className="text-lg md:text-xl font-serif text-text-primary/90 shrink-0">{formatCurrency(item.price)}</span>
      </div>
      
      <p className="text-sm md:text-base text-text-secondary mt-3 leading-relaxed line-clamp-2">
        {displayDescription}
      </p>
      
      <div className="flex flex-wrap items-center gap-4 mt-6 pt-4 border-t border-border/50 text-xs font-medium text-text-muted">
        <div className="flex items-center gap-1.5">
          <Flame className="w-3.5 h-3.5" />
          <span>{item.calories} {t.kcal || 'kcal'}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <Footprints className="w-3.5 h-3.5" />
          <span>{walkTime} {t.walk_min || 'min walk'}</span>
        </div>

        <div className="ms-auto flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          {actualModelUrl && (
            <ModelViewerModal 
              modelUrl={actualModelUrl} 
              itemName={displayName} 
            />
          )}

          {cartQuantity > 0 && cartItemId ? (
            <div className="flex items-center bg-bg-secondary border border-border rounded-full h-8 overflow-hidden">
              <button 
                onClick={() => updateQuantity(cartItemId, cartQuantity - 1)}
                className="w-8 h-full flex items-center justify-center text-text-primary hover:bg-border/50 active:bg-border transition-colors"
              >
                <Minus className="w-3 h-3" />
              </button>
              <span className="w-6 text-center text-[10px] font-bold text-text-primary">
                {cartQuantity}
              </span>
              <button 
                onClick={() => updateQuantity(cartItemId, cartQuantity + 1)}
                disabled={cartQuantity >= (item.maxPerOrder ?? 20)}
                className={`w-8 h-full flex items-center justify-center transition-colors ${
                  cartQuantity >= (item.maxPerOrder ?? 20) 
                    ? 'text-text-muted cursor-not-allowed opacity-50' 
                    : 'text-text-primary hover:bg-border/50 active:bg-border'
                }`}
              >
                <Plus className="w-3 h-3" />
              </button>
            </div>
          ) : (
            <button 
              onClick={() => addItem(item)}
              disabled={item.maxPerOrder === 0}
              className={`flex items-center gap-1 h-8 px-4 rounded-full uppercase tracking-widest font-bold text-[9px] transition-all ${
                item.maxPerOrder === 0
                  ? 'bg-text-muted text-white cursor-not-allowed opacity-50'
                  : 'bg-text-primary text-white hover:bg-text-secondary hover:scale-105 active:scale-95'
              }`}
            >
              <Plus className="w-3 h-3" />
              {t.add || 'Add'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.item.id === nextProps.item.id && 
         prevProps.cartQuantity === nextProps.cartQuantity && 
         prevProps.lang === nextProps.lang && 
         prevProps.t === nextProps.t;
});
