// A team's own measurements of a pitch and the weather, turned into the ground settings the physics uses.
//
// Sources for the measurements and their targets: the ECB pitch-monitoring work (James, Carré & Haake,
// "Predicting the playing character of cricket pitches", Sports Engineering 8, 2005, and the ECB summary of it):
//   - a ball dropped from 3 m should rebound 55 cm; a 2.25 kg Clegg hammer from 450 mm should read 360 g,
//     and predicts bounce as well as the drop does
//   - a pitch keeps about 93% (fast) to 85% (slow) of the ball's speed when it pitches
//   - thin grass cover has about 30% more surface friction than dense cover
//   - more than about 15% surface damage where spinners pitch gives moderate or more turn
//   - hardness readings varying by more than 15% (coefficient of variation) mean inconsistent bounce
// Each formula below that turns a measurement into a setting is an Estimate, named as one where it is used.

import { simulate } from './simulate.ts';
import { delivery } from './grips.ts';
import type { Venue } from './venues.ts';

export const FIELDS = {
  // Pitch
  reboundCm: { short: 'Rebound', group: 'Pitch', label: 'Rebound of a ball dropped from 3 m', unit: 'cm', min: 10, max: 150, hint: 'ECB target 55' },
  cleggG: { short: 'Clegg', group: 'Pitch', label: 'Clegg hardness (2.25 kg hammer, 450 mm)', unit: 'g', min: 100, max: 900, hint: 'Target 360' },
  paceKeptPct: { short: 'Pace kept', group: 'Pitch', label: 'Speed kept after pitching', unit: '%', min: 70, max: 98, hint: '85 slow to 93 fast' },
  grassCoverPct: { short: 'Grass cover', group: 'Pitch', label: 'Grass cover', unit: '%', min: 0, max: 100, hint: 'Usually 75 to 90' },
  grassLengthMm: { short: 'Grass', group: 'Pitch', label: 'Grass length', unit: 'mm', min: 0, max: 30, hint: 'About 4 is standard' },
  moisturePct: { short: 'Moisture', group: 'Pitch', label: 'Moisture, top 60 mm', unit: '%', min: 0, max: 45, hint: 'At most about 18 to 22' },
  damagePct: { short: 'Wear', group: 'Pitch', label: 'Surface damage where spinners pitch', unit: '%', min: 0, max: 80, hint: 'Over 15 turns' },
  hardnessCvPct: { short: 'Hardness spread', group: 'Pitch', label: 'Spread of hardness readings (CV)', unit: '%', min: 0, max: 80, hint: 'Over 15 is uneven' },
  // Weather
  tempC: { short: 'Temp', group: 'Weather', label: 'Air temperature', unit: '°C', min: -10, max: 50, hint: '' },
  eveningTempC: { short: 'Evening', group: 'Weather', label: 'Evening temperature', unit: '°C', min: -10, max: 50, hint: 'For dew' },
  humidityPct: { short: 'Humidity', group: 'Weather', label: 'Relative humidity', unit: '%', min: 0, max: 100, hint: '' },
  dewPointC: { short: 'Dew point', group: 'Weather', label: 'Dew point', unit: '°C', min: -30, max: 35, hint: 'Or give humidity' },
  windKph: { short: 'Wind', group: 'Weather', label: 'Wind speed', unit: 'kph', min: 0, max: 120, hint: '' },
  windFromDeg: { short: 'Wind from', group: 'Weather', label: 'Wind from', unit: '°', min: 0, max: 360, hint: "0 behind the bowler, 90 bowler's right" },
  cloudPct: { short: 'Cloud', group: 'Weather', label: 'Cloud cover', unit: '%', min: 0, max: 100, hint: '' },
  altitudeM: { short: 'Altitude', group: 'Weather', label: 'Altitude', unit: 'm', min: -100, max: 4000, hint: '' },
} as const;

export type Field = keyof typeof FIELDS;
export type Measurements = Partial<Record<Field, number>>;

/** Keeps only known fields with numbers in range. */
export function clean(m: Record<string, unknown>): Measurements {
  const out: Measurements = {};
  for (const [k, f] of Object.entries(FIELDS) as [Field, (typeof FIELDS)[Field]][]) {
    const v = Number(m[k]);
    if (m[k] !== '' && m[k] != null && Number.isFinite(v) && v >= f.min && v <= f.max) out[k] = v;
  }
  return out;
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x));
const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Dew point from temperature and relative humidity (the Magnus formula). */
export const dewPoint = (tempC: number, humidityPct: number) => {
  const g = Math.log(humidityPct / 100) + (17.62 * tempC) / (243.12 + tempC);
  return (243.12 * g) / (17.62 - g);
};

/** How much of the ball's speed the pitch keeps when a stock seam-up ball lands on it. */
export function paceKept(v: Venue): number {
  const r = simulate(delivery('seam-up'), undefined, v);
  return r.speedAfterBounceKph / r.speedBeforeBounceKph;
}

/**
 * A ground from measurements: anything not measured comes from `base`. Returns the ground and, for each setting
 * that changed, a line saying which measurement it came from.
 */
export function fromMeasurements(base: Venue, m: Measurements): { venue: Venue; notes: string[] } {
  const v: Venue = { ...base, wind: [...base.wind] as unknown as Venue['wind'] };
  const notes: string[] = [];

  // Bounce. The drop test's rebound height goes as the square of the restitution, so restitution scales with
  // its square root. Estimate: the Clegg reading is treated the same way.
  if (m.reboundCm !== undefined) {
    v.bounce = Math.sqrt(m.reboundCm / 55);
    notes.push(`Bounce ${pct(v.bounce)}: ${m.reboundCm} cm rebound from 3 m (target 55 cm)`);
  } else if (m.cleggG !== undefined) {
    v.bounce = Math.sqrt(m.cleggG / 360);
    notes.push(`Bounce ${pct(v.bounce)}: Clegg ${m.cleggG} g (target 360 g)`);
  }

  // Grip. Speed kept after pitching sets the pitch friction directly: solved for, so the model keeps exactly that
  // share. Without it, thin grass cover grips more (about +30% from dense to thin; Estimate: linear between 85%
  // and 50% cover).
  if (m.paceKeptPct !== undefined) {
    const target = m.paceKeptPct / 100;
    let [lo, hi] = [0.1, 4];
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (paceKept({ ...v, grip: mid }) > target) lo = mid;
      else hi = mid;
    }
    v.grip = (lo + hi) / 2;
    notes.push(`Grip ${pct(v.grip)}: keeps ${m.paceKeptPct}% of its speed off the pitch`);
  } else if (m.grassCoverPct !== undefined) {
    v.grip = base.grip * clamp(1 + (0.3 * (85 - m.grassCoverPct)) / 35, 0.85, 1.45);
    notes.push(`Grip ${pct(v.grip)}: ${m.grassCoverPct}% grass cover`);
  }
  // Turn on a worn spinners' area. Estimate: +2.5% grip for each point of damage over 5%.
  if (m.damagePct !== undefined && m.damagePct > 5) {
    v.grip *= Math.min(1.75, 1 + 0.025 * (m.damagePct - 5));
    notes.push(`Grip ${pct(v.grip)} with ${m.damagePct}% surface damage where spinners pitch`);
  }

  // Seam: longer grass and more moisture seam more. Estimate: +8% per mm over 4 mm, +3% per point of moisture
  // over 15%.
  if (m.grassLengthMm !== undefined || m.moisturePct !== undefined) {
    v.seam = clamp(base.seam * (1 + 0.08 * ((m.grassLengthMm ?? 4) - 4)) * (1 + 0.03 * ((m.moisturePct ?? 15) - 15)), 0.4, 2.2);
    notes.push(`Seam ${pct(v.seam)}: ${[m.grassLengthMm !== undefined && `${m.grassLengthMm} mm grass`, m.moisturePct !== undefined && `${m.moisturePct}% moisture`].filter(Boolean).join(', ')}`);
  }

  // Swing under cloud. Estimate, and a disputed one: a 2012 study found humidity made no measurable difference.
  if (m.cloudPct !== undefined) {
    v.swing = base.swing * (1 + (0.2 * (m.cloudPct - 50)) / 50);
    notes.push(`Swing ${pct(v.swing)}: ${m.cloudPct}% cloud (the cloud effect is disputed)`);
  }

  if (m.tempC !== undefined) v.tempC = m.tempC;
  if (m.altitudeM !== undefined) v.altitudeM = m.altitudeM;
  if (m.tempC !== undefined || m.altitudeM !== undefined) notes.push(`Air: ${v.tempC}°C at ${v.altitudeM} m`);

  if (m.windKph !== undefined) {
    const a = ((m.windFromDeg ?? 0) * Math.PI) / 180;
    const s = m.windKph / 3.6;
    // From behind the bowler (0°) it blows down the pitch (+z); from the bowler's right (90°), toward +x.
    v.wind = [s * Math.sin(a), s * Math.cos(a)];
    notes.push(`Wind ${m.windKph} kph from ${m.windFromDeg ?? 0}°`);
  }

  // Dew forms once the air cools to the dew point. Estimate: none 4 °C above it, full dew at it.
  const dp = m.dewPointC ?? (m.humidityPct !== undefined && (m.eveningTempC ?? m.tempC) !== undefined ? dewPoint((m.eveningTempC ?? m.tempC)!, m.humidityPct) : undefined);
  const evening = m.eveningTempC ?? m.tempC;
  if (dp !== undefined && evening !== undefined) {
    v.dew = clamp((4 - (evening - dp)) / 4, 0, 1);
    notes.push(`Dew ${pct(v.dew)}: evening ${evening}°C against a dew point of ${dp.toFixed(1)}°C`);
  }

  // Uneven bounce from the spread of hardness readings. Estimate: none at 5%, the most at 20%.
  if (m.hardnessCvPct !== undefined) {
    v.uneven = clamp((m.hardnessCvPct - 5) / 15, 0, 1);
    notes.push(`Uneven bounce ${pct(v.uneven)}: hardness readings vary by ${m.hardnessCvPct}%`);
  }

  // Drawing only: how green the pitch looks and how dusty it is.
  if (m.grassCoverPct !== undefined || m.grassLengthMm !== undefined) v.grass = clamp(((m.grassCoverPct ?? 80) / 100) * ((m.grassLengthMm ?? 4) / 8), 0, 1);
  if (m.moisturePct !== undefined || m.grassCoverPct !== undefined) v.dust = clamp(((20 - (m.moisturePct ?? 15)) / 20) * (1.2 - (m.grassCoverPct ?? 80) / 100) * 1.5, 0, 1);

  return { venue: v, notes };
}
