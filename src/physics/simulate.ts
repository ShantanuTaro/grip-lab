// Ball-flight simulation. Pure TypeScript: no React, no three.js.
//
// Coordinates (right-handed, so they map straight onto three.js):
//   z runs down the pitch, from the bowler's stumps (0) to the batter's stumps (20.12 m)
//   y is height above the pitch
//   x is across the pitch; +x is the bowler's LEFT, the off side for a right-handed batter
//
// A Delivery and a Result use batter-relative signs instead ("away from the batter",
// "into the batter"), so the same numbers work for a left-hander.

import {
  AIR_DENSITY,
  BALL,
  BALLS,
  DEFAULT_COEFFS,
  G,
  MAGNUS_A,
  MAGNUS_B,
  PITCH,
  RELEASE,
  SWING_VS_SEAM_ANGLE,
  SWING_VS_SPEED,
  WOBBLE_DEG,
  lookup,
} from './constants.ts';
import type { BallCondition, BallType, Coeffs } from './constants.ts';
import { NEUTRAL, airDensity, crackAt } from './venues.ts';
import type { Conditions, Venue } from './venues.ts';

/**
 * How the spin is split between three jobs. Whatever is left after `top` and `drift`,
 * √(1 − top² − drift²), is side spin about the line of flight: it turns the ball off the pitch.
 */
export interface SpinAxis {
  /** Share that is topspin (+) or backspin (−). Topspin dips and kicks; backspin carries. */
  top: number;
  /** Share about the vertical axis. It drifts the ball in the air, the opposite way to its turn. */
  drift: number;
}

export interface Delivery {
  speedKph: number;
  /** + points the seam at the slips (swings away from the batter); − points it at fine leg. */
  seamAngleDeg: number;
  /**
   * Set for a wobble seam, which replaces the seam angle: where the wobble had the seam when the ball landed, from −1
   * (fully toward fine leg) to 1 (fully toward the slips). See WOBBLE_DEG.
   */
  wobble?: number;
  /** + turns into the batter (off-break direction); − turns away (leg-break direction). */
  spinRpm: number;
  /** Defaults to pure side spin. */
  spinAxis?: SpinAxis;
  /** Where it pitches, in metres from the batter's stumps. */
  lengthM: number;
  /** Where it pitches across the pitch, in cm from middle stump: − is the off side, + the leg side. */
  lineCm: number;
  arm: 'right' | 'left';
  /** Over the wicket unless set. */
  wicket?: 'over' | 'round';
  /** The bowler's standing height, which sets the release height (RELEASE in constants.ts). */
  bowlerHeightM?: number;
  batter: 'right' | 'left';
  ball: BallCondition;
  /** Which ball (BALLS in constants.ts): the Kookaburra unless set. */
  ballType?: BallType;
  /** A tracked release point in pitch coordinates, when known. Otherwise from the arm, wicket and height. */
  release?: { x?: number; y?: number; z?: number };
}

/** Where the ball leaves the hand: the tracked point if there is one, else from the arm, the wicket and the bowler's height. */
export function releasePoint(d: Delivery) {
  const side = d.wicket === 'round' ? -RELEASE.roundSide : RELEASE.side; // + is the bowler's left for a right-armer
  return {
    x: d.release?.x ?? (d.arm === 'right' ? side : -side),
    y: d.release?.y ?? (d.bowlerHeightM ? d.bowlerHeightM * RELEASE.perHeight : RELEASE.height),
    z: d.release?.z ?? RELEASE.z,
  };
}

export type Verdict = 'hitting' | 'missing-off' | 'missing-leg' | 'over-the-top';

/** Position of the ball's centre, t seconds after release. */
export interface Point {
  t: number;
  x: number;
  y: number;
  z: number;
}

export interface Result {
  /** One point per millisecond from release to the batter's stumps. */
  points: Point[];
  bounce: { t: number; x: number; z: number };
  /** Sideways movement in the air by the time it pitches. + is away from the batter. */
  swingCm: number;
  /** Change of direction off the pitch. + is into the batter. */
  deviationDeg: number;
  timeToStumpsS: number;
  speedAfterBounceKph: number;
  speedBeforeBounceKph: number;
  /** Ball centre as it reaches the batter's stumps. */
  atStumps: { x: number; y: number; verdict: Verdict };
  /** Spin vector in rad/s (right-hand rule, pitch coordinates): at release, and after the pitch has changed it. */
  spin: { release: Vec3; afterBounce: Vec3 };
  /** It pitched on a crack, which kept it low or kicked it up. */
  crack: 'low' | 'high' | null;
}

export type Vec3 = readonly [number, number, number];

const DT = 0.001; // s, RK4 step (Brief)
const MAX_T = 5; // s, gives up on a ball that never arrives
const ROLL_VY = 0.05; // m/s. A rebound slower than this (a 0.1 mm hop) is treated as rolling.
const DEG = Math.PI / 180;
const R = BALL.radius;
const K = (0.5 * AIR_DENSITY * Math.PI * R * R) / BALL.mass; // ½ρA/m: force coefficient × speed² → acceleration

interface Flight {
  bx: number; // first bounce
  bz: number;
  bt: number;
  swing: number; // m toward +x, in the air
  turn: number; // rad toward +x, off the pitch
  vAfter: number; // m/s just after the bounce
  vBefore: number;
  wx: number; // spin about x and z just after the bounce (rad/s); spin about y does not change
  wz: number;
  crack: 'low' | 'high' | null;
  ts: number; // at the batter's stumps
  xs: number;
  ys: number;
}

export function simulate(d: Delivery, c: Coeffs = DEFAULT_COEFFS, v: Venue | Conditions = NEUTRAL): Result {
  // The ground: thinner air at altitude and in heat, the pitch's bounce, grip and seam, the wind and the slope.
  const k = K * (airDensity(v.altitudeM, v.tempC) / airDensity(0, 20));
  const e = Math.min(0.95, c.restitution * v.bounce);
  const mu = c.friction * v.grip;
  const [windX, windZ] = v.wind;
  const slope = ((v.slopeDeg ?? 0) * Math.PI) / 180;
  const off = d.batter === 'right' ? 1 : -1; // which way the off side is in x
  const { x: x0, y: y0, z: z0 } = releasePoint(d);
  const targetX = (-off * d.lineCm) / 100;
  const targetZ = PITCH.stumpsZ - d.lengthM;
  const s0 = d.speedKph / 3.6;

  // Spin vector at release (rad/s). Topspin is +x; turning into the batter is +z for a right-hander.
  const top = d.spinAxis?.top ?? 0;
  const drift = d.spinAxis?.drift ?? 0;
  const side = Math.sqrt(Math.max(0, 1 - top * top - drift * drift));
  const w = (Math.abs(d.spinRpm) * 2 * Math.PI) / 60;
  const into = Math.sign(d.spinRpm) * off;
  const w0x = w * top;
  const w0y = w * into * drift;
  const w0z = w * into * side;

  // A wobbling seam has no steady angle in the air, so no seam swing, and lands at whatever angle the wobble had then.
  const airSeam = d.wobble === undefined ? d.seamAngleDeg : 0;
  const landSeam = d.wobble === undefined ? d.seamAngleDeg : d.wobble * WOBBLE_DEG;

  // Seam swing: side-force coefficient before the speed factor, signed toward +x.
  const swing0 = v.swing * c.swingCsMax * lookup(SWING_VS_SEAM_ANGLE, Math.abs(airSeam)) * Math.sign(airSeam) * off;
  // The ball: where it starts to reverse, how hard it reverses once old, and how much an old seam still moves it.
  const make = BALLS[d.ballType ?? 'kookaburra'];
  const old = d.ball === 'old';
  const swingVsSpeed = SWING_VS_SPEED[d.ball];
  const reverseKph = make.reverseKph[d.ball];
  const swingAt = (kph: number) => {
    const s = lookup(swingVsSpeed, kph - reverseKph);
    return old && s < 0 ? s * make.oldReverse : s;
  };
  const seamWear = old ? make.oldSeam : 1;

  // Flies one ball. With `points` it runs to the batter's stumps and records the path;
  // without, it stops at the first bounce (all the release-angle solver needs).
  const fly = (alpha: number, beta: number, points: Point[] | null): Flight => {
    let x = x0;
    let y = y0;
    let z = z0;
    let t = 0;
    let vx = s0 * Math.cos(alpha) * Math.sin(beta);
    let vy = s0 * Math.sin(alpha);
    let vz = s0 * Math.cos(alpha) * Math.cos(beta);
    let wx = w0x;
    const wy = w0y;
    let wz = w0z;
    let swing = swing0;
    let rolling = false;
    let ax = 0;
    let ay = 0;
    let az = 0;
    const out: Flight = { bx: NaN, bz: NaN, bt: NaN, swing: 0, turn: 0, vAfter: 0, vBefore: 0, wx: w0x, wz: w0z, crack: null, ts: NaN, xs: NaN, ys: NaN };

    // Acceleration for velocity u; writes ax, ay, az.
    const accel = (ux: number, uy: number, uz: number) => {
      ux -= windX; // the air acts on the ball's speed through the air, not over the ground
      uz -= windZ;
      const sp = Math.hypot(ux, uy, uz);
      const kd = k * c.dragCd * sp;
      ax = -kd * ux;
      ay = -G - kd * uy;
      az = -kd * uz;

      // Magnus: along ω × v, sized by the lift curve.
      const cx = wy * uz - wz * uy;
      const cy = wz * ux - wx * uz;
      const cz = wx * uy - wy * ux;
      const cross = Math.hypot(cx, cy, cz);
      if (cross > 1e-9) {
        const spinParam = (R * cross) / (sp * sp);
        const km = (k * c.magnusScale * R) / (MAGNUS_A * spinParam + MAGNUS_B);
        ax += km * cx;
        ay += km * cy;
        az += km * cz;
      }

      // Seam swing: horizontal, at right angles to the flight. It follows the current speed, so a
      // ball that slows into the swing band moves late.
      if (swing !== 0) {
        const ks = (k * swing * swingAt(sp * 3.6) * sp * sp) / Math.hypot(ux, uz);
        ax += ks * uz;
        az -= ks * ux;
      }
    };

    // One RK4 step of length h.
    const step = (h: number) => {
      accel(vx, vy, vz);
      const k1x = ax, k1y = ay, k1z = az;
      const v2x = vx + 0.5 * h * k1x, v2y = vy + 0.5 * h * k1y, v2z = vz + 0.5 * h * k1z;
      accel(v2x, v2y, v2z);
      const k2x = ax, k2y = ay, k2z = az;
      const v3x = vx + 0.5 * h * k2x, v3y = vy + 0.5 * h * k2y, v3z = vz + 0.5 * h * k2z;
      accel(v3x, v3y, v3z);
      const k3x = ax, k3y = ay, k3z = az;
      const v4x = vx + h * k3x, v4y = vy + h * k3y, v4z = vz + h * k3z;
      accel(v4x, v4y, v4z);
      x += (h / 6) * (vx + 2 * v2x + 2 * v3x + v4x);
      y += (h / 6) * (vy + 2 * v2y + 2 * v3y + v4y);
      z += (h / 6) * (vz + 2 * v2z + 2 * v3z + v4z);
      vx += (h / 6) * (k1x + 2 * k2x + 2 * k3x + ax);
      vy += (h / 6) * (k1y + 2 * k2y + 2 * k3y + ay);
      vz += (h / 6) * (k1z + 2 * k2z + 2 * k3z + az);
      t += h;
    };

    points?.push({ t, x, y, z });
    while (t < MAX_T) {
      const px = x, py = y, pz = z, pvx = vx, pvy = vy, pvz = vz, pt = t;
      const back = () => {
        x = px; y = py; z = pz; vx = pvx; vy = pvy; vz = pvz; t = pt;
      };
      step(DT);
      if (rolling) {
        // Held on the pitch. Rolling resistance is ignored: only air drag slows it from here.
        y = R;
        vy = 0;
      }

      if (points && z >= PITCH.stumpsZ) {
        const f = (PITCH.stumpsZ - pz) / (z - pz);
        out.ts = pt + f * (t - pt);
        out.xs = px + f * (x - px);
        out.ys = py + f * (y - py);
        points.push({ t: out.ts, x: out.xs, y: out.ys, z: PITCH.stumpsZ });
        break;
      }

      if (y < R && vy < 0) {
        // The step went through the pitch. Redo it, stopping at the moment of contact.
        let h = (DT * (py - R)) / (py - y);
        back();
        step(h);
        h += (y - R) / -vy;
        back();
        step(h);
        y = R;

        const first = Number.isNaN(out.bt);
        if (first) {
          out.bx = x;
          out.bz = z;
          out.bt = t;
          if (!points) break;
          out.swing = x - (x0 + (z - z0) * Math.tan(beta));
          out.vBefore = Math.hypot(vx, vy, vz);
        }
        const headingIn = Math.atan2(vx, vz);

        // A crack under the ball changes how much it bounces and knocks it sideways, off the crack's edge.
        let eb = e;
        let knock = 0;
        const hit = first && 'cracks' in v ? crackAt(v.cracks, x, z) : null;
        if (hit) {
          eb = Math.min(0.95, e * (1 + 0.35 * hit.f * hit.kind));
          knock = hit.f * 5 * DEG * hit.side;
          out.crack = hit.kind < 0 ? 'low' : 'high';
        }

        // Bounce: a rigid ball with restitution and sliding friction. Friction acts against the
        // motion of the point touching the pitch, which is where spin turns into deviation.
        const vIn = -vy;
        const ux = vx + R * wz;
        const uz = vz - R * wx;
        const u = Math.hypot(ux, uz);
        if (u > 1e-9) {
          // Slides for the whole impact, unless friction is enough to stop the contact point first.
          const dv = Math.min(mu * (1 + eb) * vIn, u / (1 + 1 / BALL.inertiaFactor));
          vx -= (dv * ux) / u;
          vz -= (dv * uz) / u;
          wx += (dv * uz) / u / (BALL.inertiaFactor * R);
          wz -= (dv * ux) / u / (BALL.inertiaFactor * R);
        }
        vy = eb * vIn;
        vx -= (1 + eb) * vIn * Math.sin(slope); // a tilted pitch bounces the ball down its slope
        if (vy < ROLL_VY) {
          // Too slow to leave the pitch for a whole step. Without this the contact search stops
          // advancing time and a dying ball never arrives.
          vy = 0;
          rolling = true;
        }

        if (first) {
          // An angled seam kicks the ball the way it points.
          const phi = off * v.seam * c.seamKickDegPerDeg * seamWear * landSeam * DEG + knock;
          const nvx = vx * Math.cos(phi) + vz * Math.sin(phi);
          vz = vz * Math.cos(phi) - vx * Math.sin(phi);
          vx = nvx;
          out.turn = Math.atan2(vx, vz) - headingIn;
          out.vAfter = Math.hypot(vx, vy, vz);
          out.wx = wx;
          out.wz = wz;
          swing = 0; // assumption: the bounce disturbs the seam, so no seam swing after pitching
        }
      }
      points?.push({ t, x, y, z });
    }
    return out;
  };

  // Solve the two release angles so the ball pitches on the requested length and line.
  const miss = (alpha: number, beta: number): [number, number] => {
    const f = fly(alpha, beta, null);
    return [f.bx - targetX, f.bz - targetZ];
  };
  const dist = targetZ - z0;
  const tGuess = (dist / s0) * (1 + 0.5 * k * c.dragCd * dist);
  let alpha = Math.atan((0.5 * G * tGuess * tGuess - (y0 - R)) / dist); // elevation, + is upward
  let beta = Math.atan((targetX - x0) / dist); // heading, + is toward +x
  let j11 = 0, j12 = 0, j21 = 0, j22 = 0;
  for (let i = 0; i < 20; i++) {
    const [ex, ez] = miss(alpha, beta);
    if (Math.hypot(ex, ez) < 1e-7) break;
    if (i % 3 === 0) {
      const h = 1e-5;
      const [ax, az] = miss(alpha + h, beta);
      const [bx, bz] = miss(alpha, beta + h);
      j11 = (ax - ex) / h;
      j21 = (az - ez) / h;
      j12 = (bx - ex) / h;
      j22 = (bz - ez) / h;
    }
    const det = j11 * j22 - j12 * j21;
    alpha -= (j22 * ex - j12 * ez) / det;
    beta -= (j11 * ez - j21 * ex) / det;
  }

  const points: Point[] = [];
  const f = fly(alpha, beta, points);
  if (Number.isNaN(f.ts)) throw new Error(`Ball never reached the batter's stumps: ${JSON.stringify(d)}`);

  const verdict: Verdict =
    f.ys - R > PITCH.stumpHeight
      ? 'over-the-top'
      : Math.abs(f.xs) <= PITCH.wicketHalfWidth + R
        ? 'hitting'
        : off * f.xs > 0
          ? 'missing-off'
          : 'missing-leg';

  return {
    points,
    bounce: { t: f.bt, x: f.bx, z: f.bz },
    swingCm: off * f.swing * 100,
    deviationDeg: (-off * f.turn) / DEG,
    timeToStumpsS: f.ts,
    speedAfterBounceKph: f.vAfter * 3.6,
    speedBeforeBounceKph: f.vBefore * 3.6,
    atStumps: { x: f.xs, y: f.ys, verdict },
    spin: { release: [w0x, w0y, w0z], afterBounce: [f.wx, w0y, f.wz] },
    crack: f.crack,
  };
}

/** How far the ball has moved off its line by the batter's stumps, in cm (+ into the batter): the turn as a coach sees it. */
export const turnCm = (r: Result) => Math.tan(r.deviationDeg * DEG) * (PITCH.stumpsZ - r.bounce.z) * 100;

/** Where the ball is t seconds after release, read off a result's path. */
export function pointAt(points: Point[], t: number): Point {
  // Points are 1 ms apart except around a bounce, so the index is nearly t / DT: guess, then walk.
  let i = Math.min(points.length - 2, Math.max(0, Math.floor(t / DT)));
  while (i > 0 && points[i].t > t) i--;
  while (i < points.length - 2 && points[i + 1].t < t) i++;
  const a = points[i];
  const b = points[i + 1];
  const f = Math.min(1, Math.max(0, (t - a.t) / (b.t - a.t || 1)));
  return { t: a.t + f * (b.t - a.t), x: a.x + f * (b.x - a.x), y: a.y + f * (b.y - a.y), z: a.z + f * (b.z - a.z) };
}
