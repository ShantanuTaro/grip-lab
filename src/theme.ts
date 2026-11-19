// Light or dark: the device setting unless the header switch says otherwise. The choice is remembered.
// index.html sets data-theme before first paint, so the page never flashes the wrong mode.

import { useSyncExternalStore } from 'react';

export type Theme = 'auto' | 'dark' | 'light';

const KEY = 'theme';
const media = matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set<() => void>();

function saved(): Theme {
  try {
    const t = localStorage.getItem(KEY);
    return t === 'dark' || t === 'light' ? t : 'auto';
  } catch {
    return 'auto'; // storage blocked: follow the device
  }
}

let theme = saved();
media.addEventListener('change', () => listeners.forEach((l) => l()));

export function setTheme(next: Theme) {
  theme = next;
  try {
    if (next === 'auto') localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, next);
  } catch {
    // not remembered, but still applied
  }
  if (next === 'auto') delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = next;
  listeners.forEach((l) => l());
}

const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => void listeners.delete(l);
};

export const useTheme = () => useSyncExternalStore(subscribe, () => theme);
/** The mode actually showing. */
export const useDark = () => useSyncExternalStore(subscribe, () => (theme === 'auto' ? media.matches : theme === 'dark'));
