import React, { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useCart } from '../../context/CartContext';
import { useLanguage } from '../../context/LanguageContext';
import { useTable } from '../../context/TableContext';
import { LanguageSelector } from '../../components/LanguageSelector';
import { Footer } from '../../components/Footer';
import { FoodAssistantModal } from '../../components/FoodAssistantModal';
import { CartButton } from '../../components/CartButton';
import { PhoneGateModal } from '../../components/PhoneGateModal';
import { Sparkles } from 'lucide-react';
import { clearMenuScrollPosition } from '../../utils/scrollRestoration';

export default function CustomerLayout() {
  const { lang, t, isRTL, tKey } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { itemCount } = useCart();
  const { activeTableId, activeTableName } = useTable();

  // Mandatory phone entry gate state
  const [hasPhone, setHasPhone] = useState<boolean>(() => {
    try {
      return Boolean(localStorage.getItem('dineview_phone'));
    } catch {
      return false;
    }
  });

  // Listen to phone updates across tabs and within app
  useEffect(() => {
    const handlePhoneUpdated = () => {
      try {
        if (localStorage.getItem('dineview_phone')) {
          setHasPhone(true);
        }
      } catch {}
    };
    window.addEventListener('dineview:phone_updated', handlePhoneUpdated);
    window.addEventListener('storage', handlePhoneUpdated);
    return () => {
      window.removeEventListener('dineview:phone_updated', handlePhoneUpdated);
      window.removeEventListener('storage', handlePhoneUpdated);
    };
  }, []);

  const isMenuRoute = location.pathname === '/' || location.pathname === '/menu';

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
          
          <CartButton variant="header" t={t} />
        </div>
      </nav>

      {/* Main Content Area - Guard MenuPage behind phone gate */}
      <div className="flex-1">
        {!hasPhone && isMenuRoute ? (
          <div className="min-h-[70vh] flex flex-col items-center justify-center p-8 text-center animate-in fade-in">
            <div className="w-12 h-12 rounded-full bg-accent/10 border border-accent/20 flex items-center justify-center text-accent mb-4 animate-pulse">
              <Sparkles className="w-6 h-6" />
            </div>
            <h2 className="font-serif text-2xl md:text-3xl text-text-primary mb-2">Exclusive Digital Menu</h2>
            <p className="max-w-md text-sm text-text-secondary leading-relaxed">
              Please enter your mobile phone number in the gate prompt to unlock our chef's live digital menu and AI Concierge.
            </p>
          </div>
        ) : (
          <Outlet context={{ lang, t, isRTL, tKey }} />
        )}
      </div>

      {/* Footer */}
      <Footer t={t} isRTL={isRTL} onNavigate={handleNavClick} />

      {/* AI Food Recommendation Assistant */}
      <FoodAssistantModal />

      {/* Mandatory Phone Gate Modal - Blocks menu until phone is verified */}
      <PhoneGateModal
        isOpen={!hasPhone}
        tableId={activeTableId}
        tableName={activeTableName}
        onSuccess={() => {
          setHasPhone(true);
        }}
      />
    </div>
  );
}
