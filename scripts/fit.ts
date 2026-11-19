// Fits the physics coefficients to a file of tracked deliveries.
//
//   npm run fit -- deliveries.json                   fit every coefficient
//   npm run fit -- deliveries.json dragCd,friction   fit only these
//   npm run fit -- --demo                            show the method on simulated tracking data
//
// The file format is described in README.md.

import { readFileSync } from 'node:fs';
import { DEFAULT_COEFFS } from '../src/physics/constants.ts';
import type { Coeffs } from '../src/physics/constants.ts';
import { METRICS, METRIC_RANGE, fitDetermined, synthesize } from '../src/physics/fit.ts';
import type { CoeffName, Metric, Observation } from '../src/physics/fit.ts';
import { GRIPS, delivery } from '../src/physics/grips.ts';

const COEFF_NAMES = Object.keys(DEFAULT_COEFFS) as CoeffName[];
const UNITS: Record<Metric, string> = {
  timeToBounceS: 's',
  timeToStumpsS: 's',
  swingCm: 'cm',
  deviationDeg: 'deg',
  heightAtStumpsCm: 'cm',
  lineAtStumpsCm: 'cm',
  speedAfterBounceKph: 'kph',
};

function fail(message: string): never {
  console.error(`fit: ${message}`);
  process.exit(1);
}

// Checks a tracked-delivery file before anything is simulated, so a bad row is named, not guessed at.
function readFile(path: string): { observations: Observation[]; sigma?: Partial<Record<Metric, number>> } {
  let data: any;
  try {
    data = JSON.parse(readFileSync(path, 'utf8'));
  } catch (error) {
    fail(`cannot read ${path}: ${(error as Error).message}`);
  }
  if (!Array.isArray(data?.deliveries) || data.deliveries.length === 0) {
    fail('expected { "deliveries": [ ... ] } with at least one entry');
  }
  const ranges: Record<string, [number, number]> = {
    speedKph: [40, 170],
    seamAngleDeg: [-90, 90],
    spinRpm: [-4000, 4000],
    lengthM: [0.5, 16],
    lineCm: [-150, 150],
  };
  const choices: Record<string, string[]> = { arm: ['right', 'left'], batter: ['right', 'left'], ball: ['new', 'old'] };
  data.deliveries.forEach((row: any, i: number) => {
    const where = `deliveries[${i}]`;
    for (const [key, [lo, hi]] of Object.entries(ranges)) {
      const v = row?.delivery?.[key];
      if (typeof v !== 'number' || !(v >= lo && v <= hi)) fail(`${where}.delivery.${key} must be a number from ${lo} to ${hi}, got ${JSON.stringify(v)}`);
    }
    for (const [key, allowed] of Object.entries(choices)) {
      if (!allowed.includes(row.delivery[key])) fail(`${where}.delivery.${key} must be one of ${allowed.join(', ')}`);
    }
    const observed = Object.entries(row.observed ?? {});
    if (observed.length === 0) fail(`${where}.observed has no measurements`);
    for (const [key, v] of observed) {
      if (!METRICS.includes(key as Metric)) fail(`${where}.observed.${key} is not a known metric (${METRICS.join(', ')})`);
      const [lo, hi] = METRIC_RANGE[key as Metric];
      if (typeof v !== 'number' || !(v >= lo && v <= hi)) fail(`${where}.observed.${key} must be a number from ${lo} to ${hi} (a tracking glitch?), got ${JSON.stringify(v)}`);
    }
  });
  return { observations: data.deliveries, sigma: data.sigma };
}

// Simulated tracking data from a "true" pitch and ball that differ from the defaults.
function demo(): { observations: Observation[]; truth: Coeffs } {
  const truth: Coeffs = { dragCd: 0.5, magnusScale: 0.8, swingCsMax: 0.2, restitution: 0.6, friction: 0.42, seamKickDegPerDeg: 0.045 };
  const deliveries = Array.from({ length: 96 }, (_, i) => {
    const g = GRIPS[i % GRIPS.length];
    return delivery(g.id, {
      speedKph: g.speedKph + ((i * 7) % 13) - 6,
      seamAngleDeg: g.kind === 'pace' ? g.seamAngleDeg + ((i * 3) % 9) - 4 : 0,
      lengthM: g.lengthM + ((i * 5) % 7) * 0.4 - 1.2,
      lineCm: ((i * 11) % 41) - 20,
      ball: i % 3 === 0 ? 'old' : 'new',
    });
  });
  return { observations: synthesize(deliveries, truth, 11), truth };
}

const args = process.argv.slice(2);
if (args.length === 0) fail('usage: npm run fit -- <deliveries.json> [coefficient,coefficient...]   or   npm run fit -- --demo');

const isDemo = args[0] === '--demo';
const names = (args[1]?.split(',') ?? COEFF_NAMES) as CoeffName[];
for (const name of names) if (!COEFF_NAMES.includes(name)) fail(`unknown coefficient "${name}". Choose from: ${COEFF_NAMES.join(', ')}`);

const demoData = isDemo ? demo() : undefined;
const input = demoData ?? readFile(args[0]);
const sigma = 'sigma' in input ? input.sigma : undefined;

const started = performance.now();
const { report, kept, dropped } = fitDetermined(input.observations, names, { sigma });
const measurements = Object.values(report.rms).reduce((sum, m) => sum + m.n, 0);

console.log(
  `\n${isDemo ? 'DEMO on simulated data. ' : ''}${input.observations.length} deliveries, ${measurements} measurements. ` +
    `Fitted ${kept.length} of ${names.length} coefficient(s) in ${((performance.now() - started) / 1000).toFixed(1)} s\n`,
);

const header = ['coefficient', 'default', 'fitted', '+/- 1 sigma', ...(demoData ? ['true value'] : []), 'note'];
const table = names.map((name) => {
  const truth = demoData ? [demoData.truth[name].toPrecision(3)] : [];
  const reason = dropped.find(([n]) => n === name)?.[1];
  if (reason) return [name, DEFAULT_COEFFS[name].toPrecision(3), '-', '-', ...truth, `left at the default: ${reason}`];
  return [name, DEFAULT_COEFFS[name].toPrecision(3), report.coeffs[name].toPrecision(3), report.stdErr[name]!.toPrecision(2), ...truth, ''];
});
printTable([header, ...table]);

console.log('\nTypical model error per measurement, before and after the fit:\n');
printTable([
  ['metric', 'count', 'before', 'after', 'unit'],
  ...METRICS.filter((m) => report.rms[m]).map((m) => [m, String(report.rms[m]!.n), report.rms[m]!.before.toPrecision(3), report.rms[m]!.after.toPrecision(3), UNITS[m]]),
]);

if (kept.length === 0) {
  console.log('\nThis data could not pin down any of the requested coefficients.');
} else if (!isDemo) {
  console.log('\nTo adopt these, paste into DEFAULT_COEFFS in src/physics/constants.ts and note the dataset in the comment:\n');
  for (const name of kept) console.log(`  ${name}: ${report.coeffs[name].toPrecision(4)},`);
}
console.log('');

function printTable(rows: string[][]) {
  const widths = rows[0].map((_, col) => Math.max(...rows.map((row) => row[col].length)));
  for (const row of rows) console.log('  ' + row.map((cell, col) => cell.padEnd(widths[col])).join('   ').trimEnd());
}
