// The grip presets, and the words a coach uses in place of the numbers: one typed place to tune starting values.
// Speed, seam angle, spin and length are from SPEC.md, except the off-break's spin: 1,700 rpm, the measured elite
// average (LEVELS). Each coach word stands for a measured value, with its source beside it.

import type { Delivery, SpinAxis } from './simulate.ts';

interface Grip {
  id: string;
  name: string;
  kind: 'pace' | 'spin';
  /** One line for menus. */
  blurb: string;
  speedKph: number;
  /** + points to the slips (swings away from a right-hander). */
  seamAngleDeg: number;
  /** + turns into a right-hander. For a spinner, an elite bowler's figure (LEVELS). */
  spinRpm: number;
  /** Metres from the batter's stumps. */
  lengthM: number;
  spinAxis: SpinAxis;
  /** Spin grips: finger or wrist spin, which sets the revs at each level (LEVELS). */
  spinner?: 'finger' | 'wrist';
}

const DEG = Math.PI / 180;

/** A spin axis from its direction, 0° for pure over-spin to 90° for pure side-spin, and its tilt, which drifts the ball. */
const spinAxis = (directionDeg: number, tiltDeg: number): SpinAxis => ({
  top: Math.cos(directionDeg * DEG) * Math.cos(tiltDeg * DEG),
  drift: Math.sin(tiltDeg * DEG),
});

/** The direction of an axis, 0° for pure over-spin to 90° for pure side-spin: `spinAxis` the other way round. */
export const spinDirection = (a: SpinAxis) => Math.atan2(Math.sqrt(Math.max(0, 1 - a.top ** 2 - a.drift ** 2)), a.top) / DEG;

/** The same axis turned `deg` toward side-spin (toward over-spin if negative), keeping its tilt. */
export const turnAxis = (a: SpinAxis, deg: number) => spinAxis(Math.min(90, Math.max(0, spinDirection(a) + deg)), Math.asin(a.drift) / DEG);

// Spin axes. Without them a googly and an off-break are the same ball. The off-break's and leg-break's were measured
// with markers on the ball (Beach, Ferdinands & Sinclair, ISBS 2012, 10 club and state spinners): off-spinners' axes
// pointed 48 to 65° from pure over-spin, 59° on average, leg-spinners' 27 to 50°, 40° on average, tilted about 12°.
const NO_TILT: SpinAxis = { top: 0, drift: 0 }; // used only if spin is dialled in on a seam grip
const CUTTER: SpinAxis = { top: -0.3, drift: 0.2 }; // estimate: fingers cut down the side, keeping some backspin
const OFF_BREAK = spinAxis(59, 12);
const LEG_BREAK = spinAxis(40, 12);
const GOOGLY: SpinAxis = { top: 0.6, drift: 0.15 }; // estimate: more over-spin than an off-break, so it dips and bounces more

export const GRIPS = [
  { id: 'seam-up', name: 'Seam-up', kind: 'pace', blurb: 'Stock pace delivery', speedKph: 132, seamAngleDeg: 0, spinRpm: 0, lengthM: 6.5, spinAxis: NO_TILT },
  { id: 'outswinger', name: 'Outswinger', kind: 'pace', blurb: 'Seam angled to the slips', speedKph: 132, seamAngleDeg: 22, spinRpm: 0, lengthM: 5.5, spinAxis: NO_TILT },
  { id: 'inswinger', name: 'Inswinger', kind: 'pace', blurb: 'Seam angled to fine leg', speedKph: 130, seamAngleDeg: -22, spinRpm: 0, lengthM: 5.5, spinAxis: NO_TILT },
  { id: 'off-cutter', name: 'Off-cutter', kind: 'pace', blurb: 'Cut at pace, moves in', speedKph: 122, seamAngleDeg: 0, spinRpm: 900, lengthM: 6.5, spinAxis: CUTTER },
  { id: 'leg-cutter', name: 'Leg-cutter', kind: 'pace', blurb: 'Cut at pace, moves away', speedKph: 122, seamAngleDeg: 0, spinRpm: -900, lengthM: 6.5, spinAxis: CUTTER },
  { id: 'off-break', name: 'Off-break', kind: 'spin', blurb: 'Finger spin, turns in', speedKph: 86, seamAngleDeg: 0, spinRpm: 1700, lengthM: 4.5, spinAxis: OFF_BREAK, spinner: 'finger' },
  { id: 'leg-break', name: 'Leg-break', kind: 'spin', blurb: 'Wrist spin, turns away', speedKph: 84, seamAngleDeg: 0, spinRpm: -2200, lengthM: 4.5, spinAxis: LEG_BREAK, spinner: 'wrist' },
  { id: 'googly', name: 'Googly', kind: 'spin', blurb: 'Wrist spin that turns in', speedKph: 82, seamAngleDeg: 0, spinRpm: 1800, lengthM: 4.5, spinAxis: GOOGLY, spinner: 'wrist' },
] as const satisfies readonly Grip[];

export type GripId = (typeof GRIPS)[number]['id'];

export const grip = (id: GripId): Grip => GRIPS.find((g) => g.id === id)!;

/** A grip's preset as a full delivery: right arm over the wicket, right-handed batter, new ball, pitching on off stump. */
export function delivery(id: GripId, changes: Partial<Delivery> = {}): Delivery {
  const g = grip(id);
  return {
    speedKph: g.speedKph,
    seamAngleDeg: g.seamAngleDeg,
    spinRpm: g.spinRpm,
    spinAxis: g.spinAxis,
    lengthM: g.lengthM,
    lineCm: -8,
    arm: 'right',
    batter: 'right',
    ball: 'new',
    ...changes,
  };
}

/**
 * Revs in words: the spinner's level, which a coach knows when nobody knows the rpm. Better spinners spun it harder in
 * every study. Finger spin: lower-grade club 980 to 1,210 rpm, first grade 1,610 to 1,700 (Beach 2012); sub-elite 1,330
 * (Chin et al., Sports Biomechanics 2009); ECB development squad 1,550, England squad 1,770 (Justham, West & Cork, Proc.
 * IMechE P 2008); elite 1,685 ± 170, up to 2,143 (Sanders, Felton & King, J. Sports Sciences 2018). Wrist spin:
 * third-grade club 1,460 to 1,670 (Beach 2012); A-grade club 1,667 to 1,922 (Keith, Britton & Liow, AFMC 2012); elite
 * 2,209 ± 232, up to 2,553 (Sanders, PhD thesis, Loughborough 2019).
 */
export const LEVELS = [
  { id: 'club', name: 'Club', finger: 1100, wrist: 1550 },
  { id: 'academy', name: 'Academy', finger: 1500, wrist: 1800 },
  { id: 'elite', name: 'Elite', finger: 1700, wrist: 2200 },
  { id: 'big', name: 'Big spinner', finger: 2000, wrist: 2500 },
] as const;

export type Level = (typeof LEVELS)[number]['id'];

/** A grip's spin at a level: a spinner's preset (an elite figure) scaled by the level's share of elite. Seam grips keep theirs. */
export function revs(id: GripId, level: Level): number {
  const g = grip(id);
  if (!g.spinner) return g.spinRpm;
  const at = (l: Level) => LEVELS.find((x) => x.id === l)![g.spinner!];
  return Math.round((g.spinRpm * at(level)) / at('elite') / 10) * 10;
}

/**
 * How far a seam bowler angles the seam, in words. Swing bowlers were measured at 24.6 ± 16.8° for inswing and about
 * 21° for outswing, within 10 to 30° (Lindsay & Spratford, ISBS 2021), and swing peaks near 20° (SWING_VS_SEAM_ANGLE in
 * constants.ts). "Pointing at first slip" is a figure of speech: first slip stands about 3 m wide of the line, some 35 m
 * from the bowler's hand, so only about 5° off it.
 */
export const SEAM_ANGLES = [
  { id: 'little', name: 'A little', deg: 10 },
  { id: 'typical', name: 'Typical', deg: 22 },
  { id: 'lot', name: 'A lot', deg: 30 },
] as const;

/**
 * Length in words: each name, where its band ends (metres from the batter's stumps) and the length a click on it gives.
 * Pace: The Cricket Monthly's Hawk-Eye bands (full to 6 m, good length 6 to 8, back of a length 8 to 9, short beyond),
 * with a yorker inside 2 m. Spin: Test spinners pitch half their balls 3.7 to 5.1 m out, against 6.0 to 8.4 m for
 * seamers (165,000 spinners' balls in the Hawk-Eye file in README, "Real tracking data").
 */
export const LENGTHS: Record<'pace' | 'spin', readonly (readonly [name: string, end: number, click: number])[]> = {
  pace: [
    ['Yorker', 2, 1.5],
    ['Full', 6, 4.5],
    ['Good length', 8, 7],
    ['Back of a length', 9, 8.5],
    ['Short', Infinity, 10],
  ],
  spin: [
    ['Yorker', 2, 1.5],
    ['Full', 3.5, 2.5],
    ['Good length', 5.5, 4.5],
    ['Short', Infinity, 6.5],
  ],
};

export const lengthName = (m: number, kind: 'pace' | 'spin') => LENGTHS[kind].find(([, end]) => m < end)![0];

/**
 * Line in words, in cm from middle stump where the ball pitches (− the off side). The stumps stand 9.5 cm apart, centre
 * to centre (Law 8: 22.86 cm across three stumps up to 3.81 cm thick), so the 4th stump is 19 cm outside middle.
 */
export const LINES = [
  ['Leg', 9.5],
  ['Middle', 0],
  ['Off', -9.5],
  ['4th', -19],
  ['5th', -28.5],
] as const;

export function lineName(cm: number): string {
  const a = Math.abs(cm);
  if (a <= 4) return 'Middle stump';
  if (a <= 14) return cm < 0 ? 'Off stump' : 'Leg stump';
  if (cm < 0 && a <= 24) return '4th stump';
  if (cm < 0 && a <= 33) return '5th stump';
  return `${Math.round(a - 11)} cm outside ${cm < 0 ? 'off' : 'leg'}`;
}
