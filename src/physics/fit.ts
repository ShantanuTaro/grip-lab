// Fits the physics coefficients to tracked deliveries by least squares (Levenberg-Marquardt).
// Pure TypeScript, so the model being fitted is the same code the app runs.

import { DEFAULT_COEFFS } from './constants.ts';
import type { Coeffs } from './constants.ts';
import { simulate } from './simulate.ts';
import type { Venue } from './venues.ts';
import type { Delivery, Result } from './simulate.ts';

/** What a tracker can report about one delivery. Signs match Result: swing + is away, deviation + is in. */
export const METRICS = [
  'timeToBounceS',
  'timeToStumpsS',
  'swingCm',
  'deviationDeg',
  'heightAtStumpsCm',
  'lineAtStumpsCm', // cm from middle stump at the batter's stumps: − is off, + is leg
  'speedAfterBounceKph',
] as const;
export type Metric = (typeof METRICS)[number];
export type CoeffName = keyof Coeffs;

export interface Observation {
  delivery: Delivery;
  /** Any subset of the metrics; the fit uses whatever is present. */
  observed: Partial<Record<Metric, number>>;
  /** Its own ground and day (see `wear`), when not the fit's `venue`. */
  venue?: Venue;
}

/** Measurement noise (one sigma) assumed for each metric. Estimates of tracker precision: pass your own. */
export const DEFAULT_SIGMA: Record<Metric, number> = {
  timeToBounceS: 0.004,
  timeToStumpsS: 0.004,
  swingCm: 2,
  deviationDeg: 0.2,
  heightAtStumpsCm: 2.5,
  lineAtStumpsCm: 2.5,
  speedAfterBounceKph: 1.5,
};

/**
 * The values a real ball can produce. Readers reject anything outside as a tracking glitch, since one such value
 * swamps a least-squares fit; real Hawk-Eye exports contain heights at the stumps of −60,987 m.
 */
export const METRIC_RANGE: Record<Metric, readonly [number, number]> = {
  timeToBounceS: [0.1, 3],
  timeToStumpsS: [0.2, 4],
  swingCm: [-300, 300],
  deviationDeg: [-45, 45],
  heightAtStumpsCm: [0, 400],
  lineAtStumpsCm: [-400, 400],
  speedAfterBounceKph: [5, 170],
};

/** The plausible range for each coefficient. A fit never leaves it. */
export const BOUNDS: Record<CoeffName, readonly [number, number]> = {
  dragCd: [0.2, 0.8],
  magnusScale: [0, 3],
  swingCsMax: [0, 0.6],
  restitution: [0.3, 0.8],
  friction: [0.05, 1],
  seamKickDegPerDeg: [0, 0.2],
};

export function metrics(r: Result, d: Delivery): Record<Metric, number> {
  const off = d.batter === 'right' ? 1 : -1;
  return {
    timeToBounceS: r.bounce.t,
    timeToStumpsS: r.timeToStumpsS,
    swingCm: r.swingCm,
    deviationDeg: r.deviationDeg,
    heightAtStumpsCm: r.atStumps.y * 100,
    lineAtStumpsCm: -off * r.atStumps.x * 100,
    speedAfterBounceKph: r.speedAfterBounceKph,
  };
}

export interface FitReport {
  /** The starting coefficients with the fitted ones swapped in. */
  coeffs: Coeffs;
  /** One-sigma uncertainty of each fitted coefficient. Infinity: this data cannot determine it. */
  stdErr: Partial<Record<CoeffName, number>>;
  /** Typical model error per metric, in the metric's own unit, before and after the fit. */
  rms: Partial<Record<Metric, { n: number; before: number; after: number }>>;
  iterations: number;
  /** Coefficients that moved no residual at all, so took no part: the fit is the same without them. */
  inert: CoeffName[];
}

interface FitOptions {
  start?: Coeffs;
  sigma?: Partial<Record<Metric, number>>;
  maxIterations?: number;
  /** The ground the deliveries were bowled at. Defaults to the standard pitch. */
  venue?: Venue;
}

export function fit(observations: Observation[], names: CoeffName[], options: FitOptions = {}): FitReport {
  const start = options.start ?? DEFAULT_COEFFS;
  const sigma = { ...DEFAULT_SIGMA, ...options.sigma };
  const rows = observations.flatMap((o, i) =>
    METRICS.filter((m) => o.observed[m] !== undefined).map((m) => ({ i, m })),
  );
  if (rows.length === 0) throw new Error('No observed metrics to fit against.');

  const withValues = (theta: number[]): Coeffs => {
    const c = { ...start };
    names.forEach((name, j) => (c[name] = theta[j]));
    return c;
  };
  // (model − observed) / sigma for every observed number.
  const residuals = (theta: number[]): number[] => {
    const c = withValues(theta);
    const sims = observations.map((o) => metrics(simulate(o.delivery, c, o.venue ?? options.venue), o.delivery));
    return rows.map(({ i, m }) => (sims[i][m] - observations[i].observed[m]!) / sigma[m]);
  };

  let theta = names.map((name) => start[name]);
  let r = residuals(theta);
  let cost = dot(r, r);
  const r0 = r;
  let lambda = 1e-3;
  let iterations = 0;
  let normal: number[][] = []; // JᵀJ at the last linearisation
  let active: number[] = []; // coefficients that move at least one residual
  // Differentiated from the second iteration on: only those that moved a residual at the start. One that moved none
  // scales a term these balls lack (seam swing with no seam angle, Magnus with no spin), so it never will.
  let live = names.map((_, j) => j);

  for (; iterations < (options.maxIterations ?? 40); iterations++) {
    // Jacobian by finite differences: jac[j][k] = d residual k / d coefficient j.
    const jac = names.map((name, j) => {
      if (!live.includes(j)) return r.map(() => 0);
      const [lo, hi] = BOUNDS[name];
      const h = 0.01 * (hi - lo) * (theta[j] + 0.01 * (hi - lo) <= hi ? 1 : -1);
      const moved = theta.slice();
      moved[j] += h;
      const r2 = residuals(moved);
      return r2.map((v, k) => (v - r[k]) / h);
    });
    normal = jac.map((a) => jac.map((b) => dot(a, b)));
    const gradient = jac.map((a) => dot(a, r));
    active = names.map((_, j) => j).filter((j) => normal[j][j] > 1e-12);
    if (iterations === 0) live = active;
    // One sitting on a bound that the fit wants to push past is held there, and the step is solved for the others.
    // Solving for all, then clamping, spoils the others' share of the step: they crawl for dozens of iterations.
    const free = active.filter((a) => {
      const [lo, hi] = BOUNDS[names[a]];
      return !((theta[a] <= lo && gradient[a] > 0) || (theta[a] >= hi && gradient[a] < 0));
    });
    if (free.length === 0) break;

    let improved = false;
    while (lambda < 1e10) {
      const damped = free.map((a) => free.map((b) => normal[a][b] + (a === b ? lambda * normal[a][a] : 0)));
      const delta = solve(damped, free.map((a) => -gradient[a]));
      if (delta) {
        const next = theta.slice();
        free.forEach((a, k) => {
          const [lo, hi] = BOUNDS[names[a]];
          next[a] = Math.min(hi, Math.max(lo, theta[a] + delta[k]));
        });
        const r2 = residuals(next);
        const cost2 = dot(r2, r2);
        if (cost2 < cost) {
          improved = (cost - cost2) / cost > 1e-9;
          theta = next;
          r = r2;
          cost = cost2;
          lambda /= 3;
          break;
        }
      }
      lambda *= 4;
    }
    if (!improved) break;
  }

  // Uncertainty from the curvature of the fit. A coefficient the data cannot pin down gets Infinity.
  const stdErr: Partial<Record<CoeffName, number>> = {};
  names.forEach((name) => (stdErr[name] = Infinity));
  const variance = cost / Math.max(1, rows.length - active.length);
  active.forEach((a, k) => {
    const unit = active.map((_, i) => (i === k ? 1 : 0));
    const column = solve(active.map((p) => active.map((q) => normal[p][q])), unit);
    if (column && column[k] > 0) stdErr[names[a]] = Math.sqrt(column[k] * variance);
  });

  const rms: FitReport['rms'] = {};
  for (const m of METRICS) {
    const idx = rows.flatMap((row, k) => (row.m === m ? [k] : []));
    if (idx.length === 0) continue;
    const size = (res: number[]) => Math.sqrt(idx.reduce((s, k) => s + (res[k] * sigma[m]) ** 2, 0) / idx.length);
    rms[m] = { n: idx.length, before: size(r0), after: size(r) };
  }

  return { coeffs: withValues(theta), stdErr, rms, iterations, inert: names.filter((_, j) => !live.includes(j)) };
}

/** How badly a fitted coefficient is determined: 0 is fine, higher is worse. */
function trouble(report: FitReport, name: CoeffName): { score: number; why: string } {
  const se = report.stdErr[name]!;
  const value = report.coeffs[name];
  const [lo, hi] = BOUNDS[name];
  if (!Number.isFinite(se)) return { score: Infinity, why: 'this data says nothing about it' };
  if (value === lo || value === hi) return { score: 1e6, why: 'the fit ran to the edge of its allowed range' };
  const relative = se / Math.abs(value);
  return relative > 0.25 ? { score: relative, why: 'too uncertain: needs more or different data' } : { score: 0, why: '' };
}

/**
 * Fits, then drops the worst-determined coefficient and fits again, until every one left is well determined
 * (uncertain by less than a quarter, inside its range). A coefficient the data cannot pin down would otherwise
 * soak up noise and drag the good ones off with it. `kept` were fitted; `dropped` say why the rest were not.
 */
export function fitDetermined(observations: Observation[], names: CoeffName[], options: FitOptions = {}) {
  let report = fit(observations, names, options);
  // Those that moved nothing never took part, so the others' fit stands without them: no refit needed.
  const dropped: [CoeffName, string][] = report.inert.map((name) => [name, 'this data says nothing about it']);
  let kept = names.filter((name) => !report.inert.includes(name));
  while (kept.length > 0) {
    const ranked = kept.map((name) => ({ name, ...trouble(report, name) })).sort((a, b) => b.score - a.score);
    if (ranked[0].score === 0) break;
    const out = ranked[0].score === Infinity ? ranked.filter((c) => c.score === Infinity) : [ranked[0]];
    out.forEach((c) => dropped.push([c.name, c.why]));
    kept = kept.filter((name) => !out.some((c) => c.name === name));
    if (kept.length > 0) report = fit(observations, kept, options);
  }
  return { report, kept, dropped };
}

/**
 * Simulated "tracked" deliveries with measurement noise. Use it to test a fit, or to find out
 * which coefficients a planned data collection could pin down before anyone bowls a ball.
 */
export function synthesize(
  deliveries: Delivery[],
  truth: Coeffs,
  seed = 1,
  sigma: Record<Metric, number> = DEFAULT_SIGMA,
): Observation[] {
  let state = seed >>> 0;
  const uniform = () => {
    // mulberry32
    state = (state + 0x6d2b79f5) >>> 0;
    let v = Math.imul(state ^ (state >>> 15), 1 | state);
    v = (v + Math.imul(v ^ (v >>> 7), 61 | v)) ^ v;
    return ((v ^ (v >>> 14)) >>> 0) / 4294967296;
  };
  const gaussian = () => Math.sqrt(-2 * Math.log(1 - uniform())) * Math.cos(2 * Math.PI * uniform());
  return deliveries.map((delivery) => {
    const exact = metrics(simulate(delivery, truth), delivery);
    const observed: Partial<Record<Metric, number>> = {};
    for (const m of METRICS) observed[m] = exact[m] + sigma[m] * gaussian();
    return { delivery, observed };
  });
}

function dot(a: number[], b: number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i] * b[i];
  return s;
}

/** Solves A·x = b by Gaussian elimination with pivoting. Returns null when A is singular. */
function solve(a: number[][], b: number[]): number[] | null {
  const n = b.length;
  const m = a.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let row = col + 1; row < n; row++) if (Math.abs(m[row][col]) > Math.abs(m[pivot][col])) pivot = row;
    if (Math.abs(m[pivot][col]) < 1e-14) return null;
    [m[col], m[pivot]] = [m[pivot], m[col]];
    for (let row = col + 1; row < n; row++) {
      const factor = m[row][col] / m[col][col];
      for (let k = col; k <= n; k++) m[row][k] -= factor * m[col][k];
    }
  }
  const x = new Array<number>(n).fill(0);
  for (let row = n - 1; row >= 0; row--) {
    let s = m[row][n];
    for (let k = row + 1; k < n; k++) s -= m[row][k] * x[k];
    x[row] = s / m[row][row];
  }
  return x;
}
