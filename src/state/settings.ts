import { useSyncExternalStore } from 'react';
import type { Lang } from '../data/types';
import { createStore } from './store';

export type ThemePref = 'system' | 'light' | 'dark';

interface Settings {
  theme: ThemePref;
  lang: Lang;
}

function defaultLang(): Lang {
  try {
    const l = navigator.language?.toLowerCase() ?? 'tr';
    return l.startsWith('tr') ? 'tr' : l.startsWith('en') ? 'en' : 'tr';
  } catch {
    return 'tr';
  }
}

const store = createStore<Settings>('pota:settings', { theme: 'system', lang: defaultLang() });
const darkQuery = typeof window !== 'undefined' ? window.matchMedia('(prefers-color-scheme: dark)') : null;

export const useSettings = store.useStore;
export const getSettings = store.get;

function apply(s: Settings) {
  const root = document.documentElement;
  if (s.theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', s.theme);
  root.lang = s.lang;
  const dark = resolveDark(s.theme);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => {
    if (s.theme === 'system') {
      const media = m.getAttribute('media') ?? '';
      m.setAttribute('content', media.includes('dark') ? '#101318' : '#f1f3f6');
    } else m.setAttribute('content', dark ? '#101318' : '#f1f3f6');
  });
}

store.subscribe(() => apply(store.get()));
apply(store.get());

export function setTheme(theme: ThemePref) {
  store.set({ theme });
}

export function setLang(lang: Lang) {
  store.set({ lang });
}

function resolveDark(theme: ThemePref): boolean {
  if (theme === 'dark') return true;
  if (theme === 'light') return false;
  return !!darkQuery?.matches;
}

function subscribeSystem(cb: () => void) {
  darkQuery?.addEventListener('change', cb);
  const off = store.subscribe(cb);
  return () => {
    darkQuery?.removeEventListener('change', cb);
    off();
  };
}

/** The theme actually on screen ("system" resolved through the OS setting). */
export function useResolvedTheme(): 'light' | 'dark' {
  return useSyncExternalStore(subscribeSystem, () => (resolveDark(store.get().theme) ? 'dark' : 'light'));
}
