// The scene's colours come from the same CSS tokens as the page (src/index.css), read again when the mode changes.

import { useMemo } from 'react';
import type { BallType } from '../physics/constants.ts';
import { useDark } from '../theme.ts';

const NAMES = ['sky', 'stands', 'grass', 'pitch', 'action', 'ring', 'ball', 'pink-ball', 'white-ball', 'crease', 'stumps'] as const;

export type Palette = Record<(typeof NAMES)[number], string> & { dark: boolean };

/** The token for a ball's leather: the three red balls share the leather red. */
export const leather = (t: BallType = 'kookaburra') => (t === 'pink' || t === 'white' ? (`${t}-ball` as const) : 'ball');

export function usePalette(): Palette {
  const dark = useDark();
  return useMemo(() => {
    const css = getComputedStyle(document.documentElement);
    const p = { dark } as Palette;
    for (const n of NAMES) p[n] = css.getPropertyValue(`--${n}`).trim();
    return p;
  }, [dark]);
}
