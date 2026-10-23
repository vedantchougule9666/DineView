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
  
  const actualModelUrl = item.modelUrl || item.modelUrlAr;

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

        {/* Veg / Spicy badge overlay */}
        {item.tags && item.tags.length > 0 && (
          <div className="absolute top-2.5 start-2.5 z-10 flex flex-wrap gap-1">
            {item.tags.some(tag => tag.id === 'v' || tag.id === 'vg') && (
              <span className="bg-emerald-950/80 backdrop-blur-xs text-emerald-300 border border-emerald-500/40 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-xs flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                Veg
              </span>
            )}
            {item.tags.some(tag => tag.id === 'spicy') && (
              <span className="bg-red-950/80 backdrop-blur-xs text-red-300 border border-red-500/40 text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-xs flex items-center gap-1">
                <Flame className="w-2.5 h-2.5 fill-red-400" />
                Spicy
              </span>
            )}
          </div>
        )}
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

      {/* Dietary Tags Chips */}
      {item.tags && item.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {item.tags.map((tag) => (
            <span
              key={tag.id}
              className={`inline-flex items-center px-2 py-0.5 rounded-xs text-[10px] font-bold uppercase tracking-wider border ${tag.color || 'bg-neutral-100 text-neutral-700 border-neutral-200'}`}
            >
              {t[`tag_${tag.id}`] || tag.label}
            </span>
          ))}
        </div>
      )}
      
      <p className="text-sm md:text-base text-text-secondary mt-2.5 leading-relaxed line-clamp-2">
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
              modelUrlAr={item.modelUrlAr || actualModelUrl}
              iosSrc={item.iosSrc}
              poster={item.image}
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
  const p = prevProps.item;
  const n = nextProps.item;
  return p.id === n.id && 
         p.name === n.name && 
         p.price === n.price && 
         p.description === n.description && 
         p.image === n.image && 
         p.calories === n.calories && 
         p.available === n.available && 
         p.maxPerOrder === n.maxPerOrder && 
         p.modelUrl === n.modelUrl && 
         p.modelUrlAr === n.modelUrlAr && 
         p.iosSrc === n.iosSrc && 
         prevProps.cartQuantity === nextProps.cartQuantity && 
         prevProps.cartItemId === nextProps.cartItemId && 
         prevProps.lang === nextProps.lang && 
         prevProps.t === nextProps.t;
});
