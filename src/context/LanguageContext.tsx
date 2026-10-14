import React, { createContext, useContext, useEffect, useState, useMemo, useCallback } from 'react';
import {
  DEFAULT_LANGUAGE,
  isRtlLanguage,
  isSupportedLanguage,
  LanguageCode,
  LanguageInfo,
  SUPPORTED_LANGUAGES,
  TRANSLATIONS,
  Translations,
  getLanguageInfo,
} from '../locales';

const STORAGE_KEY = 'dineview_lang';

interface LanguageContextType {
  lang: LanguageCode;
  setLang: (lang: LanguageCode) => void;
  t: Translations;
  isRTL: boolean;
  currentLanguage: LanguageInfo;
  languages: LanguageInfo[];
  tKey: (key: string, fallback?: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<LanguageCode>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && isSupportedLanguage(saved)) {
        return saved;
      }
    } catch {
      // Ignore localStorage access errors (e.g. private browsing)
    }
    return DEFAULT_LANGUAGE;
  });

  const setLang = useCallback((newLang: LanguageCode) => {
    if (isSupportedLanguage(newLang)) {
      setLangState(newLang);
      try {
        localStorage.setItem(STORAGE_KEY, newLang);
      } catch {
        // Ignore localStorage write errors
      }
    }
  }, []);

  const isRTL = useMemo(() => isRtlLanguage(lang), [lang]);
  const currentLanguage = useMemo(() => getLanguageInfo(lang), [lang]);

  // Update HTML tag attributes whenever language changes
  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRTL ? 'rtl' : 'ltr';
    if (isRTL) {
      document.body.classList.add('rtl-layout');
    } else {
      document.body.classList.remove('rtl-layout');
    }
  }, [lang, isRTL]);

  // Translation proxy object: guarantees fallback to English if key missing or undefined
  const t = useMemo(() => {
    const currentDict = TRANSLATIONS[lang] || TRANSLATIONS.en;
    const enDict = TRANSLATIONS.en;

    return new Proxy(currentDict, {
      get(target, prop, receiver) {
        // Only string keys can be translation keys; delegate symbols to Reflect
        if (typeof prop !== 'string') {
          return Reflect.get(target, prop, receiver);
        }

        // Return language-specific translation if present and non-empty string
        if (Object.prototype.hasOwnProperty.call(target, prop)) {
          const val = target[prop as keyof typeof target];
          if (typeof val === 'string' && val.trim().length > 0) {
            return val;
          }
        }

        // Fallback to English dictionary if present and non-empty string
        if (Object.prototype.hasOwnProperty.call(enDict, prop)) {
          const val = enDict[prop as keyof typeof enDict];
          if (typeof val === 'string' && val.trim().length > 0) {
            return val;
          }
        }

        // Prevent treating proxy as Promise, React Element or custom JSON serializer
        if (prop === 'then' || prop === '$$typeof' || prop === 'toJSON') {
          return undefined;
        }

        // Delegate standard Object prototype methods (e.g. toString, valueOf)
        if (prop in Object.prototype) {
          return Reflect.get(target, prop, receiver);
        }

        // Graceful fallback for any missing string key - humanize the key rather than showing broken codes
        return prop.replace(/[._-]/g, ' ');
      },
    }) as Translations;
  }, [lang]);

  const tKey = useCallback(
    (key: string, fallback?: string): string => {
      if (!key || typeof key !== 'string') {
        return fallback || '';
      }
      const currentDict = TRANSLATIONS[lang];
      if (currentDict && typeof currentDict[key] === 'string' && currentDict[key].trim().length > 0) {
        return currentDict[key];
      }
      const enDict = TRANSLATIONS.en;
      if (enDict && typeof enDict[key] === 'string' && enDict[key].trim().length > 0) {
        return enDict[key];
      }
      return fallback || key.replace(/[._-]/g, ' ');
    },
    [lang]
  );

  const value = useMemo(
    () => ({
      lang,
      setLang,
      t,
      isRTL,
      currentLanguage,
      languages: SUPPORTED_LANGUAGES,
      tKey,
    }),
    [lang, setLang, t, isRTL, currentLanguage, tKey]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
};

export function useLanguage(): LanguageContextType {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}
