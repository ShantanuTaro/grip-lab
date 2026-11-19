// Routing for three screens with the History API. No library needed at this size.

import { useSyncExternalStore } from 'react';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';

const listeners = new Set<() => void>();

export function navigate(to: string, replace = false) {
  history[replace ? 'replaceState' : 'pushState'](null, '', to);
  listeners.forEach((listener) => listener());
  window.scrollTo(0, 0);
}

export function usePath(): string {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      addEventListener('popstate', listener);
      return () => {
        listeners.delete(listener);
        removeEventListener('popstate', listener);
      };
    },
    () => location.pathname,
  );
}

/** A real link (it has an href, so open-in-new-tab works) that changes screen without reloading. */
export function Link({ to, ...rest }: { to: string } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const go = (e: MouseEvent) => {
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigate(to);
  };
  return <a href={to} onClick={go} {...rest} />;
}
