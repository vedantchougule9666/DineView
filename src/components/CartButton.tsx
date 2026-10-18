import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { formatCurrency } from '../utils/currency';

export interface CartButtonProps {
  className?: string;
  variant?: 'floating' | 'header';
  t?: Record<string, string>;
}

export const CartButton: React.FC<CartButtonProps> = ({ 
  className = '', 
  variant = 'floating',
  t, 
}) => {
  const navigate = useNavigate();
  const { itemCount, total } = useCart();
  const translations: Record<string, string> = t || {};

  const handleNavigateToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigate('/cart');
  };

  if (variant === 'header') {
    return (
      <button 
        type="button"
        onClick={handleNavigateToCart}
        className={`relative flex items-center justify-center p-2 text-text-secondary hover:text-text-primary transition-colors ${className}`}
        aria-label={translations['nav_cart'] || 'Cart'}
      >
        <ShoppingBag className="w-5 h-5" />
        {itemCount > 0 && (
          <span className="absolute top-0 end-0 w-4 h-4 bg-accent text-white text-[9px] font-bold flex items-center justify-center rounded-full">
            {itemCount}
          </span>
        )}
      </button>
    );
  }

  // Floating variant for HomePage or customer browsing
  if (itemCount === 0) return null;

  return (
    <div className={`fixed bottom-6 end-6 z-40 animate-in fade-in slide-in-from-bottom-4 duration-200 ${className}`}>
      <button
        type="button"
        onClick={handleNavigateToCart}
        className="flex items-center gap-3 bg-text-primary text-white px-5 py-3.5 rounded-full shadow-2xl hover:bg-[#333] hover:scale-105 active:scale-95 transition-all text-xs font-bold tracking-wider uppercase border border-white/10"
        aria-label={translations['view_cart'] || 'View Cart'}
      >
        <div className="relative">
          <ShoppingBag className="w-4 h-4" />
          <span className="absolute -top-1.5 -end-2 w-3.5 h-3.5 bg-accent text-white text-[8px] font-bold flex items-center justify-center rounded-full">
            {itemCount}
          </span>
        </div>
        <span>{translations['view_cart'] || 'View Cart'}</span>
        <span className="w-1 h-1 rounded-full bg-white/40" />
        <span className="font-serif tracking-normal font-medium">{formatCurrency(total)}</span>
      </button>
    </div>
  );
};

export default CartButton;
