import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Globe, Check, ChevronDown } from 'lucide-react';
import { useLanguage } from '../context/LanguageContext';
import { LanguageCode } from '../locales';

export const LanguageSelector: React.FC = () => {
  const { lang, setLang, currentLanguage, languages, isRTL, t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard accessibility (Escape, ArrowUp, ArrowDown, Home, End)
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (!isOpen) {
        if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setIsOpen(true);
        }
        return;
      }

      const currentIndex = languages.findIndex((l) => l.code === lang);

      if (e.key === 'Escape') {
        e.preventDefault();
        setIsOpen(false);
        triggerRef.current?.focus();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % languages.length;
        optionsRef.current[nextIndex]?.focus();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + languages.length) % languages.length;
        optionsRef.current[prevIndex]?.focus();
      } else if (e.key === 'Home') {
        e.preventDefault();
        optionsRef.current[0]?.focus();
      } else if (e.key === 'End') {
        e.preventDefault();
        optionsRef.current[languages.length - 1]?.focus();
      }
    },
    [isOpen, languages, lang]
  );

  const handleSelect = (code: LanguageCode) => {
    setLang(code);
    setIsOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div 
      ref={containerRef} 
      className="relative inline-block text-start"
      onKeyDown={handleKeyDown}
    >
      <button
        ref={triggerRef}
        type="button"
        id="language-selector-button"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-label={`${t.select_language || 'Select language'}. ${currentLanguage.name}`}
        className="flex items-center gap-1.5 md:gap-2 px-2.5 py-1.5 rounded-full text-xs font-medium tracking-wide text-text-primary hover:text-accent hover:bg-border/30 transition-all border border-border/60 focus:outline-none focus:ring-1 focus:ring-accent"
      >
        <Globe className="w-3.5 h-3.5 md:w-4 md:h-4 text-text-secondary shrink-0" aria-hidden="true" />
        <span className="truncate max-w-[85px] sm:max-w-[120px] text-xs font-serif font-medium">
          {currentLanguage.name}
        </span>
        <ChevronDown 
          className={`w-3 h-3 text-text-muted transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180' : ''
          }`} 
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          id="language-dropdown-menu"
          role="listbox"
          aria-label={t.select_language || 'Available languages'}
          className={`absolute z-50 mt-2 min-w-[210px] w-56 max-h-80 overflow-y-auto bg-bg-primary border border-border shadow-xl rounded-md py-1.5 text-xs text-text-primary transition-all duration-150 animate-in fade-in zoom-in-95 ${
            isRTL ? 'left-0 origin-top-left' : 'right-0 origin-top-right'
          }`}
        >
          <div className="px-3 py-1.5 border-b border-border/50 text-[10px] font-bold uppercase tracking-wider text-text-muted">
            {t.select_language || 'Select Language'}
          </div>

          <div className="py-1">
            {languages.map((l, index) => {
              const isSelected = l.code === lang;
              return (
                <button
                  key={l.code}
                  ref={(el) => (optionsRef.current[index] = el)}
                  id={`language-option-${l.code}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(l.code)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-start transition-colors cursor-pointer ${
                    isSelected
                      ? 'bg-border/40 text-accent font-semibold'
                      : 'text-text-primary hover:bg-border/20 hover:text-accent'
                  }`}
                >
                  <div className="flex flex-col text-start">
                    <span className="font-serif text-sm leading-snug">
                      {l.name}
                    </span>
                    {l.nativeName !== l.name && (
                      <span className="text-[10px] text-text-muted leading-tight">
                        {l.nativeName}
                      </span>
                    )}
                  </div>
                  {isSelected && (
                    <Check className="w-3.5 h-3.5 text-accent shrink-0 ms-2" aria-hidden="true" />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
