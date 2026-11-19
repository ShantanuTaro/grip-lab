// Grounds and their conditions. The pitch and swing figures scale the fitted coefficients in constants.ts,
// so 1 is the stock pitch the coefficients describe.
//
// Bounce, at the 16 grounds here with 3 or more Tests of Hawk-Eye tracking: fitted to seamers' heights at the stumps
// there, 2012 to 2021, each ball on its day of the match (`scripts/hawkeye/fit.ts`; README, "Real tracking data"). It is
// an average over those Tests, and a pitch can change a lot from one Test to the next.
// Estimate, every other number: a reading of each ground's reputation (turn, seam, swing, and the bounce at Perth
// Stadium, Dharamsala and the Basin Reserve, which have one tracked Test or none), not a measurement. Altitude is real;
// temperature is a typical match day. James, Carré & Haake (Sports Engineering 8, 2005) measured real pitch
// restitution and friction.

export interface Venue {
  id: string;
  name: string;
  /** What the ground is known for, in a few words. */
  note: string;
  /** × restitution: how high it bounces. */
  bounce: number;
  /** × friction: how much a spinning ball grips and turns, and how much pace the pitch takes off. */
  grip: number;
  /** × seam kick: movement off an angled seam. */
  seam: number;
  /** × swing in the air. Overcast, humid grounds are thought to swing more; the cause is disputed (Mehta). */
  swing: number;
  altitudeM: number;
  tempC: number;
  /** Air moving across the pitch toward +x (the bowler's left) and down it toward the batter, m/s. */
  wind: readonly [x: number, z: number];
  /** The ground falls toward −x (the bowler's right) by this much. Lord's, from the Pavilion End. */
  slopeDeg?: number;
  /** For drawing only: how green the pitch looks (0 to 1), and how much dust a bounce throws up. */
  grass: number;
  dust: number;
  /** Measured, for a team's own ground: dew on the ball (0 to 1) and how uneven the bounce is (0 to 1). */
  dew?: number;
  uneven?: number;
  /** A team's own ground: what it was made from, so it can be opened and changed again. */
  data?: { base: string; measurements: Record<string, number>; notes: string[]; text?: string; tracked?: string; fitNotes?: string[] };
}

const base = { bounce: 1, grip: 1, seam: 1, swing: 1, altitudeM: 0, tempC: 20, wind: [0, 0] as const, grass: 0.15, dust: 0.3 };

export const VENUES: Venue[] = [
  { ...base, id: 'neutral', name: 'Standard pitch', note: 'Even bounce, no wind, sea level' },
  { ...base, id: 'perth', name: 'Perth Stadium, Australia', note: 'Steep bounce, the Fremantle Doctor breeze', bounce: 1.15, grip: 0.9, seam: 1.1, swing: 0.9, tempC: 28, wind: [4, -2], grass: 0.25, dust: 0.1 },
  { ...base, id: 'gabba', name: 'The Gabba, Brisbane', note: 'Pace and carry, seams early', bounce: 1.2, grip: 0.95, seam: 1.2, tempC: 27, grass: 0.3, dust: 0.15 },
  { ...base, id: 'mcg', name: 'MCG, Melbourne', note: 'Flat and true, little sideways', bounce: 1.13, seam: 0.9, tempC: 22 },
  { ...base, id: 'scg', name: 'SCG, Sydney', note: 'Grips for the spinners', bounce: 1.13, grip: 1.2, seam: 0.9, swing: 0.9, tempC: 24, dust: 0.45 },
  { ...base, id: 'lords', name: "Lord's, London", note: 'The slope takes the ball down to leg, swings under cloud', bounce: 1.01, seam: 1.2, swing: 1.25, tempC: 19, slopeDeg: 1.4, grass: 0.3, dust: 0.1 },
  { ...base, id: 'headingley', name: 'Headingley, Leeds', note: 'Cloud cover, big swing and seam', bounce: 1.06, grip: 0.95, seam: 1.4, swing: 1.4, tempC: 16, grass: 0.4, dust: 0.05 },
  { ...base, id: 'trent-bridge', name: 'Trent Bridge, Nottingham', note: 'Swing bowlers’ ground', seam: 1.2, swing: 1.35, tempC: 18, grass: 0.3, dust: 0.1 },
  { ...base, id: 'oval', name: 'The Oval, London', note: 'Bounce, and turn late on', bounce: 1.05, grip: 1.1, swing: 1.05, tempC: 20 },
  { ...base, id: 'chennai', name: 'Chepauk, Chennai', note: 'Hot, dry and dusty: low bounce, big turn', bounce: 0.97, grip: 1.4, seam: 0.7, swing: 0.8, tempC: 33, grass: 0, dust: 0.9 },
  { ...base, id: 'wankhede', name: 'Wankhede, Mumbai', note: 'Red soil bounce, sea breeze', bounce: 0.97, grip: 1.15, seam: 0.9, swing: 1.05, tempC: 31, wind: [2, 0], dust: 0.5 },
  { ...base, id: 'eden', name: 'Eden Gardens, Kolkata', note: 'Some for everyone', bounce: 0.95, grip: 1.15, swing: 1.1, tempC: 29, dust: 0.5 },
  { ...base, id: 'dharamsala', name: 'Dharamsala, India', note: '1,457 m up: thin air swings less, carries further', bounce: 1.05, seam: 1.2, altitudeM: 1457, tempC: 18, grass: 0.3, dust: 0.15 },
  { ...base, id: 'galle', name: 'Galle, Sri Lanka', note: 'Square turn, sea wind', bounce: 0.98, grip: 1.45, seam: 0.7, swing: 0.9, tempC: 30, wind: [3, 0], grass: 0, dust: 0.9 },
  { ...base, id: 'dubai', name: 'Dubai, UAE', note: 'Slow and low', bounce: 0.94, grip: 1.1, seam: 0.7, swing: 0.8, tempC: 35, grass: 0, dust: 0.65 },
  { ...base, id: 'wanderers', name: 'Wanderers, Johannesburg', note: '1,753 m up: bounce and seam, less swing', bounce: 1.03, seam: 1.3, swing: 1.05, altitudeM: 1753, tempC: 22, grass: 0.35, dust: 0.1 },
  { ...base, id: 'newlands', name: 'Newlands, Cape Town', note: 'The south-easter blows across', bounce: 1.06, grip: 1.1, seam: 1.2, tempC: 23, wind: [5, 2], grass: 0.25 },
  { ...base, id: 'basin', name: 'Basin Reserve, Wellington', note: 'Gale-force wind, seams and swings', seam: 1.2, swing: 1.15, tempC: 16, wind: [6, -4], grass: 0.35, dust: 0.1 },
  { ...base, id: 'sabina', name: 'Sabina Park, Jamaica', note: 'Hard, fast and bouncy', bounce: 1.03, grip: 0.95, tempC: 31, grass: 0.1 },
  { ...base, id: 'kensington', name: 'Kensington Oval, Barbados', note: 'Pace and an Atlantic breeze', bounce: 1.03, tempC: 29, wind: [4, 0] },
];

export const NEUTRAL = VENUES[0];
export const venue = (id: string) => VENUES.find((v) => v.id === id) ?? NEUTRAL;

/** Dry-air density (kg/m³) from altitude and temperature: the standard atmosphere's pressure, then the gas law. */
export const airDensity = (altitudeM: number, tempC: number) =>
  (101325 * (1 - 2.25577e-5 * altitudeM) ** 5.25588) / (287.05 * (tempC + 273.15));

/** A crack in the pitch is three of these joined end to end. One straight piece from (x1, z1) to (x2, z2) in pitch coordinates, metres. */
export interface Crack {
  x1: number;
  z1: number;
  x2: number;
  z2: number;
  width: number;
  /** A ball pitching on its edge keeps low (−1) or kicks up (+1). */
  kind: 1 | -1;
}

/** A ground on a given day of a match, with or without evening dew. */
export interface Conditions extends Venue {
  day: number;
  /** Dew on the ball, 0 (dry) to 1 (soaked). */
  dew: number;
  cracks: Crack[];
}

/**
 * How a pitch changes over a five-day match: it loses its grass and its bounce, dries, grips more for spin, and
 * cracks. Dew wets the ball, so it skids on instead of gripping and swings and seams less.
 * The bounce falls 5% by day 5: fitted to Hawk-Eye heights at the stumps of seamers' balls, 20 a day from the 61 Tests
 * that reached day 5 (`scripts/hawkeye/fit.ts`; the guess was 12%). Estimate, the rest: the direction of each change
 * is cricket lore; the sizes are guesses to fit later.
 */
export function wear(v: Venue, day: number, dew: number): Conditions {
  const t = (day - 1) / 4; // 0 on day 1, 1 on day 5
  // The same ground always cracks in the same places; each day only adds cracks and widens the old ones.
  let seed = [...v.id].reduce((h, ch) => Math.imul(h ^ ch.charCodeAt(0), 16777619), 2166136261);
  const rand = () => ((seed = Math.imul(seed ^ (seed >>> 15), 2246822507) + 0x6d2b79f5), ((seed >>> 0) % 1e6) / 1e6);
  const cracks: Crack[] = [];
  // A measured uneven pitch has its cracks from the start.
  const count = Math.round(Math.max(t * (3 + 12 * v.dust), 15 * (v.uneven ?? 0)));
  for (let i = 0; i < count; i++) {
    let x = (rand() - 0.5) * 2.2;
    let z = 6 + rand() * 11; // where balls pitch
    let a = rand() * Math.PI;
    const width = (0.002 + 0.006 * rand()) * Math.max(t, v.uneven ?? 0);
    const kind = rand() < 0.5 ? -1 : 1;
    for (let k = 0; k < 3; k++) {
      a += (rand() - 0.5) * 1.2;
      const len = 0.1 + rand() * 0.25;
      const x2 = x + Math.cos(a) * len;
      const z2 = z + Math.sin(a) * len;
      cracks.push({ x1: x, z1: z, x2, z2, width, kind });
      [x, z] = [x2, z2];
    }
  }
  const wet = dew;
  return {
    ...v,
    day,
    dew,
    cracks,
    bounce: v.bounce * (1 - 0.05 * t),
    grip: v.grip * (1 + 0.35 * t) * (1 - 0.3 * wet),
    seam: v.seam * (1.1 - 0.3 * t) * (1 - 0.15 * wet),
    swing: v.swing * (1 - 0.15 * wet),
    grass: v.grass * (1 - 0.7 * t),
    dust: Math.min(1, v.dust + 0.4 * t) * (1 - 0.8 * wet),
  };
}

const REACH = 0.025; // m: how close to a crack the ball's contact patch has to land to feel it. Estimate.

/** The crack a ball pitching at (x, z) lands on, if any: how squarely (0 to 1) and which side of it. */
export function crackAt(cracks: readonly Crack[], x: number, z: number) {
  let hit: { f: number; kind: 1 | -1; side: number } | null = null;
  for (const c of cracks) {
    const dx = c.x2 - c.x1;
    const dz = c.z2 - c.z1;
    const u = Math.max(0, Math.min(1, ((x - c.x1) * dx + (z - c.z1) * dz) / (dx * dx + dz * dz)));
    const cx = c.x1 + u * dx;
    const d = Math.hypot(x - cx, z - (c.z1 + u * dz));
    const f = 1 - d / (c.width / 2 + REACH);
    if (f > 0 && (!hit || f > hit.f)) hit = { f, kind: c.kind, side: Math.sign(x - cx) || c.kind };
  }
  return hit;
}
