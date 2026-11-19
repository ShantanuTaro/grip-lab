import { describe, expect, it } from 'vitest';
import { DEFAULT_COEFFS } from '../physics/constants.ts';
import { synthesize } from '../physics/fit.ts';
import { GRIPS, delivery } from '../physics/grips.ts';
import { dewPoint, fromMeasurements, paceKept } from '../physics/measurements.ts';
import { NEUTRAL } from '../physics/venues.ts';
import { venue } from '../physics/venues.ts';
import { parseReading } from './ai.ts';
import { DEMOS } from './demo.ts';
import { TEMPLATE, fitGround, readCsv } from './tracked.ts';

describe('measurements', () => {
  it('reads the ECB targets as a standard pitch, and a livelier rebound as more bounce', () => {
    expect(fromMeasurements(NEUTRAL, { reboundCm: 55 }).venue.bounce).toBeCloseTo(1);
    expect(fromMeasurements(NEUTRAL, { cleggG: 360 }).venue.bounce).toBeCloseTo(1);
    expect(fromMeasurements(NEUTRAL, { reboundCm: 70 }).venue.bounce).toBeGreaterThan(1.1);
  });

  it('solves the grip so the pitch keeps exactly the measured share of the speed', () => {
    for (const p of [86, 92]) expect(paceKept(fromMeasurements(NEUTRAL, { paceKeptPct: p }).venue)).toBeCloseTo(p / 100, 3);
  });

  it('turns weather into air, wind and dew', () => {
    expect(dewPoint(20, 100)).toBeCloseTo(20, 1);
    const v = fromMeasurements(NEUTRAL, { tempC: 18, humidityPct: 95, windKph: 36, windFromDeg: 90 }).venue;
    expect(v.dew).toBeGreaterThan(0.75); // dew point within a degree of the air
    expect(v.wind[0]).toBeCloseTo(10); // from the bowler's right, toward +x
    expect(v.wind[1]).toBeCloseTo(0);
  });
});

describe('tracked deliveries', () => {
  it('reads the template and names a bad row', () => {
    expect(readCsv(TEMPLATE)).toHaveLength(1);
    expect(() => readCsv(TEMPLATE.replace('right,right', 'right,middle'))).toThrow(/Row 2: batter/);
  });

  it('finds a livelier, grippier pitch from its tracking', () => {
    const balls = Array.from({ length: 24 }, (_, i) => delivery(GRIPS[i % GRIPS.length].id, { lengthM: 4 + (i % 5) }));
    const truth = { ...NEUTRAL, bounce: 1.15, grip: 1.3 };
    const obs = synthesize(balls, { ...DEFAULT_COEFFS, restitution: DEFAULT_COEFFS.restitution * 1.15, friction: DEFAULT_COEFFS.friction * 1.3 }, 5);
    const { venue } = fitGround(NEUTRAL, obs);
    expect(venue.bounce).toBeCloseTo(truth.bounce, 1);
    expect(venue.grip).toBeCloseTo(truth.grip, 1);
  });

  it('rejects a tracking glitch, naming the row', () => {
    expect(() => readCsv(TEMPLATE.replace(',62,', ',-60987,'))).toThrow(/Row 2: heightAtStumpsCm/);
  });

  it('finds the Gabba bouncier and Mohali lower in their real Hawk-Eye tracking', () => {
    const fitted = (label: string) => {
      const d = DEMOS.find((x) => x.label === label)!;
      return fitGround(venue(d.base), readCsv(d.csv)).venue;
    };
    for (const d of DEMOS) expect(readCsv(d.csv)).toHaveLength(100);
    const gabba = fitted('The Gabba');
    const mohali = fitted('Mohali');
    expect(gabba.bounce).toBeGreaterThan(1.08); // 118% when checked
    expect(mohali.bounce).toBeLessThan(0.93); // 85%
    expect(gabba.grip).toBe(venue('gabba').grip); // heights alone cannot pin down grip: left as it was
  }, 30_000);
});

describe('the AI reader', () => {
  const text = 'Green top, 6mm of grass. Rebound tests about 62 cm.';
  it('keeps quoted numbers, drops impossible ones, and flags quotes that are not in the text', () => {
    const r = parseReading(
      JSON.stringify({
        name: null,
        fields: {
          grassLengthMm: { value: 6, quote: '6mm of grass', guess: false },
          reboundCm: { value: 62, quote: 'invented words', guess: false },
          moisturePct: { value: 400, quote: 'x' },
          nonsense: { value: 1 },
        },
      }),
      text,
    );
    expect(r.values).toEqual({ grassLengthMm: 6, reboundCm: 62 });
    expect(r.why.grassLengthMm?.guess).toBe(false);
    expect(r.why.reboundCm?.guess).toBe(true);
  });
});
