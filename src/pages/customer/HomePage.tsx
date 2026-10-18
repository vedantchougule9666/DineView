import React, { useEffect, useRef, useState } from 'react';
import { CategoryNav } from '../../components/CategoryNav';
import { MenuSection } from '../../components/MenuSection';
import { CartButton } from '../../components/CartButton';
import { MapPin, Clock } from 'lucide-react';
import { useLocation, useOutletContext } from 'react-router-dom';
import { useMenu } from '../../context/MenuContext';
import { saveMenuScrollPosition, getAndClearMenuScrollPosition } from '../../utils/scrollRestoration';

export default function HomePage() {
  const { categories } = useMenu();
  const [activeCategory, setActiveCategory] = useState<string>(categories[0]?.id || '');
  const [reservationNotice, setReservationNotice] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const location = useLocation();
  const { lang, t } = useOutletContext<{ lang: string; t: Record<string, string>; isRTL?: boolean }>();
  const isRestoringScrollRef = useRef(false);

  // Restore saved scroll position when returning from Item Details
  useEffect(() => {
    const savedY = getAndClearMenuScrollPosition();
    if (savedY !== null && savedY > 0) {
      isRestoringScrollRef.current = true;
      // Immediate scroll restoration
      window.scrollTo(0, savedY);

      // Re-apply on animation frames and short timeout to ensure DOM paint/layout stability
      const rafId = requestAnimationFrame(() => {
        window.scrollTo(0, savedY);
      });
      const timerId = setTimeout(() => {
        window.scrollTo(0, savedY);
      }, 50);

      return () => {
        cancelAnimationFrame(rafId);
        clearTimeout(timerId);
      };
    }
  }, []);

  // Safety net: save scroll position if unmounting because of navigating to an item details page
  useEffect(() => {
    return () => {
      if (window.location.pathname.startsWith('/item/')) {
        saveMenuScrollPosition();
      }
    };
  }, []);

  // Auto-scroll to matching section when navigating to /menu, /locations
  useEffect(() => {
    if (isRestoringScrollRef.current) {
      // Do not overwrite restored scroll position when returning from item details
      return;
    }
    const path = location.pathname.replace(/^\//, '');
    if (path === 'menu' || path === 'locations') {
      setTimeout(() => scrollToSection(path), 150);
    } else if (location.hash) {
      const targetId = location.hash.replace(/^#/, '');
      setTimeout(() => scrollToSection(targetId), 150);
    }
  }, [location.pathname, location.hash]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveCategory(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-20% 0px -75% 0px',
      }
    );

    Object.values(sectionRefs.current).forEach((section) => {
      if (section) observer.observe(section as Element);
    });

    return () => observer.disconnect();
  }, []);

  const scrollToSection = (sectionId: string, e?: React.MouseEvent) => {
    e?.preventDefault();
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
    <>
      {/* Hero / Cover Image */}
      <div className="w-full h-[42vh] md:h-[80vh] relative bg-border flex flex-col justify-center items-center text-center px-6">
        <img
          src="https://images.unsplash.com/photo-1550966871-3ed3cdb5ed0c?q=80&w=800&auto=format&fit=crop"
          alt="DineView Restaurant Interior"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-black/40"></div>
        <div className="relative z-10 flex flex-col items-center">
          <h1 className="text-5xl md:text-7xl lg:text-8xl font-serif text-white mb-6 tracking-tight">DineView</h1>
          <p className="text-white/90 text-[10px] md:text-xs uppercase tracking-[0.3em] font-bold mb-10">{t.hero_subtitle}</p>
        </div>
      </div>

      {/* Restaurant Info Bar */}
      <div className="bg-bg-primary border-b border-border py-4 md:py-6 px-6 md:px-12">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row flex-wrap gap-4 md:gap-10 text-[10px] md:text-xs uppercase tracking-widest text-text-secondary font-bold justify-start items-start md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-text-muted" />
              <span>{t.location}</span>
            </div>
            <a 
              href="https://maps.google.com/?q=123+Culinary+Ave,+Food+District" 
              target="_blank" 
              rel="noopener noreferrer"
              className="border border-border text-text-primary px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest hover:bg-border/50 hover:scale-105 active:scale-95 transition-all hidden sm:block"
            >
              {t.directions}
            </a>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-text-muted" />
            <span>{t.daily} {t.open_time}</span>
          </div>
        </div>
      </div>

      {/* Menu Area Anchor */}
      <div id="menu" className="scroll-mt-20"></div>

      {/* Sticky Category Navigation */}
      <CategoryNav
        categories={categories}
        activeCategory={activeCategory}
        onSelectCategory={scrollToSection}
        translations={t}
      />

      {/* Main Menu Content */}
      <main className="max-w-4xl mx-auto px-6 md:px-12 pb-24 w-full">
        {categories.map((category) => (
          <MenuSection
            key={category.id}
            category={category}
            ref={(el) => (sectionRefs.current[category.id] = el)}
            lang={lang}
            t={t}
          />
        ))}
      </main>

      {/* Locations Section */}
      <section id="locations" className="py-24 px-6 md:px-12 border-t border-border bg-border/30 scroll-mt-20">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-serif text-text-primary mb-6 leading-tight">{t.nav_locations}</h2>
          <p className="text-text-secondary leading-relaxed mb-10 max-w-sm mx-auto">
            {t.location}<br/>
            {t.daily} {t.open_time}
          </p>
          <button 
            onClick={() => {
              setReservationNotice(t.reservation_coming_soon || 'Table reservation system coming soon!');
              setTimeout(() => setReservationNotice(null), 4000);
            }} 
            className="bg-text-primary text-white px-8 py-3.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-[#333] hover:scale-105 active:scale-95 transition-all"
          >
            {t.book || 'Reserve'}
          </button>
          {reservationNotice && (
            <p className="mt-4 text-xs font-serif text-accent animate-in fade-in">
              {reservationNotice}
            </p>
          )}
        </div>
      </section>

      {/* Floating Cart Button */}
      <CartButton t={t} />
    </>
  );
}
