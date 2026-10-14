import React from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTable } from '../../context/TableContext';
import { LanguageSelector } from '../../components/LanguageSelector';
import { Footer } from '../../components/Footer';
import { FoodAssistantModal } from '../../components/FoodAssistantModal';
import { clearMenuScrollPosition } from '../../utils/scrollRestoration';

export default function CustomerLayout() {
  const { lang, t, isRTL, tKey } = useLanguage();
  const navigate = useNavigate();
  const { itemCount } = useCart();
  const { activeTableId } = useTable();

  const handleNavClick = (sectionId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
    clearMenuScrollPosition();
    if (sectionId === 'top') {
      if (window.location.pathname !== '/') {
        navigate('/');
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      return;
    }
    if (window.location.pathname === `/${sectionId}` || (window.location.pathname === '/' && sectionId === 'menu')) {
      scrollToSection(sectionId);
    } else {
      navigate(`/${sectionId}`);
    }
  };

  const scrollToSection = (sectionId: string) => {
    if (sectionId === 'top') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    const element = document.getElementById(sectionId);
    if (element) {
      const yOffset = -80; // Account for top nav
      const y = element.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  return (
    <div className={`min-h-screen bg-bg-primary font-sans text-text-primary flex flex-col ${isRTL ? 'rtl' : 'ltr'}`}>
      {/* Top Navigation */}
      <nav className="h-20 px-6 md:px-12 flex justify-between items-center border-b border-border shrink-0 bg-bg-primary sticky top-0 z-50">
        <div className="flex items-center gap-8 lg:gap-12">
          <span 
            className="text-2xl font-serif tracking-tight font-bold cursor-pointer" 
            onClick={(e) => handleNavClick('top', e)}
          >
            DineView
          </span>
          <div className="hidden lg:flex gap-8 text-[10px] font-bold uppercase tracking-widest text-text-secondary">
            <a href="#menu" onClick={(e) => handleNavClick('menu', e)} className="hover:text-text-primary transition-colors">{t.nav_menu}</a>
            <a href="#locations" onClick={(e) => handleNavClick('locations', e)} className="hover:text-text-primary transition-colors">{t.nav_locations}</a>
          </div>
        </div>
        <div className="flex items-center gap-3 md:gap-5">
          <LanguageSelector />

          {/* Table / Counter badge */}
          <div 
            className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-border bg-border/20 text-[10px] font-bold uppercase tracking-wider text-text-primary select-none"
            title={activeTableId && activeTableId !== 'COUNTER' ? `Assigned to Table ${activeTableId}` : 'Ordering at Counter'}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${activeTableId && activeTableId !== 'COUNTER' ? 'bg-accent' : 'bg-neutral-400'}`}></span>
            <span>{activeTableId && activeTableId !== 'COUNTER' ? `Table ${activeTableId}` : 'Counter'}</span>
          </div>
          
          <button 
            onClick={() => navigate('/cart')}
            className="relative flex items-center justify-center p-2 text-text-secondary hover:text-text-primary transition-colors"
            aria-label={t.nav_cart || 'Cart'}
          >
            <ShoppingBag className="w-5 h-5" />
            {itemCount > 0 && (
              <span className="absolute top-0 end-0 w-4 h-4 bg-accent text-white text-[9px] font-bold flex items-center justify-center rounded-full">
                {itemCount}
              </span>
            )}
          </button>
        </div>
      </nav>

      {/* Main Content Area */}
      <div className="flex-1">
        <Outlet context={{ lang, t, isRTL, tKey }} />
      </div>

      {/* Footer */}
      <Footer t={t} isRTL={isRTL} onNavigate={handleNavClick} />

      {/* AI Food Recommendation Assistant */}
      <FoodAssistantModal />
    </div>
  );
}
