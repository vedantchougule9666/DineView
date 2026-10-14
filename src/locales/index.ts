import { LanguageCode, LanguageInfo, Translations } from './types';
import { en } from './en';
import { fr } from './fr';
import { es } from './es';
import { hi } from './hi';
import { ta } from './ta';
import { mr } from './mr';
import { bn } from './bn';
import { te } from './te';
import { gu } from './gu';
import { kn } from './kn';
import { ml } from './ml';
import { pa } from './pa';
import { ur } from './ur';

export * from './types';

export const SUPPORTED_LANGUAGES: LanguageInfo[] = [
  { code: 'en', name: 'English', nativeName: 'English', dir: 'ltr' },
  { code: 'fr', name: 'French', nativeName: 'Français', dir: 'ltr' },
  { code: 'es', name: 'Spanish', nativeName: 'Español', dir: 'ltr' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', dir: 'ltr' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', dir: 'ltr' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', dir: 'ltr' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', dir: 'ltr' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', dir: 'ltr' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', dir: 'ltr' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', dir: 'ltr' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', dir: 'ltr' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', dir: 'ltr' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', dir: 'rtl' },
];

export const TRANSLATIONS: Record<LanguageCode, Translations> = {
  en,
  fr,
  es,
  hi,
  ta,
  mr,
  bn,
  te,
  gu,
  kn,
  ml,
  pa,
  ur,
};

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export function isSupportedLanguage(lang: string): lang is LanguageCode {
  return SUPPORTED_LANGUAGES.some((l) => l.code === lang);
}

export function isRtlLanguage(lang: string): boolean {
  return lang === 'ur';
}

export function getLanguageInfo(lang: string): LanguageInfo {
  return SUPPORTED_LANGUAGES.find((l) => l.code === lang) || SUPPORTED_LANGUAGES[0];
}

/**
 * Fallback System:
 * 1. Try selected language dictionary
 * 2. If missing or empty, fall back to English dictionary
 * 3. If missing in English, use fallback string provided
 * 4. Never return null, undefined, or empty object
 */
export function getTranslation(
  lang: string,
  key: string,
  fallback?: string
): string {
  if (!key || typeof key !== 'string') {
    return fallback || '';
  }
  const targetCode = isSupportedLanguage(lang) ? lang : DEFAULT_LANGUAGE;
  const langDict = TRANSLATIONS[targetCode];
  
  if (langDict && typeof langDict[key] === 'string' && langDict[key].trim().length > 0) {
    return langDict[key];
  }
  
  const enDict = TRANSLATIONS.en;
  if (enDict && typeof enDict[key] === 'string' && enDict[key].trim().length > 0) {
    return enDict[key];
  }

  return fallback || key.replace(/[._-]/g, ' ');
}
