// The 3D view: the ball and its path, the four cameras, and the finishing pass (bloom and film tone).
// The ground and the stadium are in World.tsx.
// Pitch coordinates are used as they are: x across, y up, z down the pitch (see physics/simulate.ts).

import { Line } from '@react-three/drei';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import type { ComponentRef } from 'react';
import * as THREE from 'three';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { BALL, PITCH, WOBBLE_DEG } from '../physics/constants.ts';
import { pointAt, releasePoint } from '../physics/simulate.ts';
import type { Delivery, Point, Result } from '../physics/simulate.ts';
import { calm, useStore } from '../store.ts';
import type { Pov } from '../store.ts';
import { leather, usePalette } from './tokens.ts';
import World from './World.tsx';

// Ball paint that is not a page token: the stamp on the leather.
const STAMP = '#E9C46A';
// A seam bowler's release puts backspin on the ball, about 11 turns a second (Mehta, "An overview of cricket
// ball swing", 2005), which is what holds the seam steady. Only drawn: the physics gives a seam-up ball no spin.
const SEAM_BACKSPIN = 11 * 2 * Math.PI; // rad/s

const DEG = Math.PI / 180;
const R = BALL.radius;
// The ball is drawn larger than life so it can be seen from 20 m, as broadcast graphics do.
// The physics and the stumps verdict use the true size, and so does the Ball view, which is close enough to.
const BALL_DRAW_SCALE = 1.67; // matches the design mock
const BALL_MIN_PX = 4; // and never smaller than this radius on screen
const FLAT = -Math.PI / 2; // rotation that lays a shape on the ground

// The Ball view rides behind the ball, looking straight down the pitch through a long lens. It keeps the
// ball's height and distance, so the ball stays large enough to show its seam and spin, but only part of its
// sideways movement, so swing and turn show as the ball moving across the picture. Tuned by eye.
const FOLLOW = { back: 1.5, up: 0.2, across: 0.7, tilt: 5, fov: 20 };

/** Where each camera sits, how far it tilts down and its vertical field of view. */
function view(pov: Pov, d: Delivery, ball: Point) {
  const off = d.batter === 'right' ? 1 : -1;
  const hand = releasePoint(d);
  if (pov === 'ball') return { x: ball.x * FOLLOW.across, y: ball.y + FOLLOW.up, z: ball.z - FOLLOW.back, dir: 1, tilt: FOLLOW.tilt, fov: FOLLOW.fov };
  if (pov === 'bowler') return { x: hand.x, y: hand.y, z: -1.6, dir: 1, tilt: 3.8, fov: 17.4 }; // behind the arm
  if (pov === 'umpire') return { x: 0, y: 1.7, z: -3, dir: 1, tilt: 5.2, fov: 23.6 }; // 3 m behind the stumps
  return { x: -0.1 * off, y: 1.55, z: PITCH.batterCreaseZ, dir: -1, tilt: 12.7, fov: 42 }; // batter's eyes, on the crease
}

export default function Scene() {
  return (
    <>
      {/* Antialiasing is done by the finishing pass's own buffer, not the canvas. */}
      <Canvas shadows="percentage" frameloop="demand" dpr={[1, 2]} gl={{ antialias: false, toneMappingExposure: 1 }} camera={{ fov: 17.4, near: 0.3, far: 600 }}>
        <Rig />
        <World />
        <Flight />
        <Finish />
      </Canvas>
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_55%,rgb(0_0_0/0.45))]" />
    </>
  );
}

/**
 * Draws each frame through a finishing pass: bright things glow (the lit boards, the travelled path),
 * then the picture is given a film tone curve. Taking over the draw (priority 1) is how fiber is told to stand back.
 */
function Finish() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  const size = useThree((s) => s.size);
  const dpr = useThree((s) => s.viewport.dpr);
  const composer = useMemo(() => {
    const c = new EffectComposer(gl, new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 }));
    c.addPass(new RenderPass(scene, camera));
    c.addPass(new UnrealBloomPass(new THREE.Vector2(1, 1), 0.45, 0.5, 1));
    c.addPass(new OutputPass());
    return c;
  }, [gl, scene, camera]);
  useEffect(() => () => composer.dispose(), [composer]);
  useEffect(() => {
    composer.setPixelRatio(dpr);
    composer.setSize(size.width, size.height);
  }, [composer, size, dpr]);
  useFrame(() => composer.render(), 1);
  return null;
}

/** Runs the playback clock and moves the camera to the chosen point of view. */
function Rig() {
  const invalidate = useThree((s) => s.invalidate);
  const heading = useRef<Pov | null>(null); // the view the camera was heading for a frame ago
  const tmp = useMemo(
    () => ({
      eye: new THREE.Vector3(),
      was: new THREE.Vector3(), // where that view put the camera a frame ago
      gap: new THREE.Vector3(),
      look: new THREE.Vector3(),
      up: new THREE.Vector3(0, 1, 0),
      m: new THREE.Matrix4(),
      q: new THREE.Quaternion(),
    }),
    [],
  );

  // The canvas only draws when asked. Any change to the store asks.
  useEffect(() => useStore.subscribe(() => invalidate()), [invalidate]);

  useFrame(({ camera }, delta) => {
    const dt = Math.min(delta, 0.05); // the first frame after a pause reports a long gap
    if (useStore.getState().playing) useStore.getState().tick(dt);
    const s = useStore.getState(); // read after the tick, so a camera that follows the ball is not a frame behind it

    const v = view(s.pov, s.delivery, pointAt(s.result.points, s.progress * s.result.timeToStumpsS));
    const cam = camera as THREE.PerspectiveCamera;
    tmp.eye.set(v.x, v.y, v.z);
    tmp.look.set(v.x, v.y - Math.tan(v.tilt * DEG), v.z + v.dir);
    tmp.q.setFromRotationMatrix(tmp.m.lookAt(tmp.eye, tmp.look, tmp.up));

    // The camera closes the gap to its view a little each frame. The gap is measured from where the view
    // was a frame ago, so a view that moves with the ball is followed exactly once the camera has caught it.
    const first = heading.current === null;
    if (heading.current !== s.pov) tmp.was.copy(tmp.eye); // a change of view: the gap is the whole way there
    heading.current = s.pov;
    tmp.gap.subVectors(cam.position, tmp.was);
    tmp.was.copy(tmp.eye);

    const arrived = calm || first || (tmp.gap.lengthSq() < 1e-6 && cam.quaternion.angleTo(tmp.q) < 1e-3 && Math.abs(cam.fov - v.fov) < 0.02);
    const k = arrived ? 1 : 1 - Math.exp(-5 * dt);
    cam.position.copy(tmp.eye).addScaledVector(tmp.gap, 1 - k);
    cam.quaternion.slerp(tmp.q, k);
    cam.fov += (v.fov - cam.fov) * k;
    cam.updateProjectionMatrix();
    // 0 in the fixed views, 1 in the Ball view, easing between them with the camera. Flight sizes the ball by it.
    const closeUp: number = cam.userData.closeUp ?? 0;
    cam.userData.closeUp = closeUp + ((s.pov === 'ball' ? 1 : 0) - closeUp) * k;
    if (!arrived) invalidate();
  });
  return null;
}

/** The path, the bounce mark, and the ball with its shadow. */
function Flight() {
  const result = useStore((s) => s.result);
  const delivery = useStore((s) => s.delivery);
  const trail = useRef<ComponentRef<typeof Line>>(null);
  const ball = useRef<THREE.Mesh>(null);
  const shadow = useRef<THREE.Mesh>(null);
  const p = usePalette();
  // The ball in play: red, pink or white leather. A pale ball gets dark stitching, drawn so its seam shows.
  const hide = p[leather(delivery.ballType)];
  const stitch = delivery.ballType === 'pink' || delivery.ballType === 'white' ? '#2a2a2a' : p.crease;
  const skin = useMemo(
    () => ({ map: ballTexture({ ...LEATHER, leather: hide, join: new THREE.Color(hide).multiplyScalar(0.6).getStyle(), stitch }), bumpMap: ballTexture(RELIEF) }),
    [hide, stitch],
  );
  // The travelled path in the action colour, solid. At night a little brighter than its colour, so the bloom pass
  // gives it a thin glow; by day a glow would only muddy it.
  const trailColour = useMemo(() => new THREE.Color(p.action).multiplyScalar(p.dark ? 1.25 : 1), [p.action, p.dark]);
  const worn = delivery.ball === 'old'; // an old ball has lost its lacquer

  const path = useMemo(() => result.points.map((p): [number, number, number] => [p.x, p.y, p.z]), [result]);
  const track = useMemo(() => path.map(([x, , z]): [number, number, number] => [x, 0.009, z]), [path]);
  const orient = useMemo(() => seamOrientation(result, delivery), [result, delivery]);
  const venue = useStore((s) => s.venue);
  const scuff = useRef<THREE.Mesh>(null);
  const dust = useMemo(() => new Dust(), []);
  const heading = useMemo(() => {
    const i = result.points.findIndex((q) => q.t >= result.bounce.t);
    const a = result.points[Math.max(0, i - 1)];
    const b = result.points[Math.min(result.points.length - 1, i + 1)];
    return Math.atan2(b.x - a.x, b.z - a.z);
  }, [result]);

  useFrame(({ camera, size }) => {
    const { progress } = useStore.getState();
    const p = pointAt(result.points, progress * result.timeToStumpsS);

    // Big enough to see: a fixed enlargement, and a floor on its size on screen.
    // The Ball view needs neither: there the ball is drawn at true size, so it looks right beside the stumps.
    const cam = camera as THREE.PerspectiveCamera;
    const pxPerMetre = size.height / (2 * Math.tan((cam.fov * DEG) / 2)) / Math.max(0.5, cam.position.distanceTo(p as THREE.Vector3Like));
    const closeUp: number = cam.userData.closeUp ?? 0;
    const scale = Math.max(1 + (BALL_DRAW_SCALE - 1) * (1 - closeUp), BALL_MIN_PX / (R * pxPerMetre));

    if (ball.current) {
      ball.current.position.set(p.x, p.y + R * (scale - 1), p.z); // lifted so the drawn ball still touches down where the real one does
      ball.current.scale.setScalar(scale);
      orient(p.t, ball.current.quaternion);
    }
    if (shadow.current) {
      shadow.current.position.set(p.x, 0.012, p.z);
      shadow.current.scale.setScalar(scale);
    }
    if (trail.current) trail.current.geometry.instanceCount = Math.floor(progress * (path.length - 1));
    if (scuff.current) scuff.current.visible = p.t >= result.bounce.t;
    dust.update(p.t - result.bounce.t, result.bounce, heading, venue.dust);
  });

  return (
    <>
      <Line points={track} color="#2B2413" lineWidth={2} dashed dashSize={0.12} gapSize={0.24} transparent opacity={0.7} />
      <mesh rotation-x={FLAT} position={[result.bounce.x, 0.01, result.bounce.z]}>
        <ringGeometry args={[0.1, 0.13, 40]} />
        <meshBasicMaterial color={p.ring} />
      </mesh>
      {/* The path lines leave the depth buffer alone and the ball is drawn after them, so the stretch of
          path between a camera and the ball never crosses the ball's face. */}
      <Line points={path} color={p.action} lineWidth={1.5} transparent opacity={0.4} depthWrite={false} />
      <Line ref={trail} points={path} color={trailColour} lineWidth={3} transparent depthWrite={false} />
      {/* Where it pitched: a scuff on the clay, and a puff of dust that grows with how dry the pitch is. */}
      <mesh ref={scuff} rotation={[FLAT, 0, heading]} position={[result.bounce.x, 0.008, result.bounce.z + 0.04]} scale={[0.6, 1.6, 1]}>
        <circleGeometry args={[R * 1.1, 24]} />
        <meshBasicMaterial color="#000000" transparent opacity={0.28} depthWrite={false} />
      </mesh>
      <primitive object={dust.points} />
      <mesh ref={shadow} rotation-x={FLAT}>
        <circleGeometry args={[R * 1.1, 24]} />
        <meshBasicMaterial color="#0A0905" transparent opacity={0.45} depthWrite={false} />
      </mesh>
      <mesh ref={ball} renderOrder={1} castShadow>
        <sphereGeometry args={[R, 48, 32]} />
        <meshPhysicalMaterial {...skin} bumpScale={1.5} roughness={worn ? 0.8 : 0.42} clearcoat={worn ? 0 : 0.7} clearcoatRoughness={0.25} transparent />
      </mesh>
    </>
  );
}

/**
 * The dust a bounce throws up: grains thrown forward and up off the pitch, slowed by the air, settling and fading.
 * Driven by the time since the bounce, so it scrubs with the playback. Drawn only; tuned by eye.
 */
class Dust {
  static N = 90;
  private dirs = new Float32Array(Dust.N * 3);
  private pos = new Float32Array(Dust.N * 3);
  material = new THREE.PointsMaterial({ color: '#c8b287', size: 0.035, transparent: true, depthWrite: false, opacity: 0 });
  points: THREE.Points;
  constructor() {
    for (let i = 0; i < Dust.N; i++) {
      // Fixed pseudo-random spread, so the same delivery always throws the same dust.
      const r = (k: number) => (Math.sin(i * 12.9898 + k * 78.233) * 43758.5453) % 1;
      const a = r(1) * Math.PI; // mostly forward
      const sp = 1 + Math.abs(r(2)) * 2.5; // m/s
      this.dirs.set([Math.sin(a) * sp * 0.5, 0.4 + Math.abs(r(3)) * 1.1, Math.abs(Math.cos(a)) * sp], i * 3);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.points = new THREE.Points(g, this.material);
    this.points.frustumCulled = false;
  }
  update(dt: number, at: { x: number; z: number }, heading: number, amount: number) {
    const life = 0.9; // s
    this.points.visible = amount > 0.05 && dt > 0 && dt < life;
    if (!this.points.visible) return;
    const shown = Math.round(Dust.N * Math.min(1, amount));
    this.points.geometry.setDrawRange(0, shown);
    const drag = (1 - Math.exp(-dt * 4)) / 4; // distance travelled under air drag, per unit of starting speed
    const c = Math.cos(heading);
    const s = Math.sin(heading);
    for (let i = 0; i < shown; i++) {
      const [dx, dy, dz] = this.dirs.subarray(i * 3, i * 3 + 3);
      this.pos[i * 3] = at.x + (dx * c + dz * s) * drag;
      this.pos[i * 3 + 1] = Math.max(0.01, dy * drag - 1.2 * dt * dt);
      this.pos[i * 3 + 2] = at.z + (dz * c - dx * s) * drag;
    }
    this.points.geometry.attributes.position.needsUpdate = true;
    this.material.opacity = 0.75 * amount * (1 - dt / life) ** 1.5;
  }
}

/**
 * Returns a function that sets the ball's orientation at time t.
 * The seam is the sphere's equator, so its plane is square to the ball's own y axis.
 */
function seamOrientation(r: Result, d: Delivery) {
  const off = d.batter === 'right' ? 1 : -1;
  const w1 = new THREE.Vector3(...r.spin.release);
  const w2 = new THREE.Vector3(...r.spin.afterBounce);
  const spun = w1.length() > 1;
  const rate2 = w2.length();
  w2.normalize();

  // A spun ball's seam turns in its own plane, square to the spin axis.
  // An unspun ball's seam stands upright, turned by the seam angle (+ toward the slips).
  // A wobble seam's backspin axis misses the seam's own by WOBBLE_DEG, so the seam rocks either way once a turn.
  const wobble = !spun && d.wobble !== undefined;
  const seam = (wobble ? WOBBLE_DEG : d.seamAngleDeg) * DEG;
  const normal = new THREE.Vector3(Math.cos(seam), 0, -Math.sin(seam) * off); // the seam's own axis
  // It still turns, with backspin about the seam's own axis, so a steady seam holds its angle all the way down.
  const rate1 = spun ? w1.length() : SEAM_BACKSPIN;
  if (spun) w1.normalize();
  else if (wobble) w1.set(-1, 0, 0);
  else w1.copy(normal).negate();
  const start = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), spun ? w1 : normal);
  // The wobble's phase, chosen so the seam lands at the angle the physics gave it.
  const phase = wobble ? Math.acos(Math.max(-1, Math.min(1, Math.sin(d.wobble! * seam) / Math.sin(seam)))) - rate1 * r.bounce.t : 0;
  const atBounce = new THREE.Quaternion().setFromAxisAngle(w1, rate1 * r.bounce.t + phase).multiply(start);

  return (t: number, out: THREE.Quaternion) =>
    t <= r.bounce.t
      ? out.setFromAxisAngle(w1, rate1 * t + phase).multiply(start)
      : out.setFromAxisAngle(w2, rate2 * (t - r.bounce.t)).multiply(atBounce);
}

type Paint = { leather: string; join: string; stitch: string; stamp: string; grain: number };
const LEATHER: Paint = { leather: '', join: '', stitch: '', stamp: STAMP, grain: 0.07 }; // leather, join and stitch: per ball
// The same drawing in greys, read as height: the stitches stand proud, the join is a groove, the leather is grained.
const RELIEF: Paint = { leather: '#808080', join: '#505050', stitch: '#ffffff', stamp: '#767676', grain: 0.12 };

/** Paints the ball: its leather, a stitched seam round the equator, and a gold stamp so its spin can be seen. */
function ballTexture(c: Paint): THREE.CanvasTexture {
  const w = 1024;
  const h = 512;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const g = canvas.getContext('2d')!;
  g.fillStyle = c.leather;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 30000; i++) {
    g.fillStyle = `rgba(${i % 2 ? '255,255,255' : '0,0,0'},${c.grain})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }

  g.fillStyle = c.join;
  g.fillRect(0, h / 2 - 3, w, 6); // the join
  g.strokeStyle = c.stitch;
  g.lineWidth = 5;
  g.lineCap = 'round';
  for (const row of [-44, -28, -12, 12, 28, 44]) {
    for (let i = 0; i < 48; i++) {
      const x = (i + 0.5) * (w / 48);
      const lean = Math.sign(row) * 4;
      g.beginPath();
      g.moveTo(x - 6, h / 2 + row - lean);
      g.lineTo(x + 6, h / 2 + row + lean);
      g.stroke();
    }
  }

  g.strokeStyle = c.stamp;
  g.fillStyle = c.stamp;
  g.lineWidth = 5;
  for (const [x, y] of [
    [w * 0.25, h * 0.26],
    [w * 0.75, h * 0.74],
  ]) {
    g.strokeRect(x - 68, y - 36, 136, 72);
    g.fillRect(x - 44, y - 10, 88, 20);
  }

  const texture = new THREE.CanvasTexture(canvas);
  if (c.leather !== RELIEF.leather) texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}
