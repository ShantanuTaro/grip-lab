import { describe, expect, it } from 'vitest';
import { PITCH } from './constants.ts';
import type { BallType } from './constants.ts';
import { GRIPS, delivery, lengthName, lineName, revs } from './grips.ts';
import { revsFor, seamFor, speedFor } from './match.ts';
import { simulate, turnCm } from './simulate.ts';
import { NEUTRAL } from './venues.ts';

describe('the five checks in the brief', () => {
  it('goes dead straight with no swing and no spin', () => {
    const r = simulate(delivery('seam-up'));
    const a = r.points[0];
    const b = r.points.at(-1)!;
    const slope = (b.x - a.x) / (b.z - a.z);
    const worst = Math.max(...r.points.map((p) => Math.abs(p.x - (a.x + slope * (p.z - a.z)))));
    expect(worst).toBeLessThan(1e-9);
    expect(Math.abs(r.swingCm)).toBeLessThan(1e-6);
    expect(Math.abs(r.deviationDeg)).toBeLessThan(1e-6);
  });

  it('swings an outswinger away from a right-hander, and an inswinger in', () => {
    expect(simulate(delivery('outswinger')).swingCm).toBeGreaterThan(5);
    expect(simulate(delivery('inswinger')).swingCm).toBeLessThan(-5);
  });

  it('turns an off-break in, and a leg-break away', () => {
    const offBreak = simulate(delivery('off-break'));
    expect(offBreak.deviationDeg).toBeGreaterThan(1);
    expect(offBreak.atStumps.x).toBeLessThan(offBreak.bounce.x); // finishes further to leg than it pitched
    expect(simulate(delivery('leg-break')).deviationDeg).toBeLessThan(-1);
  });

  it('makes a slower ball take longer and bounce lower', () => {
    const quick = simulate(delivery('seam-up', { speedKph: 132 }));
    const slow = simulate(delivery('seam-up', { speedKph: 100 }));
    expect(slow.timeToStumpsS).toBeGreaterThan(quick.timeToStumpsS);
    expect(slow.atStumps.y).toBeLessThan(quick.atStumps.y);
  });

  it('pitches within 5 cm of the requested length and line', () => {
    for (const g of GRIPS) {
      for (const arm of ['right', 'left'] as const) {
        for (const lineCm of [-50, 0, 50]) {
          for (const lengthM of [1, g.lengthM, 11]) {
            const r = simulate(delivery(g.id, { arm, lineCm, lengthM }));
            expect(Math.abs(r.bounce.z - (PITCH.stumpsZ - lengthM))).toBeLessThan(0.05);
            expect(Math.abs(r.bounce.x - -lineCm / 100)).toBeLessThan(0.05); // off side is +x for a right-hander
          }
        }
      }
    }
  });
});

describe('beyond the brief', () => {
  it('mirrors exactly for a left-arm bowler to a left-handed batter', () => {
    const right = simulate(delivery('off-break', { seamAngleDeg: 12 }));
    const left = simulate(delivery('off-break', { seamAngleDeg: 12, arm: 'left', batter: 'left' }));
    expect(left.swingCm).toBeCloseTo(right.swingCm, 6);
    expect(left.deviationDeg).toBeCloseTo(right.deviationDeg, 6);
    expect(left.atStumps.x).toBeCloseTo(-right.atStumps.x, 8);
    expect(left.atStumps.verdict).toBe(right.atStumps.verdict);
  });

  it('reverse-swings an old ball at pace', () => {
    const outswingerSeam = { seamAngleDeg: 22, lengthM: 5.5 };
    expect(simulate(delivery('seam-up', { ...outswingerSeam, ball: 'old', speedKph: 145 })).swingCm).toBeLessThan(-5);
    expect(simulate(delivery('seam-up', { ...outswingerSeam, ball: 'old', speedKph: 100 })).swingCm).toBeGreaterThan(2);
    expect(simulate(delivery('seam-up', { ...outswingerSeam, ball: 'new', speedKph: 125 })).swingCm).toBeGreaterThan(5);
  });

  it('tells a googly from an off-break at the same speed and revs', () => {
    const same = { speedKph: 84, spinRpm: 1900 };
    const offBreak = simulate(delivery('off-break', same));
    const googly = simulate(delivery('googly', same));
    expect(googly.atStumps.y).toBeGreaterThan(offBreak.atStumps.y); // more overspin: bounces higher
    expect(googly.swingCm).toBeLessThan(offBreak.swingCm); // less drift
  });

  it('gives a result at every corner of the simulator sliders', () => {
    for (const speedKph of [60, 160])
      for (const seamAngleDeg of [-30, 30])
        for (const spinRpm of [-3000, 3000])
          for (const lengthM of [1, 11])
            for (const lineCm of [-50, 50])
              for (const arm of ['right', 'left'] as const) {
                const r = simulate(delivery('seam-up', { speedKph, seamAngleDeg, spinRpm, lengthM, lineCm, arm, ball: 'old' }));
                expect(Number.isFinite(r.atStumps.y) && Number.isFinite(r.swingCm)).toBe(true);
              }
  });

  it('lets a dying ball roll in instead of hanging', () => {
    // 30 kph and very short: it runs out of bounce before the stumps, for any restitution up to 0.7.
    const r = simulate(delivery('seam-up', { speedKph: 30, lengthM: 16 }));
    expect(r.atStumps.y - 0.036).toBeLessThan(0.001); // on the pitch: rolling (centre one radius up) or in its last sub-millimetre hops
    expect(r.timeToStumpsS).toBeGreaterThan(1.5);
  });

  it('releases from the bowler: lower for a shorter one, wide on the other side round the wicket', () => {
    const tall = simulate(delivery('seam-up', { bowlerHeightM: 1.95 }));
    const short = simulate(delivery('seam-up', { bowlerHeightM: 1.7 }));
    expect(short.points[0].y).toBeCloseTo(1.7 * 1.11);
    expect(short.atStumps.y).toBeLessThan(tall.atStumps.y); // a flatter path into the pitch bounces lower
    expect(simulate(delivery('seam-up', { wicket: 'round' })).points[0].x).toBeLessThan(-0.5); // the bowler's right
  });

  it('turns the coach words into the measured numbers', () => {
    expect(revs('off-break', 'club')).toBe(1100);
    expect(revs('leg-break', 'big')).toBe(-2500);
    expect(revs('outswinger', 'club')).toBe(0); // seam grips keep their own
    expect(lengthName(4.5, 'spin')).toBe('Good length'); // a Test spinner's usual length
    expect(lengthName(4.5, 'pace')).toBe('Full');
    expect(lineName(-19)).toBe('4th stump');
  });

  it('gives a wobble seam no swing, and seam movement either way depending on how it lands', () => {
    const toSlips = simulate(delivery('outswinger', { wobble: 1 }));
    const toLeg = simulate(delivery('outswinger', { wobble: -1 }));
    expect(Math.abs(toSlips.swingCm)).toBeLessThan(1e-6);
    expect(toSlips.deviationDeg).toBeLessThan(-0.5); // away from the batter
    expect(toLeg.deviationDeg).toBeGreaterThan(0.5);
  });

  it('works back from the swing, turn and time a coach saw to the seam, revs and speed', () => {
    const swung = simulate(delivery('outswinger', { seamAngleDeg: 12 })).swingCm;
    expect(seamFor(delivery('outswinger'), NEUTRAL, swung).value).toBeCloseTo(12, 1);
    const turned = Math.abs(turnCm(simulate(delivery('off-break', { spinRpm: 1300 }))));
    expect(revsFor(delivery('off-break'), NEUTRAL, turned).value).toBeCloseTo(1300, -1);
    const took = simulate(delivery('seam-up', { speedKph: 141 })).timeToStumpsS;
    expect(speedFor(delivery('seam-up'), NEUTRAL, took).value).toBeCloseTo(141, 1);
    expect(seamFor(delivery('outswinger'), NEUTRAL, 500).value).toBeNull(); // no ball swings 5 m
  });

  it('flies each ball as measured: a Dukes swings to a higher speed, an old Kookaburra reverses harder and seams less', () => {
    const swing = (ballType: BallType, ball: 'new' | 'old', speedKph: number) => simulate(delivery('outswinger', { ballType, ball, speedKph })).swingCm;
    expect(swing('dukes', 'new', 136)).toBeGreaterThan(2 * swing('kookaburra', 'new', 136)); // the Kookaburra nears its reverse speed
    expect(swing('pink', 'new', 136)).toBeGreaterThan(swing('kookaburra', 'new', 136)); // pink swings more while new...
    expect(swing('pink', 'old', 145)).toBeGreaterThan(swing('kookaburra', 'old', 145)); // ...and reverses less once old
    expect(swing('kookaburra', 'old', 145)).toBeLessThan(swing('dukes', 'old', 145)); // reverse is −: harder
    expect(simulate(delivery('outswinger')).swingCm).toBe(swing('kookaburra', 'new', 132)); // the Kookaburra unless set
    const seam = (ballType: BallType) => simulate(delivery('outswinger', { ballType, ball: 'old', wobble: 1 })).deviationDeg;
    expect(Math.abs(seam('kookaburra'))).toBeLessThan(Math.abs(seam('dukes')));
  });

  it('reports the spin the pitch leaves on the ball', () => {
    const seamUp = simulate(delivery('seam-up'));
    expect(seamUp.spin.release).toEqual([0, 0, 0]);
    expect(seamUp.spin.afterBounce[0]).toBeGreaterThan(50); // friction puts topspin on every ball
    const offBreak = simulate(delivery('off-break'));
    expect(Math.abs(offBreak.spin.afterBounce[2])).toBeLessThan(Math.abs(offBreak.spin.release[2])); // side spin is spent on turn
  });
});
