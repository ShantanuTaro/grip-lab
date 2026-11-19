import { describe, expect, it } from 'vitest';
import { findSeam, handMeasures, nearest } from './device.ts';

/** A red disc on a grey background, with an optional pale stripe through its centre at the given angle. */
function ball(size: number, stripeDeg: number | null): Uint8ClampedArray {
  const px = new Uint8ClampedArray(size * size * 4);
  const c = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      const onBall = Math.hypot(dx, dy) < size * 0.4;
      const a = ((stripeDeg ?? 0) * Math.PI) / 180;
      const onStripe = stripeDeg !== null && onBall && Math.abs(dy * Math.cos(a) - dx * Math.sin(a)) < 2;
      px.set(onStripe ? [240, 235, 215, 255] : onBall ? [200, 40, 50, 255] : [90, 90, 90, 255], 4 * (y * size + x));
    }
  }
  return px;
}

describe('findSeam', () => {
  it('measures which way the stitching runs', () => {
    for (const deg of [0, 30, 80, -45]) {
      const seam = findSeam(ball(128, deg), 128, 128)!;
      expect(Math.abs(seam.angleDeg - deg)).toBeLessThan(3);
      expect(seam.straightness).toBeGreaterThan(0.9);
    }
  });

  it('finds nothing on a ball with no seam showing', () => {
    expect(findSeam(ball(128, null), 128, 128)).toBeNull();
  });
});

describe('handMeasures', () => {
  it('reads finger direction and spread from the landmarks', () => {
    const p = Array.from({ length: 21 }, () => ({ x: 0, y: 0 }));
    p[0] = { x: 0, y: 100 }; // wrist
    p[9] = { x: 0, y: 0 }; // middle knuckle: palm length 100
    p[5] = { x: -20, y: 0 }; // index knuckle
    p[12] = { x: 0, y: -80 }; // middle tip: straight up the image
    p[8] = { x: -100, y: -80 }; // index tip: splayed 45° to the left
    const m = handMeasures(p);
    expect(m.spreadDeg).toBeCloseTo(45, 0);
    expect(m.tipGap).toBeCloseTo(1, 5);
    expect(m.fingersDeg).toBeLessThan(-90); // up and to the left, in image axes
  });
});

describe('nearest', () => {
  const examples = [
    ...[0.05, 0.1, 0.08].map((seam) => ({ gripId: 'seam-up' as const, view: 'seam' as const, features: [seam, 0.2, 0.3, 0.6, 0.5] })),
    ...[0.9, 0.95, 0.85].map((seam) => ({ gripId: 'off-break' as const, view: 'seam' as const, features: [seam, 0.9, 0.9, 0.6, 0.5] })),
  ];

  it('names the grip whose labelled photos are closest', () => {
    expect(nearest([0.07, 0.25, 0.3, 0.6, 0.5], 'seam', examples)[0].gripId).toBe('seam-up');
    const spin = nearest([0.88, 0.8, 0.85, 0.6, 0.5], 'seam', examples);
    expect(spin[0].gripId).toBe('off-break');
    expect(spin[0].confidence).toBeGreaterThan(0.5);
  });

  it('copes with a photo where the seam was not found', () => {
    expect(nearest([NaN, 0.9, 0.9, 0.6, 0.5], 'side', examples)[0].gripId).toBe('off-break');
  });
});
