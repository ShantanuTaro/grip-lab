import { describe, expect, it } from 'vitest';
import { DEFAULT_COEFFS } from './constants.ts';
import { fit, synthesize } from './fit.ts';
import { GRIPS, delivery } from './grips.ts';

// A spread of deliveries: every grip, with speed, length and line varied.
const spread = (n: number) =>
  Array.from({ length: n }, (_, i) => {
    const g = GRIPS[i % GRIPS.length];
    return delivery(g.id, {
      speedKph: g.speedKph + ((i * 7) % 13) - 6,
      lengthM: g.lengthM + ((i * 5) % 7) * 0.4 - 1.2,
      lineCm: ((i * 11) % 41) - 20,
    });
  });

describe('fit', () => {
  it('recovers known coefficients from noisy synthetic tracking', () => {
    const truth = { ...DEFAULT_COEFFS, dragCd: 0.52, restitution: 0.61, friction: 0.42 };
    const report = fit(synthesize(spread(48), truth, 7), ['dragCd', 'restitution', 'friction']);

    for (const name of ['dragCd', 'restitution', 'friction'] as const) {
      const err = Math.abs(report.coeffs[name] - truth[name]);
      expect(err / truth[name]).toBeLessThan(0.03); // within 3%
      expect(err).toBeLessThan(4 * report.stdErr[name]!); // and inside its own stated uncertainty
    }
    expect(report.rms.heightAtStumpsCm!.after).toBeLessThan(report.rms.heightAtStumpsCm!.before);
    expect(report.coeffs.swingCsMax).toBe(DEFAULT_COEFFS.swingCsMax); // untouched: not asked for
  });

  it('says so when the data cannot determine a coefficient', () => {
    // Seam-up balls with an upright seam never swing, so they carry no information about swing strength.
    const upright = spread(8).map((d) => ({ ...d, seamAngleDeg: 0 }));
    const report = fit(synthesize(upright, DEFAULT_COEFFS, 3), ['swingCsMax', 'dragCd']);
    expect(report.stdErr.swingCsMax).toBe(Infinity);
    expect(report.coeffs.swingCsMax).toBe(DEFAULT_COEFFS.swingCsMax);
    expect(report.stdErr.dragCd).toBeLessThan(0.05);
  });
});
