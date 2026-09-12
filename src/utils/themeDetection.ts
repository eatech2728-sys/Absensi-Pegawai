import { ThemeMode } from '../types';

const THEME_MODE_STORAGE_KEY = 'absensi_theme_mode';
const LEGACY_THEME_STORAGE_KEY = 'absensi_theme';

/**
 * Detects whether the user's OS currently prefers a dark color scheme.
 */
export function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return false;
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

/**
 * Retrieves the stored theme mode preference.
 * Defaults to 'system' so the app automatically respects the user's OS settings.
 */
export function getStoredThemeMode(): ThemeMode {
  if (typeof window === 'undefined') return 'system';
  try {
    const stored = localStorage.getItem(THEME_MODE_STORAGE_KEY);
    if (stored === 'system' || stored === 'dark' || stored === 'light') {
      return stored as ThemeMode;
    }
    // Backward compatibility with previous 'absensi_theme' key ('dark' / 'light')
    const legacy = localStorage.getItem(LEGACY_THEME_STORAGE_KEY);
    if (legacy === 'dark' || legacy === 'light') {
      return legacy as ThemeMode;
    }
    return 'system';
  } catch {
    return 'system';
  }
}

/**
 * Persists the user's theme mode selection.
 */
export function saveThemeMode(mode: ThemeMode): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(THEME_MODE_STORAGE_KEY, mode);
    // Keep legacy key updated for backwards compatibility
    if (mode === 'system') {
      localStorage.setItem(LEGACY_THEME_STORAGE_KEY, getSystemPrefersDark() ? 'dark' : 'light');
    } else {
      localStorage.setItem(LEGACY_THEME_STORAGE_KEY, mode);
    }
  } catch {}
}

/**
 * Applies or removes the 'dark' class on document.documentElement
 * and updates browser meta theme-color.
 */
export function applyThemeClass(isDark: boolean): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  if (isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }

  // Synchronize browser address bar color
  const metaThemeColor = document.querySelector('meta[name="theme-color"]');
  if (metaThemeColor) {
    metaThemeColor.setAttribute('content', isDark ? '#0f172a' : '#2563eb');
  }
}

/**
 * Sets up a real-time listener for OS / system color scheme preferences.
 * Invokes callback whenever the user toggles dark/light mode in their OS settings.
 *
 * @param callback Function called with new system preference (true = dark, false = light)
 * @returns Cleanup unlisten function
 */
export function watchSystemThemePreference(
  callback: (isDark: boolean) => void
): () => void {
  if (typeof window === 'undefined' || !window.matchMedia) {
    return () => {};
  }

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

  const handler = (event: MediaQueryListEvent | MediaQueryList) => {
    callback(event.matches);
  };

  if (mediaQuery.addEventListener) {
    mediaQuery.addEventListener('change', handler);
    return () => {
      mediaQuery.removeEventListener('change', handler);
    };
  } else if ((mediaQuery as any).addListener) {
    // Fallback for older WebKit / Safari
    (mediaQuery as any).addListener(handler);
    return () => {
      (mediaQuery as any).removeListener(handler);
    };
  }

  return () => {};
}
