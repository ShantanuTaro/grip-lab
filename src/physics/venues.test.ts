import { describe, expect, it } from 'vitest';
import { delivery } from './grips.ts';
import { simulate } from './simulate.ts';
import { NEUTRAL, airDensity, venue, VENUES, wear } from './venues.ts';

const run = (grip: Parameters<typeof delivery>[0], id: string) => simulate(delivery(grip), undefined, venue(id));

describe('grounds', () => {
  it('leaves the standard pitch exactly as before', () => {
    expect(airDensity(0, 20)).toBeCloseTo(1.204, 3);
    expect(run('outswinger', 'neutral').swingCm).toBe(simulate(delivery('outswinger')).swingCm);
  });

  it('bounces higher at Perth and lower in Dubai', () => {
    const h = (id: string) => run('seam-up', id).atStumps.y;
    expect(h('perth')).toBeGreaterThan(h('neutral'));
    expect(h('dubai')).toBeLessThan(h('neutral'));
  });

  it('turns more at Chennai, swings more at Headingley, swings less in thin air', () => {
    expect(run('off-break', 'chennai').deviationDeg).toBeGreaterThan(run('off-break', 'neutral').deviationDeg);
    expect(run('outswinger', 'headingley').swingCm).toBeGreaterThan(run('outswinger', 'neutral').swingCm);
    const thin = { ...venue('neutral'), altitudeM: 1753 };
    expect(simulate(delivery('outswinger'), undefined, thin).swingCm).toBeLessThan(run('outswinger', 'neutral').swingCm);
  });

  it("moves a straight ball with the wind, and down the slope at Lord's", () => {
    const straight = run('seam-up', 'neutral').atStumps.x;
    expect(simulate(delivery('seam-up'), undefined, { ...venue('neutral'), wind: [6, 0] }).atStumps.x).toBeGreaterThan(straight);
    expect(simulate(delivery('seam-up'), undefined, { ...venue('neutral'), slopeDeg: 1.4 }).atStumps.x).toBeLessThan(straight);
  });

  it('still pitches on the requested spot at every ground', () => {
    for (const v of VENUES) {
      const d = delivery('leg-break');
      const r = simulate(d, undefined, v);
      expect(Math.abs(r.bounce.z - (20.12 - d.lengthM))).toBeLessThan(0.05);
    }
  });
});

describe('a match wearing on', () => {
  const at = (id: string, day: number, dew = false, grip: Parameters<typeof delivery>[0] = 'off-break') =>
    simulate(delivery(grip), undefined, { ...wear(venue(id), day, dew ? 1 : 0), cracks: [] });

  it('keeps lower and turns more by day 5', () => {
    expect(at('chennai', 5).atStumps.y).toBeLessThan(at('chennai', 1).atStumps.y);
    expect(at('chennai', 5).deviationDeg).toBeGreaterThan(at('chennai', 1).deviationDeg);
  });

  it('turns less with dew on the ball', () => {
    expect(at('chennai', 3, true).deviationDeg).toBeLessThan(at('chennai', 3).deviationDeg);
  });

  it('cracks only after day 1, in the same places each day', () => {
    expect(wear(venue('galle'), 1, 0).cracks).toHaveLength(0);
    const d3 = wear(venue('galle'), 3, 0).cracks;
    const d5 = wear(venue('galle'), 5, 0).cracks;
    expect(d5.length).toBeGreaterThan(d3.length);
    expect(d5[0].x1).toBe(d3[0].x1);
  });

  it('changes the bounce of a ball that pitches on a crack', () => {
    const d = delivery('seam-up', { lineCm: 0 });
    const z = 20.12 - d.lengthM;
    const crack = (kind: 1 | -1) => ({ ...wear(NEUTRAL, 1, 0), cracks: [{ x1: -0.2, z1: z, x2: 0.2, z2: z, width: 0.006, kind }] });
    const plain = simulate(d);
    const low = simulate(d, undefined, crack(-1));
    expect(low.crack).toBe('low');
    expect(low.atStumps.y).toBeLessThan(plain.atStumps.y - 0.05);
    expect(simulate(d, undefined, crack(1)).atStumps.y).toBeGreaterThan(plain.atStumps.y + 0.05);
  });
});
