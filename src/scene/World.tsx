// The ground: outfield, square, pitch, creases, stumps, sightscreens and the stadium around them.
// A night match under floodlights in dark mode, a day match in light mode (colours from ./tokens.ts).
// Everything is generated here (painted canvases and simple shapes), so there are no asset files to load.
// The ground textures are painted in greys and tinted by the material colour, so one texture serves both modes.
// The four cameras never look more than about 8° above the horizon, so nothing above the upper tier is built.

import { useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { PITCH } from '../physics/constants.ts';
import { useStore } from '../store.ts';
import { usePalette } from './tokens.ts';
import type { Palette } from './tokens.ts';

const STUMP_R = 0.0175; // m (Law 8: stump diameter 3.49 to 3.81 cm)
const CREASE_W = 0.05; // m, painted line width
const FLAT = -Math.PI / 2; // rotation that lays a shape on the ground
const MID = PITCH.stumpsZ / 2; // the middle of the pitch, and of the ground
const BOUNDARY = 66; // m from the middle to the rope
const INNER_RING = 27.43; // m (30 yards), the fielding circle

/** A repeatable random number source, so the ground looks the same on every load. */
const rng = (seed: number) => () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32;

function paint(w: number, h: number, draw: (g: CanvasRenderingContext2D, rand: () => number) => void, repeat?: [number, number]) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d')!, rng(w + h));
  const t = new THREE.CanvasTexture(canvas);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 16;
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(...repeat);
  }
  return t;
}

/** One 6 m tile of mown grass: a 3 m chequerboard of mowing directions under a layer of blades. */
const grass = (tilesAcross: number) =>
  paint(
    1024,
    1024,
    (g, rand) => {
      for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
        g.fillStyle = (x + y) % 2 ? '#e8e8e8' : '#d6d6d6';
        g.fillRect(x * 512, y * 512, 512, 512);
      }
      for (let i = 0; i < 90000; i++) {
        const x = rand() * 1024;
        const y = rand() * 1024;
        g.strokeStyle = `hsla(0, 0%, ${55 + rand() * 45}%, 0.45)`;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + (rand() - 0.5) * 3, y + 3 + rand() * 5);
        g.stroke();
      }
    },
    [tilesAcross, tilesAcross],
  );

/** The pitch from end to end: rolled clay, dusty on a length, scuffed where the bowlers land, and cracked. */
const clay = () =>
  paint(512, 4096, (g, rand) => {
    g.scale(2, 2); // drawn on a 256 × 2048 grid
    g.fillStyle = '#e0e0e0';
    g.fillRect(0, 0, 256, 2048);
    for (let i = 0; i < 160000; i++) {
      g.fillStyle = `hsla(0, 0%, ${55 + rand() * 45}%, 0.25)`;
      g.fillRect(rand() * 256, rand() * 2048, 0.5 + rand(), 0.5 + rand() * 2);
    }
    const blot = (x: number, y: number, rx: number, ry: number, colour: string) => {
      const fade = g.createRadialGradient(0, 0, 0, 0, 0, 1);
      fade.addColorStop(0, colour);
      fade.addColorStop(1, 'transparent');
      g.save();
      g.translate(x, y);
      g.scale(rx, ry);
      g.fillStyle = fade;
      g.fillRect(-1, -1, 2, 2);
      g.restore();
    };
    const perM = 2048 / (PITCH.stumpsZ + 3); // the plane runs 1.5 m past each set of stumps
    for (const end of [1.5 * perM, 2048 - 1.5 * perM]) {
      const into = end < 1024 ? 1 : -1;
      blot(128, end + into * 5 * perM, 90, 3.5 * perM, 'rgba(255, 255, 255, 0.5)'); // dust on a length
      for (const side of [-1, 1]) {
        blot(128 + side * 62, end + into * 1.2 * perM, 26, 1.1 * perM, 'rgba(120, 112, 104, 0.6)'); // bowlers' footmarks
        blot(128 + side * 16, end + into * 1.3 * perM, 14, 0.5 * perM, 'rgba(132, 124, 116, 0.45)'); // batters' guard
      }
    }
    g.strokeStyle = 'rgba(80, 74, 68, 0.4)';
    for (let i = 0; i < 220; i++) {
      let x = rand() * 256;
      let y = rand() * 2048;
      g.lineWidth = 0.3 + rand() * 0.5;
      g.beginPath();
      g.moveTo(x, y);
      for (let step = 0; step < 4 + rand() * 8; step++) g.lineTo((x += (rand() - 0.5) * 7), (y += (rand() - 0.2) * 10));
      g.stroke();
    }
    for (const x of [0, 256]) blot(x, 1024, 22, 1100, 'rgba(150, 190, 130, 0.55)'); // grass creeping in at the edges
  });

/** A stretch of seating: rows of spectators, a few seats empty. */
const crowd = (seats: string) =>
  paint(
    256,
    128,
    (g, rand) => {
      g.scale(0.5, 0.5); // painted small, so from the middle the crowd is a soft speckle and not a grid of blocks
      g.fillStyle = seats;
      g.fillRect(0, 0, 512, 256);
      const shirts = ['#c9ccd1', '#6f737a', '#b8442f', '#d9b23c', '#2f7d4f', '#8a8f98', '#e8e4da', '#5a3f7a'];
      for (let row = 0; row < 30; row++) {
        for (let seat = 0; seat < 16; seat++) {
          if (rand() < 0.2) continue;
          const x = seat * 32 + 6 + rand() * 6;
          const y = row * 8.5 + 1;
          g.fillStyle = shirts[Math.floor(rand() * shirts.length)];
          g.fillRect(x, y + 2.5, 16, 4.5);
          g.fillStyle = `hsl(25, 35%, ${35 + rand() * 30}%)`;
          g.fillRect(x + 5, y, 6, 3);
        }
      }
    },
    [60, 1],
  );

/** The band of lit boxes between the tiers. */
const boxes = () =>
  paint(
    256,
    32,
    (g, rand) => {
      g.fillStyle = '#0a0d10';
      g.fillRect(0, 0, 256, 32);
      for (let i = 0; i < 8; i++) {
        g.fillStyle = `hsl(${38 + rand() * 12}, 70%, ${45 + rand() * 30}%)`;
        g.fillRect(i * 32 + 3, 8, 26, 16);
      }
    },
    [50, 1],
  );

/** The LED boards on the boundary. The names are made up. */
const boards = () =>
  paint(
    2048,
    64,
    (g) => {
      const panels: [string, string, string][] = [
        ['GRIP LAB', '#E9C46A', '#16130A'],
        ['SEAM UP', '#16181b', '#ffffff'],
        ['22 YARDS', '#f4eedd', '#153423'],
        ['LINE & LENGTH', '#b8242c', '#ffffff'],
        ['GRIP LAB', '#16130A', '#E9C46A'],
        ['OFF STUMP', '#1f7a4d', '#ffffff'],
        ['REVERSE SWING', '#f4eedd', '#b8242c'],
        ['THE CORRIDOR', '#3b3f46', '#ffffff'],
      ];
      g.font = '700 44px "Barlow Condensed", "Arial Narrow", sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      panels.forEach(([text, back, ink], i) => {
        g.fillStyle = back;
        g.fillRect(i * 256, 0, 256, 64);
        g.fillStyle = ink;
        g.fillText(text, i * 256 + 128, 34, 236);
      });
    },
    [-9, 1], // mirrored, because the boards are read from inside the ring
  );

/** The sky: darker overhead, lightest at the horizon (at night, the glow of the ground on the haze). */
const sky = (p: Palette) =>
  paint(2, 256, (g) => {
    const top = new THREE.Color(p.sky).multiplyScalar(p.dark ? 0.3 : 0.88).getStyle();
    const horizon = new THREE.Color(p.sky).lerp(new THREE.Color('#ffffff'), p.dark ? 0.06 : 0.35).getStyle();
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, top);
    grad.addColorStop(0.5, horizon);
    grad.addColorStop(1, horizon);
    g.fillStyle = grad;
    g.fillRect(0, 0, 2, 256);
  });

/** A ring round the ground, swept from a profile of [radius, height] points. */
const ring = (...profile: [number, number][]) => new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 128);

const shadowed = (light: THREE.DirectionalLight) => {
  light.castShadow = true;
  light.shadow.mapSize.set(1024, 4096);
  // A long strip laid along the pitch, which is the only place anything casts a shadow.
  light.shadow.camera = Object.assign(new THREE.OrthographicCamera(-4.5, 4.5, 13.5, -13.5, 30, 110), { up: new THREE.Vector3(0, 0, 1) });
  light.shadow.bias = -0.0003;
  light.shadow.radius = 2.5;
  light.target.position.set(0, 0, MID);
  return light;
};

/**
 * Night: four floodlight towers, one beyond each corner of the square, so everything on the pitch throws four shadows.
 * Day: one sun, high and off to the side, so the stumps throw a single crisp shadow across the pitch.
 */
function Lights({ dark }: { dark: boolean }) {
  const lights = useMemo(
    () =>
      dark
        ? [[1, 1], [1, -1], [-1, 1], [-1, -1]].map(([x, z]) => {
            const light = shadowed(new THREE.DirectionalLight('#f6f7fa', 0.95));
            light.position.set(x * 38, 27, MID + z * 38); // 27° above the horizon
            return light;
          })
        : [(() => {
            const sun = shadowed(new THREE.DirectionalLight('#fff8ec', 2.1));
            sun.position.set(-34, 62, MID - 22); // about 55° up, from behind square leg
            return sun;
          })()],
    [dark],
  );
  useEffect(() => () => lights.forEach((l) => l.dispose()), [lights]);
  return (
    <>
      <hemisphereLight args={dark ? ['#6a6e75', '#26331f', 0.55] : ['#f4f7fa', '#5b6f4a', 1.05]} />
      {lights.map((light, i) => (
        <group key={i}>
          <primitive object={light} />
          <primitive object={light.target} />
        </group>
      ))}
    </>
  );
}

function Stadium({ p }: { p: Palette }) {
  const tex = useMemo(() => ({ boxes: boxes(), boards: boards() }), []);
  const lit = useMemo(() => ({ crowd: crowd(p.stands), sky: sky(p) }), [p]);
  useEffect(() => () => Object.values(lit).forEach((t) => t.dispose()), [lit]);
  const geo = useMemo(
    () => ({
      wall: ring([71, 0], [71, 2.5]),
      lower: ring([71, 2.5], [93, 13.5]),
      boxes: ring([93, 13.5], [93, 16.5]),
      upper: ring([93, 16.5], [116, 34]),
    }),
    [],
  );
  return (
    <group position={[0, 0, MID]}>
      <mesh>
        <sphereGeometry args={[500, 32, 16]} />
        <meshBasicMaterial map={lit.sky} side={THREE.BackSide} fog={false} />
      </mesh>
      <mesh rotation-x={FLAT} position-y={-0.02}>
        <circleGeometry args={[400, 64]} />
        <meshStandardMaterial color={p.stands} />
      </mesh>
      <mesh rotation-x={FLAT} position-y={0.06}>
        <torusGeometry args={[BOUNDARY, 0.1, 8, 200]} />
        <meshStandardMaterial color="#f4f4f0" />
      </mesh>
      <mesh position-y={0.5}>
        <cylinderGeometry args={[68, 68, 1, 128, 1, true]} />
        <meshBasicMaterial map={tex.boards} side={THREE.BackSide} color={[0.85, 0.85, 0.85]} />
      </mesh>
      <mesh geometry={geo.wall}>
        <meshStandardMaterial color={p.stands} side={THREE.DoubleSide} />
      </mesh>
      {[geo.lower, geo.upper].map((g, i) => (
        <mesh key={i} geometry={g}>
          <meshStandardMaterial map={lit.crowd} color={p.dark ? '#7d7d7d' : '#ffffff'} side={THREE.DoubleSide} roughness={1} />
        </mesh>
      ))}
      <mesh geometry={geo.boxes}>
        <meshBasicMaterial map={tex.boxes} side={THREE.DoubleSide} color={p.dark ? '#ffffff' : '#8a8a8a'} />
      </mesh>
    </group>
  );
}

export default function World() {
  const p = usePalette();
  const v = useStore((s) => s.venue);
  // A green seamer's pitch keeps its grass; a dry turner is bare, bleached clay.
  const pitchColour = useMemo(
    () => new THREE.Color(p.pitch).multiplyScalar(1 + 0.08 * v.dust).lerp(new THREE.Color(p.grass).multiplyScalar(1.5), v.grass * 0.7),
    [p.pitch, p.grass, v],
  );
  const tex = useMemo(() => ({ outfield: grass((BOUNDARY + 6) / 3), square: grass(4), pitch: clay() }), []);

  const lines: [x: number, z: number, width: number, depth: number][] = [];
  for (const [stumps, popping, behind] of [
    [0, PITCH.bowlerCreaseZ, -1.22],
    [PITCH.stumpsZ, PITCH.batterCreaseZ, PITCH.stumpsZ + 1.22],
  ]) {
    lines.push([0, stumps, 2.64, CREASE_W]); // bowling crease (Law 7)
    lines.push([0, popping, 3.66, CREASE_W]); // popping crease, 1.83 m either side
    for (const x of [-1.32, 1.32]) lines.push([x, (popping + behind) / 2, CREASE_W, Math.abs(popping - behind)]); // return creases
  }

  // The fielding circle: a half circle round each wicket, joined by straight lines, marked with dots.
  const dots: [x: number, z: number][] = [];
  for (let i = 0; i <= 15; i++) {
    const a = (i / 15) * Math.PI;
    dots.push([INNER_RING * Math.cos(a), -INNER_RING * Math.sin(a)], [INNER_RING * Math.cos(a), PITCH.stumpsZ + INNER_RING * Math.sin(a)]);
  }
  for (const z of [5, 10, 15]) dots.push([INNER_RING, z], [-INNER_RING, z]);

  return (
    <>
      <fogExp2 attach="fog" args={[p.dark ? '#111316' : p.sky, p.dark ? 0.005 : 0.003]} />
      <Lights dark={p.dark} />
      <Stadium p={p} />
      <mesh rotation-x={FLAT} position={[0, 0, MID]} receiveShadow>
        <circleGeometry args={[BOUNDARY + 6, 96]} />
        <meshStandardMaterial map={tex.outfield} color={p.grass} roughness={v.dew ? 0.55 : 0.95} />
      </mesh>
      {/* The square: the closer-mown block the pitches are cut from. */}
      <mesh rotation-x={FLAT} position={[0, 0.002, MID]} receiveShadow>
        <planeGeometry args={[24, 27]} />
        <meshStandardMaterial map={tex.square} color={new THREE.Color(p.grass).multiplyScalar(1.25)} roughness={v.dew ? 0.5 : 0.9} />
      </mesh>
      <mesh rotation-x={FLAT} position={[0, 0.004, MID]} receiveShadow>
        <planeGeometry args={[PITCH.width, PITCH.stumpsZ + 3]} />
        <meshStandardMaterial map={tex.pitch} color={pitchColour} roughness={v.dew ? 0.6 : 0.85} />
      </mesh>
      {/* Cracks, where the physics has them (physics/venues.ts): the bounce changes for a ball that lands on one. */}
      {v.cracks.map((c, i) => (
        <mesh
          key={i}
          rotation={[FLAT, 0, Math.atan2(c.z1 - c.z2, c.x2 - c.x1)]}
          position={[(c.x1 + c.x2) / 2, 0.005, (c.z1 + c.z2) / 2]}
        >
          <planeGeometry args={[Math.hypot(c.x2 - c.x1, c.z2 - c.z1) + c.width, Math.max(0.004, c.width * 1.5)]} />
          <meshBasicMaterial color="#1c140a" transparent opacity={0.75} depthWrite={false} />
        </mesh>
      ))}
      {lines.map(([x, z, width, depth], i) => (
        <mesh key={i} rotation-x={FLAT} position={[x, 0.006, z]} receiveShadow>
          <planeGeometry args={[width, depth]} />
          <meshStandardMaterial color="#e9e4d4" roughness={0.9} />
        </mesh>
      ))}
      {dots.map(([x, z], i) => (
        <mesh key={i} rotation-x={FLAT} position={[x, 0.006, z]}>
          <circleGeometry args={[0.12, 12]} />
          <meshStandardMaterial color="#e9e4d4" />
        </mesh>
      ))}
      {/* White sightscreens just past the rope at each end, as in a real ground: big enough to sit behind the
          far stumps from the bowler's and batter's views without walling off the middle of the picture. */}
      {[MID - BOUNDARY - 1, MID + BOUNDARY + 1].map((z) => (
        <mesh key={z} position={[0, 3.5, z]}>
          <boxGeometry args={[16, 7, 0.2]} />
          {/* Unlit: the lights strike it edge-on and would turn it grey. Just under 1, so the bloom leaves it alone. */}
          <meshBasicMaterial color={p.dark ? '#a8a9a6' : '#ececea'} />
        </mesh>
      ))}
      {[0, PITCH.stumpsZ].map((z) => (
        <group key={z} position={[0, 0, z]}>
          {[-1, 0, 1].map((i) => (
            <mesh key={i} position={[i * (PITCH.wicketHalfWidth - STUMP_R), PITCH.stumpHeight / 2, 0]} castShadow>
              <cylinderGeometry args={[STUMP_R, STUMP_R, PITCH.stumpHeight, 16]} />
              <meshStandardMaterial color="#e6d3a1" roughness={0.4} />
            </mesh>
          ))}
          {[-1, 1].map((i) => (
            <mesh key={i} rotation-z={Math.PI / 2} position={[i * (PITCH.wicketHalfWidth - STUMP_R) * 0.5, PITCH.stumpHeight + 0.006, 0]} castShadow>
              <cylinderGeometry args={[0.008, 0.008, PITCH.wicketHalfWidth - STUMP_R + 0.012, 10]} />
              <meshStandardMaterial color="#e6d3a1" roughness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
    </>
  );
}
