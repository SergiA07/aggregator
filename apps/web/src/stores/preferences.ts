import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { SupportedLocale } from '@/lib/i18n/types';

/**
 * Detects the user's preferred locale from browser settings.
 * Falls back to 'en' if no supported locale is found.
 */
function detectBrowserLocale(): SupportedLocale {
  if (typeof navigator === 'undefined') return 'en';

  // Check navigator.languages first, then navigator.language
  const browserLocales = navigator.languages ?? [navigator.language];

  for (const browserLocale of browserLocales) {
    // Check for exact match (e.g., 'es', 'ca')
    if (browserLocale === 'en' || browserLocale === 'es' || browserLocale === 'ca') {
      return browserLocale;
    }
    // Check for language-only match (e.g., 'es-MX' -> 'es', 'ca-ES' -> 'ca')
    const lang = browserLocale.split('-')[0];
    if (lang === 'en' || lang === 'es' || lang === 'ca') {
      return lang as SupportedLocale;
    }
  }

  return 'en';
}

interface PreferencesState {
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  locale: SupportedLocale;
  toggleSidebar: () => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
  setLocale: (locale: SupportedLocale) => void;
}

export const usePreferences = create<PreferencesState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'system',
      locale: detectBrowserLocale(),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setTheme: (theme) => set({ theme }),
      setLocale: (locale) => set({ locale }),
    }),
    { name: 'user-preferences' },
  ),
);
