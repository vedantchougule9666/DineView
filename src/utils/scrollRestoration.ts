const MENU_SCROLL_KEY = 'dineview_menu_scroll_y';
let inMemoryScrollY: number | null = null;

/**
 * Saves the current window.scrollY offset before navigating away from the menu.
 */
export function saveMenuScrollPosition(): void {
  if (typeof window === 'undefined') return;
  const currentY = window.scrollY;
  inMemoryScrollY = currentY;
  try {
    sessionStorage.setItem(MENU_SCROLL_KEY, String(currentY));
  } catch {
    // Ignore storage errors (e.g. private browsing mode)
  }
}

/**
 * Retrieves the saved scroll position, clears it from storage,
 * and returns the numeric Y offset, or null if none was saved.
 */
export function getAndClearMenuScrollPosition(): number | null {
  if (typeof window === 'undefined') return null;
  let savedY: number | null = null;
  try {
    const raw = sessionStorage.getItem(MENU_SCROLL_KEY);
    if (raw !== null) {
      sessionStorage.removeItem(MENU_SCROLL_KEY);
      const parsed = parseFloat(raw);
      if (!isNaN(parsed)) {
        savedY = parsed;
      }
    }
  } catch {
    // Ignore storage errors
  }

  if (savedY === null && inMemoryScrollY !== null) {
    savedY = inMemoryScrollY;
  }
  inMemoryScrollY = null;
  return savedY;
}

/**
 * Clears any stored menu scroll position.
 */
export function clearMenuScrollPosition(): void {
  inMemoryScrollY = null;
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(MENU_SCROLL_KEY);
  } catch {
    // Ignore storage errors
  }
}
