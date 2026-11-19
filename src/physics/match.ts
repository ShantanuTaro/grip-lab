// Working back from what a coach saw (how far the ball swung or turned, how long it took to arrive) to the numbers
// nobody knows: the seam angle, the revs and the release speed. Each searches one setting, with everything else as set.

import { simulate, turnCm } from './simulate.ts';
import type { Delivery } from './simulate.ts';
import type { Conditions, Venue } from './venues.ts';

export interface Match {
  /** The setting that gives what was seen, or null if none in its range does. */
  value: number | null;
  /** The least and most the setting's range gives, to say why there is no match. */
  reach: [number, number];
}

/** Bisection: the x in [lo, hi] where f(x) = target, for f rising or falling across the range. */
function solve(f: (x: number) => number, target: number, lo: number, hi: number): Match {
  let fLo = f(lo);
  const fHi = f(hi);
  const reach: [number, number] = [Math.min(fLo, fHi), Math.max(fLo, fHi)];
  if (!(target >= reach[0] && target <= reach[1])) return { value: null, reach };
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    const fMid = f(mid);
    if ((fMid - target) * (fLo - target) <= 0) hi = mid;
    else [lo, fLo] = [mid, fMid];
  }
  return { value: (lo + hi) / 2, reach };
}

/**
 * The steady seam angle (°, + to the slips) that swings the ball `swingCm` (+ away from the batter). Searched up to 20°
 * either way, where swing is strongest (SWING_VS_SEAM_ANGLE), so the answer is the smallest angle that does it.
 */
export const seamFor = (d: Delivery, v: Venue | Conditions, swingCm: number) =>
  solve((a) => simulate({ ...d, seamAngleDeg: a, wobble: undefined }, undefined, v).swingCm, swingCm, -20, 20);

/** The revs (rpm, the grip's way) that move the ball `cm` off its line by the stumps. Searched up to 3,000 rpm. */
export function revsFor(d: Delivery, v: Venue | Conditions, cm: number): Match {
  const way = Math.sign(d.spinRpm) || 1;
  return solve((rpm) => Math.abs(turnCm(simulate({ ...d, spinRpm: way * rpm }, undefined, v))), cm, 0, 3000);
}

/** The release speed (kph) that takes `seconds` from the hand to the batter's stumps. Searched from 60 to 160 kph. */
export const speedFor = (d: Delivery, v: Venue | Conditions, seconds: number) =>
  solve((kph) => simulate({ ...d, speedKph: kph }, undefined, v).timeToStumpsS, seconds, 60, 160);
