import React, { useState, useEffect } from 'react';
import { X, MapPin, Phone, Mail, Clock, ArrowUpRight } from 'lucide-react';

interface FooterProps {
  t: Record<string, string>;
  isRTL?: boolean;
  onNavigate: (sectionId: string, e?: React.MouseEvent) => void;
}

type ModalType = 'about' | 'contact' | 'privacy' | null;

export const Footer: React.FC<FooterProps> = ({ t, isRTL, onNavigate }) => {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  // Close modal on Escape key and prevent background scroll
  useEffect(() => {
    if (activeModal) {
      document.body.style.overflow = 'hidden';
      const handleKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          setActiveModal(null);
        }
      };
      window.addEventListener('keydown', handleKeyDown);
      return () => {
        document.body.style.overflow = '';
        window.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      document.body.style.overflow = '';
    }
  }, [activeModal]);

  return (
    <>
      <footer 
        className="mt-auto border-t border-border bg-bg-primary text-text-primary"
        aria-label="Footer"
      >
        <div className="max-w-4xl mx-auto px-6 md:px-12 py-12 md:py-16">
          {/* Top Brand & Tagline Area */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 pb-10 border-b border-border/60">
            <div className="text-start">
              <button
                type="button"
                onClick={(e) => onNavigate('top', e)}
                className="text-2xl md:text-3xl font-serif tracking-tight font-bold text-text-primary hover:opacity-80 transition-opacity text-start focus:outline-none focus-visible:ring-1 focus-visible:ring-text-primary rounded-sm"
              >
                DineView
              </button>
              <p className="text-text-secondary text-xs md:text-sm font-sans tracking-wide mt-2 max-w-sm">
                {t.footer_tagline || 'A modern dining experience, thoughtfully served.'}
              </p>
            </div>

            {/* Dietary Information Note */}
            <div className="flex items-center gap-2.5 text-[10px] uppercase tracking-[0.2em] font-medium text-text-muted py-1.5 px-3 rounded-full border border-border/60 bg-border/20 self-start md:self-end">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 shrink-0" aria-hidden="true" />
              <span>{t.vegan_gf || 'Vegan & Gluten-Free Options Available'}</span>
            </div>
          </div>

          {/* Navigation Columns */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-8 py-10">
            {/* Column 1: Explore */}
            <div className="text-start flex flex-col gap-3">
              <h3 className="text-[10px] uppercase tracking-[0.25em] font-bold text-text-muted">
                {t.footer_explore || 'Explore'}
              </h3>
              <ul className="flex flex-col gap-2.5 text-xs text-text-secondary">
                <li>
                  <button
                    type="button"
                    onClick={(e) => onNavigate('top', e)}
                    className="hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-text-primary rounded-sm text-start"
                  >
                    {t.footer_home || 'Home'}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={(e) => onNavigate('menu', e)}
                    className="hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-text-primary rounded-sm text-start"
                  >
                    {t.nav_menu || 'Menu'}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={(e) => onNavigate('locations', e)}
                    className="hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-text-primary rounded-sm text-start"
                  >
                    {t.nav_locations || 'Locations'}
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 2: Information */}
            <div className="text-start flex flex-col gap-3">
              <h3 className="text-[10px] uppercase tracking-[0.25em] font-bold text-text-muted">
                {t.footer_information || 'Information'}
              </h3>
              <ul className="flex flex-col gap-2.5 text-xs text-text-secondary">
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveModal('about')}
                    className="hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-text-primary rounded-sm text-start"
                  >
                    {t.footer_about || 'About'}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveModal('contact')}
                    className="hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-text-primary rounded-sm text-start"
                  >
                    {t.footer_contact || 'Contact'}
                  </button>
                </li>
                <li>
                  <button
                    type="button"
                    onClick={() => setActiveModal('privacy')}
                    className="hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-text-primary rounded-sm text-start"
                  >
                    {t.footer_privacy || 'Privacy Policy'}
                  </button>
                </li>
              </ul>
            </div>

            {/* Column 3: Follow */}
            <div className="text-start flex flex-col gap-3">
              <h3 className="text-[10px] uppercase tracking-[0.25em] font-bold text-text-muted">
                {t.footer_follow || 'Follow'}
              </h3>
              <ul className="flex flex-col gap-2.5 text-xs text-text-secondary">
                <li>
                  <a
                    href="https://instagram.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-text-primary rounded-sm"
                    aria-label="Instagram (opens in new tab)"
                  >
                    <span>Instagram</span>
                    <ArrowUpRight className="w-3 h-3 opacity-60" aria-hidden="true" />
                  </a>
                </li>
                <li>
                  <a
                    href="https://twitter.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-text-primary rounded-sm"
                    aria-label="Twitter (opens in new tab)"
                  >
                    <span>Twitter</span>
                    <ArrowUpRight className="w-3 h-3 opacity-60" aria-hidden="true" />
                  </a>
                </li>
              </ul>
            </div>
          </div>

          {/* Bottom Copyright & Tax Notice */}
          <div className="pt-8 border-t border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 text-[11px] text-text-secondary/70 font-sans tracking-normal">
            <p>&copy; {new Date().getFullYear()} {t.footer_rights || 'DineView Restaurant. All rights reserved.'}</p>
            <p>{t.all_prices || 'All prices are in INR and exclusive of taxes.'}</p>
          </div>
        </div>
      </footer>

      {/* Accessible Modals for Information items */}
      {activeModal && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setActiveModal(null);
          }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="footer-modal-title"
        >
          <div 
            className="bg-bg-primary border border-border rounded-sm max-w-lg w-full p-6 md:p-8 shadow-xl relative text-text-primary flex flex-col gap-5 max-h-[85vh] overflow-y-auto"
            dir={isRTL ? 'rtl' : 'ltr'}
          >
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setActiveModal(null)}
              className="absolute top-4 end-4 p-2 text-text-secondary hover:text-text-primary transition-colors focus:outline-none focus-visible:ring-1 focus-visible:ring-text-primary rounded-sm"
              aria-label="Close dialog"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Content */}
            {activeModal === 'about' && (
              <>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-text-muted block mb-1">
                    {t.our_story || 'Our Story'}
                  </span>
                  <h2 id="footer-modal-title" className="text-2xl font-serif font-bold text-text-primary">
                    {t.about_title || 'The Experience'}
                  </h2>
                </div>
                <p className="text-sm text-text-secondary leading-relaxed">
                  {t.about_desc || 'A culinary journey blending traditional European techniques with seasonal, locally-sourced ingredients, curated by Executive Chef Julian Vance.'}
                </p>
                <div className="pt-3 border-t border-border/60 text-xs text-text-secondary leading-relaxed space-y-2">
                  <p>
                    At DineView, every plate reflects our dedication to sustainable sourcing, artisanal fermentation, and timeless gastronomy. We collaborate directly with organic growers and coastal purveyors to present an evocative tasting experience.
                  </p>
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      setActiveModal(null);
                      onNavigate('menu', e);
                    }}
                    className="px-5 py-2.5 text-xs font-medium uppercase tracking-widest bg-text-primary text-bg-primary hover:opacity-90 transition-opacity rounded-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-text-primary"
                  >
                    {t.nav_menu || 'Explore Menu'}
                  </button>
                </div>
              </>
            )}

            {activeModal === 'contact' && (
              <>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-text-muted block mb-1">
                    {t.footer_information || 'Information'}
                  </span>
                  <h2 id="footer-modal-title" className="text-2xl font-serif font-bold text-text-primary">
                    {t.footer_contact || 'Contact & Inquiries'}
                  </h2>
                </div>
                <div className="flex flex-col gap-4 text-xs text-text-secondary py-1">
                  <div className="flex items-start gap-3">
                    <MapPin className="w-4 h-4 text-text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-text-primary">{t.location || '123 Culinary Ave, Food District'}</p>
                      <p className="text-text-muted text-[11px]">Mumbai, Maharashtra 400001</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="w-4 h-4 text-text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium text-text-primary">{t.daily || 'Daily'}</p>
                      <p className="text-text-muted text-[11px]">{t.open_time || '12:00 PM - 11:00 PM'}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Phone className="w-4 h-4 text-text-primary shrink-0 mt-0.5" />
                    <div>
                      <a href="tel:+912255501928" className="font-medium text-text-primary hover:underline">
                        +91 22 5550 1928
                      </a>
                      <p className="text-text-muted text-[11px]">Table reservations & events</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Mail className="w-4 h-4 text-text-primary shrink-0 mt-0.5" />
                    <div>
                      <a href="mailto:reservations@dineview.com" className="font-medium text-text-primary hover:underline">
                        reservations@dineview.com
                      </a>
                      <p className="text-text-muted text-[11px]">Concierge & guest services</p>
                    </div>
                  </div>
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-5 py-2.5 text-xs font-medium uppercase tracking-widest bg-text-primary text-bg-primary hover:opacity-90 transition-opacity rounded-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-text-primary"
                  >
                    Close
                  </button>
                </div>
              </>
            )}

            {activeModal === 'privacy' && (
              <>
                <div>
                  <span className="text-[10px] uppercase tracking-[0.25em] font-bold text-text-muted block mb-1">
                    {t.footer_information || 'Information'}
                  </span>
                  <h2 id="footer-modal-title" className="text-2xl font-serif font-bold text-text-primary">
                    {t.footer_privacy || 'Privacy Policy'}
                  </h2>
                </div>
                <div className="space-y-3 text-xs text-text-secondary leading-relaxed">
                  <p>
                    <strong className="text-text-primary block mb-0.5">Dining Sessions & Orders:</strong>
                    Your cart items and active orders are stored strictly within your current session to facilitate digital ordering and payment at our counter.
                  </p>
                  <p>
                    <strong className="text-text-primary block mb-0.5">Language Preferences:</strong>
                    We store your chosen display language locally so your dining experience remains consistent across all 13 supported languages.
                  </p>
                  <p>
                    <strong className="text-text-primary block mb-0.5">Zero Third-Party Tracking:</strong>
                    DineView does not sell your personal information or deploy third-party advertising tracking cookies.
                  </p>
                  <p className="text-text-muted text-[11px] pt-1">
                    For privacy inquiries, contact our data protection officer at privacy@dineview.com.
                  </p>
                </div>
                <div className="pt-2 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setActiveModal(null)}
                    className="px-5 py-2.5 text-xs font-medium uppercase tracking-widest bg-text-primary text-bg-primary hover:opacity-90 transition-opacity rounded-sm focus:outline-none focus-visible:ring-1 focus-visible:ring-text-primary"
                  >
                    Close
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};
