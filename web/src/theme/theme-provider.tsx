'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from 'react';
import type { ThemeMode } from '@/types/design-system';

type ThemeContextValue = {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
};

type ThemeSnapshot = {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
};

const ThemeContext = createContext<ThemeContextValue | null>(null);

const THEME_STORAGE_EVENT = 'enterprise-theme-change';
const SERVER_THEME_SNAPSHOT: ThemeSnapshot = Object.freeze({
  theme: 'system',
  resolvedTheme: 'light',
});

let cachedThemeRaw: string | null | undefined;
let cachedThemeSnapshot: ThemeSnapshot = SERVER_THEME_SNAPSHOT;

function isThemeMode(value: string | null): value is ThemeMode {
  return value === 'light' || value === 'dark' || value === 'system';
}

function resolveTheme(theme: ThemeMode): 'light' | 'dark' {
  if (theme !== 'system') {
    return theme;
  }

  return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function readThemeSnapshot(): ThemeSnapshot {
  if (typeof window === 'undefined') {
    return SERVER_THEME_SNAPSHOT;
  }

  const storedTheme = window.localStorage.getItem('theme');
  if (storedTheme === cachedThemeRaw) {
    return cachedThemeSnapshot;
  }

  const theme = isThemeMode(storedTheme) ? storedTheme : 'system';
  cachedThemeRaw = storedTheme;
  cachedThemeSnapshot = {
    theme,
    resolvedTheme: resolveTheme(theme),
  };

  return cachedThemeSnapshot;
}

function subscribeTheme(onStoreChange: () => void) {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleThemeChange = () => onStoreChange();
  const media = window.matchMedia('(prefers-color-scheme: dark)');

  window.addEventListener('storage', handleThemeChange);
  window.addEventListener(THEME_STORAGE_EVENT, handleThemeChange);
  media.addEventListener('change', handleThemeChange);

  return () => {
    window.removeEventListener('storage', handleThemeChange);
    window.removeEventListener(THEME_STORAGE_EVENT, handleThemeChange);
    media.removeEventListener('change', handleThemeChange);
  };
}

function notifyThemeSubscribers() {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(new Event(THEME_STORAGE_EVENT));
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const snapshot = useSyncExternalStore(subscribeTheme, readThemeSnapshot, () => SERVER_THEME_SNAPSHOT);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', snapshot.resolvedTheme === 'dark');
    document.documentElement.dataset.theme = snapshot.resolvedTheme;
  }, [snapshot.resolvedTheme]);

  const setTheme = useCallback((theme: ThemeMode) => {
    if (typeof window === 'undefined') {
      return;
    }

    window.localStorage.setItem('theme', theme);
    notifyThemeSubscribers();
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme: snapshot.theme,
    resolvedTheme: snapshot.resolvedTheme,
    setTheme,
  }), [setTheme, snapshot.resolvedTheme, snapshot.theme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }

  return context;
}
