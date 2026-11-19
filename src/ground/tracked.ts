// A team's tracked deliveries (from Hawk-Eye or similar), as a CSV, fitted to give one ground's bounce, grip,
// seam and swing. Runs in the browser: the file never leaves the device.

import { DEFAULT_COEFFS } from '../physics/constants.ts';
import { METRICS, METRIC_RANGE, fitDetermined } from '../physics/fit.ts';
import type { CoeffName, Metric, Observation } from '../physics/fit.ts';
import type { Delivery } from '../physics/simulate.ts';
import type { Venue } from '../physics/venues.ts';

const NUMBERS = { speedKph: [40, 170], seamAngleDeg: [-90, 90], spinRpm: [-4000, 4000], lengthM: [0.5, 16], lineCm: [-150, 150] } as const;
const CHOICES = { arm: ['right', 'left'], batter: ['right', 'left'], ball: ['new', 'old'] } as const;

/** A file to start from: the columns, and one made-up row. */
export const TEMPLATE =
  [...Object.keys(NUMBERS), ...Object.keys(CHOICES), ...METRICS].join(',') +
  '\n132,15,0,6.5,-10,right,right,new,0.43,0.6,18,0.8,62,12,113\n';

/**
 * Reads the CSV. The delivery columns are required; the measured columns (the metrics in physics/fit.ts) are
 * optional, and each row needs at least one. Throws with the row and column at fault.
 * ponytail: splits on commas, so a quoted field with a comma in it is not supported.
 */
export function readCsv(text: string): Observation[] {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('The file needs a header row and at least one delivery.');
  const head = lines[0].split(',').map((h) => h.trim());
  for (const k of [...Object.keys(NUMBERS), ...Object.keys(CHOICES)]) {
    if (!head.includes(k)) throw new Error(`Missing column "${k}". Start from the template.`);
  }
  return lines.slice(1).map((line, i) => {
    const cell = Object.fromEntries(line.split(',').map((c, j) => [head[j], c.trim()]));
    const row = `Row ${i + 2}`;
    const d: Record<string, unknown> = {};
    for (const [k, [lo, hi]] of Object.entries(NUMBERS)) {
      const v = Number(cell[k]);
      if (cell[k] === '' || !(v >= lo && v <= hi)) throw new Error(`${row}: ${k} must be a number from ${lo} to ${hi}, got "${cell[k] ?? ''}".`);
      d[k] = v;
    }
    for (const [k, allowed] of Object.entries(CHOICES)) {
      const v = cell[k]?.toLowerCase();
      if (!(allowed as readonly string[]).includes(v)) throw new Error(`${row}: ${k} must be ${allowed.join(' or ')}, got "${cell[k] ?? ''}".`);
      d[k] = v;
    }
    const observed: Partial<Record<Metric, number>> = {};
    for (const m of METRICS) {
      if (cell[m] === undefined || cell[m] === '') continue;
      const v = Number(cell[m]);
      const [lo, hi] = METRIC_RANGE[m];
      if (!(v >= lo && v <= hi)) throw new Error(`${row}: ${m} must be a number from ${lo} to ${hi}, got "${cell[m]}". A tracking glitch? Delete the row.`);
      observed[m] = v;
    }
    if (Object.keys(observed).length === 0) throw new Error(`${row}: no measurements. Fill in at least one of ${METRICS.join(', ')}.`);
    return { delivery: d as unknown as Delivery, observed };
  });
}

// Each pitch setting is a multiplier on one fitted coefficient.
const SETTINGS: [keyof Pick<Venue, 'bounce' | 'grip' | 'seam' | 'swing'>, CoeffName][] = [
  ['bounce', 'restitution'],
  ['grip', 'friction'],
  ['seam', 'seamKickDegPerDeg'],
  ['swing', 'swingCsMax'],
];

/**
 * Fits the ground's bounce, grip, seam and swing to its tracked deliveries, in its own air, wind and slope.
 * A setting the data cannot pin down (uncertain by more than a quarter, or run to the edge of its range) is
 * left as it was, the rest are fitted again without it, and the notes say so.
 */
export function fitGround(v: Venue, observations: Observation[]): { venue: Venue; notes: string[] } {
  const air: Venue = { ...v, bounce: 1, grip: 1, seam: 1, swing: 1 };
  // Start from the ground's own settings, so one the tracking cannot pin down keeps its value while the rest are fitted.
  const start = { ...DEFAULT_COEFFS };
  for (const [setting, c] of SETTINGS) start[c] = DEFAULT_COEFFS[c] * v[setting];
  const { report, kept } = fitDetermined(
    observations,
    SETTINGS.map(([, c]) => c),
    { venue: air, start, maxIterations: 15 },
  );
  const out = { ...v };
  const notes = [`Fitted to ${observations.length} tracked deliveries`];
  for (const [setting, c] of SETTINGS) {
    const name = setting[0].toUpperCase() + setting.slice(1);
    if (kept.includes(c)) {
      out[setting] = report.coeffs[c] / DEFAULT_COEFFS[c];
      notes.push(`${name} ${Math.round(out[setting] * 100)}% ± ${Math.round((report.stdErr[c]! / DEFAULT_COEFFS[c]) * 100)}: from the tracking`);
    } else {
      notes.push(`${name}: the tracking could not pin it down, so it is left as it was`);
    }
  }
  return { venue: out, notes };
}
