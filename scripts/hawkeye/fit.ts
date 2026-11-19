// The fitted numbers in README "Real tracking data", from the pace.csv that prepare.py writes. Each ball is simulated
// from its speed, length and line (seam angle and spin 0: the feed lacks them) in its day's wear, without cracks, and
// fitted to its height at the stumps.
//
//   node scripts/hawkeye/fit.ts pace.csv wear          how fast the bounce falls through a Test: wear() in venues.ts
//   node scripts/hawkeye/fit.ts pace.csv restitution   the standard pitch on day 1: restitution in constants.ts
//   node scripts/hawkeye/fit.ts pace.csv grounds       each ground's bounce, for venues.ts, and a held-out check
//
// Run them in that order: each uses the code as it stands, so the later ones build on the earlier results.

import { readFileSync } from 'node:fs';
import { readCsv } from '../../src/ground/tracked.ts';
import { DEFAULT_COEFFS } from '../../src/physics/constants.ts';
import { fit, metrics } from '../../src/physics/fit.ts';
import type { Observation } from '../../src/physics/fit.ts';
import { simulate } from '../../src/physics/simulate.ts';
import { NEUTRAL, venue, wear } from '../../src/physics/venues.ts';
import type { Venue } from '../../src/physics/venues.ts';

const [path, part] = process.argv.slice(2);
if (!path || !['wear', 'restitution', 'grounds'].includes(part)) {
  console.error('usage: node scripts/hawkeye/fit.ts <pace.csv> wear|restitution|grounds');
  process.exit(1);
}
const [header, ...lines] = readFileSync(path, 'utf8').trim().split('\n');
const cols = header.split(',');
const rows = lines.map((line) => {
  const c = line.split(',');
  const get = (name: string) => c[cols.indexOf(name)];
  return { line, test: get('matchId'), ground: get('ground'), date: get('date'), day: Number(get('day')) };
});
type Row = (typeof rows)[number];

function groupBy<K>(rs: Row[], key: (r: Row) => K): Map<K, Row[]> {
  const m = new Map<K, Row[]>();
  for (const r of rs) {
    const g = m.get(key(r));
    if (g) g.push(r);
    else m.set(key(r), [r]);
  }
  return m;
}
/** Up to `per` balls from each Test (or each group `key` makes), spread through it. */
const spread = (rs: Row[], per: number, key = (r: Row) => r.test) =>
  [...groupBy(rs, key).values()].flatMap((g) => g.filter((_, i) => i % Math.max(1, Math.floor(g.length / per)) === 0).slice(0, per));

/** The balls' heights at the stumps, each ball at ground `v` on its own day of the match. */
const balls = (rs: Row[], v: Venue): Observation[] =>
  readCsv([header, ...rs.map((r) => r.line)].join('\n')).map((o, i) => ({
    delivery: o.delivery,
    observed: { heightAtStumpsCm: o.observed.heightAtStumpsCm },
    venue: { ...wear(v, rs[i].day, 0), cracks: [] },
  }));

/** Restitution fitted to the balls, as a multiple of the default: the ground's bounce, ± one sigma. */
function bounceOf(obs: Observation[]) {
  const r = fit(obs, ['restitution']);
  const e = DEFAULT_COEFFS.restitution;
  return { bounce: r.coeffs.restitution / e, se: r.stdErr.restitution! / e, rms: r.rms.heightAtStumpsCm!.after, restitution: r.coeffs.restitution, seE: r.stdErr.restitution! };
}

/** Tracked minus simulated height at the stumps (cm), with each ball's ground given bounce `bounce`. */
const misfit = (obs: Observation[], bounce: number, c = DEFAULT_COEFFS) =>
  obs.map((o) => o.observed.heightAtStumpsCm! - metrics(simulate(o.delivery, c, { ...o.venue!, bounce: o.venue!.bounce * bounce }), o.delivery).heightAtStumpsCm);
const median = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];
const rmsOf = (xs: number[]) => Math.sqrt(xs.reduce((s, x) => s + x * x, 0) / xs.length);
const pct = (x: number) => `${Math.round(x * 100)}%`;

if (part === 'wear') {
  // The Tests that reached day 5, 20 balls a day from each: every day has the same Tests, so the same grounds.
  const five = new Set(rows.filter((r) => r.day === 5).map((r) => r.test));
  const pick = spread(rows.filter((r) => five.has(r.test)), 20, (r) => `${r.test} ${r.day}`);
  const obs = balls(pick, NEUTRAL);
  console.log(`${five.size} Tests that reached day 5; ${pick.length} balls, 20 a day from each.\nEach day's balls on their own, no wear:`);
  let first = 0;
  for (let day = 1; day <= 5; day++) {
    const b = bounceOf(obs.filter((_, i) => pick[i].day === day).map((o) => ({ ...o, venue: NEUTRAL })));
    first ||= b.restitution;
    console.log(`  day ${day}: restitution ${b.restitution.toFixed(3)} ± ${b.seE.toFixed(3)}, ${((b.restitution / first - 1) * 100).toFixed(1)}% on day 1`);
  }
  console.log("With wear()'s other changes in, and the bounce falling evenly by k from day 1 to day 5:");
  const scan = [0, 0.03, 0.06, 0.09, 0.12].map((k) => {
    const worn = obs.map((o, i) => ({ ...o, venue: { ...o.venue!, bounce: 1 - (k * (pick[i].day - 1)) / 4 } }));
    const { rms } = bounceOf(worn);
    console.log(`  k ${k.toFixed(2)}: misfit ${rms.toFixed(3)} cm`);
    return [k, rms * rms] as const;
  });
  // The lowest point of a parabola through the best three.
  const [[x1, y1], [x2, y2], [x3, y3]] = [...scan].sort((a, b) => a[1] - b[1]).slice(0, 3).sort((a, b) => a[0] - b[0]);
  const k = x2 - (0.5 * ((x2 - x1) ** 2 * (y2 - y3) - (x2 - x3) ** 2 * (y2 - y1))) / ((x2 - x1) * (y2 - y3) - (x2 - x3) * (y2 - y1));
  console.log(`Best fit: the bounce falls ${(k * 100).toFixed(1)}% by day 5. wear() has ${((1 - wear(NEUTRAL, 5, 0).bounce) * 100).toFixed(1)}%.`);
}

if (part === 'restitution') {
  const pick = spread(rows, 30);
  const obs = balls(pick, NEUTRAL);
  const b = bounceOf(obs);
  console.log(
    `${pick.length} balls, up to 30 spread through each of ${new Set(pick.map((r) => r.test)).size} Tests at ` +
      `${new Set(pick.map((r) => r.ground)).size} grounds, on the standard pitch in each one's day of wear:\n` +
      `  restitution on day 1 ${b.restitution.toFixed(4)} ± ${b.seE.toFixed(4)} (constants.ts has ${DEFAULT_COEFFS.restitution})`,
  );
  const bands = [[0.5, 3], [3, 5], [5, 6.5], [6.5, 8], [8, 10], [10, 16]];
  console.log(`Tracked minus simulated height (median cm) by length (m): ${bands.map(([lo, hi]) => `${lo}-${hi}`).join(' ')}`);
  for (const [label, e] of [['brief, 0.55', 0.55], ['fitted', b.restitution]] as const) {
    const res = misfit(obs, 1, { ...DEFAULT_COEFFS, restitution: e });
    const cells = bands.map(([lo, hi]) => median(res.filter((_, i) => obs[i].delivery.lengthM >= lo && obs[i].delivery.lengthM < hi)).toFixed(1));
    console.log(`  ${label.padEnd(12)} ${cells.join(' ')}   all ${median(res).toFixed(1)}, rms ${rmsOf(res).toFixed(1)}`);
  }
  // Real seamers put backspin on the ball; the presets have none. Does adding it fit better?
  for (const rpm of [800, 1500]) {
    const spun = obs.map((o) => ({ ...o, delivery: { ...o.delivery, spinRpm: rpm, spinAxis: { top: -1, drift: 0 } } }));
    console.log(`  with ${rpm} rpm of backspin, refitted: rms ${bounceOf(spun).rms.toFixed(1)} cm`);
  }
}

if (part === 'grounds') {
  // venues.ts's grounds, by Cricsheet name.
  const KNOWN: Record<string, string> = {
    'Brisbane Cricket Ground': 'gabba', 'Melbourne Cricket Ground': 'mcg', 'Sydney Cricket Ground': 'scg', "Lord's": 'lords',
    Headingley: 'headingley', 'Trent Bridge': 'trent-bridge', 'The Oval': 'oval', 'MA Chidambaram Stadium': 'chennai',
    'Wankhede Stadium': 'wankhede', 'Eden Gardens': 'eden', 'Galle International Stadium': 'galle',
    'Dubai International Cricket Stadium': 'dubai', 'Wanderers Stadium': 'wanderers', Newlands: 'newlands',
    'Basin Reserve': 'basin', 'Sabina Park': 'sabina', 'Kensington Oval': 'kensington',
  };
  // venues.ts's bounce before these fits, read off each ground's reputation: the held-out check scores it too.
  const REPUTATION: Record<string, number> = {
    gabba: 1.1, mcg: 0.95, scg: 1, lords: 1, headingley: 0.95, 'trent-bridge': 1, oval: 1.05, chennai: 0.88, wankhede: 1.08,
    eden: 0.95, galle: 0.85, dubai: 0.82, wanderers: 1.12, newlands: 1.05, basin: 1, sabina: 1.12, kensington: 1.05,
  };
  console.log('Each ground with 3 or more Tests, 40 balls a Test, in its own air, wind, slope and grip if venues.ts has it.');
  console.log('Held out: fitted to all but its last two Tests, then the misfit (rms cm) on those two.\n');
  const held = { standard: [] as number[], fitted: [] as number[], better: 0, same: 0, worse: 0 };
  const known = { grounds: 0, standard: [] as number[], fitted: [] as number[], reputation: [] as number[] };
  const paste: string[] = [];
  for (const [g, rs] of [...groupBy(rows, (r) => r.ground)].sort(([a], [b]) => (a < b ? -1 : 1))) {
    const tests = [...new Set(rs.map((r) => `${r.date} ${r.test}`))].sort();
    if (tests.length < 3) continue;
    const id = KNOWN[g];
    const base: Venue = id ? { ...venue(id), bounce: 1 } : NEUTRAL;
    const sample = spread(rs, 40);
    const b = bounceOf(balls(sample, base));
    if (id) paste.push(`${id} ${b.bounce.toFixed(2)}`);
    let line = `${g.padEnd(38)} ${tests.length} Tests ${tests[0].slice(0, 4)}-${tests.at(-1)!.slice(0, 4)}, ${sample.length} balls: bounce ${pct(b.bounce)} ± ${(b.se * 100).toFixed(1)}`;
    if (id) line += ` (venues.ts ${pct(venue(id).bounce)})`;
    if (tests.length >= 4) {
      const late = new Set(tests.slice(-2).map((t) => t.split(' ')[1]));
      const trained = bounceOf(balls(spread(rs.filter((r) => !late.has(r.test)), 40), base)).bounce;
      const test = balls(spread(rs.filter((r) => late.has(r.test)), 60), base);
      const [std, fitted] = [misfit(test, 1), misfit(test, trained)];
      held.standard.push(...std);
      held.fitted.push(...fitted);
      const [s, f] = [rmsOf(std).toFixed(1), rmsOf(fitted).toFixed(1)];
      held[s === f ? 'same' : Number(f) < Number(s) ? 'better' : 'worse']++;
      line += ` | held out: standard ${s}, fitted ${f}`;
      if (id) {
        const rep = misfit(test, REPUTATION[id]);
        known.grounds++;
        known.standard.push(...std);
        known.fitted.push(...fitted);
        known.reputation.push(...rep);
        line += `, reputation ${rmsOf(rep).toFixed(1)}`;
      }
    }
    console.log(line);
  }
  const r = (xs: number[]) => rmsOf(xs).toFixed(1);
  console.log(
    `\nHeld out, all ${held.better + held.same + held.worse} grounds: standard ${r(held.standard)} cm, fitted ${r(held.fitted)} cm; ` +
      `fitted better at ${held.better}, the same at ${held.same}, worse at ${held.worse}.\n` +
      `At the ${known.grounds} of them venues.ts has: standard ${r(known.standard)}, fitted ${r(known.fitted)}, reputation ${r(known.reputation)}.\n` +
      `For venues.ts: ${paste.join(', ')}`,
  );
}
