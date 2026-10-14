import { forwardRef } from 'react';
import { MenuCategory } from '../data/menu';
import { MenuItemCard } from './MenuItemCard';
import { useCart } from '../context/CartContext';

interface MenuSectionProps {
  category: MenuCategory;
  lang: string;
  t: Record<string, string>;
}

export const MenuSection = forwardRef<HTMLElement, MenuSectionProps>(
  ({ category, lang, t }, ref) => {
    const { items, addItem, updateQuantity } = useCart();

    return (
      <section ref={ref} id={category.id} className="pt-16 pb-12 scroll-mt-40 border-b border-border last:border-0">
        <div className="mb-8 md:mb-12">
          <h2 className="text-3xl md:text-4xl font-serif text-text-primary mb-2">
            {t[category.id] || t[category.name] || category.name}
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-16">
          {category.items.filter(item => item.available !== false).map((item) => {
            const cartItem = items.find(i => i.id === item.id);
            return (
              <MenuItemCard 
                key={item.id} 
                item={item} 
                lang={lang} 
                t={t} 
                cartQuantity={cartItem?.quantity || 0}
                cartItemId={cartItem?.cartItemId}
                addItem={addItem}
                updateQuantity={updateQuantity}
              />
            );
          })}
        </div>
      </section>
    );
  }
);

MenuSection.displayName = 'MenuSection';
