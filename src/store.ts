// App state: the delivery being simulated, its result, playback, and the captured grip photos.

import { create } from 'zustand';
import { delivery, grip, revs } from './physics/grips.ts';
import type { GripId, Level } from './physics/grips.ts';
import { simulate } from './physics/simulate.ts';
import { NEUTRAL, wear } from './physics/venues.ts';
import type { Conditions, Venue } from './physics/venues.ts';
import type { Delivery, Result } from './physics/simulate.ts';
import type { Classification, GripImage } from './vision/classify.ts';

export type Pov = 'bowler' | 'batter' | 'umpire' | 'ball';


interface State {
  gripId: GripId;
  delivery: Delivery;
  /** The spinner's level: it sets the revs of every spin grip picked (LEVELS in physics/grips.ts). */
  level: Level;
  /** Speeds are shown in these; the physics stays in kph. Kept in this browser. */
  units: 'kph' | 'mph';
  setUnits(units: 'kph' | 'mph'): void;
  result: Result;
  /** The ground, the day of the match and dew: they change the flight and the bounce. `venue` is the result. */
  ground: Venue;
  day: number;
  dew: number;
  venue: Conditions;
  pov: Pov;
  playing: boolean;
  /** Playback speed as a share of real time. Starts at a quarter (SPEC.md). */
  speed: number;
  /** Playback position: 0 at release, 1 at the batter's stumps. */
  progress: number;
  /** Photos from the capture screen, and what the matcher made of them. */
  photos: GripImage[];
  match: Classification | null;

  /** Loads a grip's preset, at the spinner's level, and replays. The bowler, batter, line and ball are kept. */
  pickGrip(id: GripId): void;
  setLevel(level: Level): void;
  /** Changes delivery settings and redraws the path without restarting playback. */
  change(patch: Partial<Delivery>): void;
  setConditions(patch: Partial<{ ground: Venue; day: number; dew: number }>): void;
  /** A team's own grounds, kept in this browser only. */
  myGrounds: Venue[];
  /** Adds or replaces one (by id) and switches to it. */
  saveGround(ground: Venue): void;
  deleteGround(id: string): void;
  setPov(pov: Pov): void;
  setSpeed(speed: number): void;
  play(): void;
  pause(): void;
  seek(progress: number): void;
  /** Advances playback by dt seconds of wall-clock time. */
  tick(dt: number): void;
  setPhotos(photos: GripImage[], match: Classification | null): void;
}

/** True when the user has asked their device for less motion: nothing then plays or glides unasked. */
export const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

const first = delivery('seam-up');

// A team's ground data is theirs: it stays in this browser's storage and is never sent anywhere.
const KEY = 'my-grounds';
function loadGrounds(): Venue[] {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}
function storeGrounds(grounds: Venue[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(grounds));
  } catch {
    // storage blocked or full: kept for this visit only
  }
}
function savedUnits(): 'kph' | 'mph' {
  try {
    return localStorage.getItem('speed-units') === 'mph' ? 'mph' : 'kph';
  } catch {
    return 'kph';
  }
}

export const useStore = create<State>((set, get) => ({
  gripId: 'seam-up',
  delivery: first,
  level: 'elite', // the presets' own revs
  units: savedUnits(),
  result: simulate(first),
  ground: NEUTRAL,
  day: 1,
  dew: 0,
  venue: wear(NEUTRAL, 1, 0),
  myGrounds: loadGrounds(),
  pov: 'ball',
  playing: false,
  speed: 0.25,
  progress: 1,
  photos: [],
  match: null,

  pickGrip(id) {
    const { arm, wicket, bowlerHeightM, batter, lineCm, ball, ballType } = get().delivery;
    const next = delivery(id, { arm, wicket, bowlerHeightM, batter, lineCm, ball, ballType, spinRpm: revs(id, get().level) });
    set({ gripId: id, delivery: next, result: simulate(next, undefined, get().venue), progress: calm ? 1 : 0, playing: !calm });
  },
  setLevel(level) {
    set({ level });
    if (grip(get().gripId).spinner) get().change({ spinRpm: revs(get().gripId, level) });
  },
  change(patch) {
    const next = { ...get().delivery, ...patch };
    set({ delivery: next, result: simulate(next, undefined, get().venue) });
  },
  setConditions(patch) {
    // A team's own ground brings its measured dew with it.
    if (patch.ground && patch.dew === undefined && patch.ground.dew !== undefined) patch = { ...patch, dew: patch.ground.dew };
    const s = { ...get(), ...patch };
    const venue = wear(s.ground, s.day, s.dew);
    set({ ...patch, venue, result: simulate(s.delivery, undefined, venue), progress: calm ? 1 : 0, playing: !calm });
  },
  saveGround(ground) {
    const myGrounds = [...get().myGrounds.filter((g) => g.id !== ground.id), ground];
    storeGrounds(myGrounds);
    set({ myGrounds });
    get().setConditions({ ground });
  },
  deleteGround(id) {
    const myGrounds = get().myGrounds.filter((g) => g.id !== id);
    storeGrounds(myGrounds);
    set({ myGrounds });
    if (get().ground.id === id) get().setConditions({ ground: NEUTRAL });
  },
  setUnits(units) {
    try {
      localStorage.setItem('speed-units', units);
    } catch {
      // storage blocked: kept for this visit only
    }
    set({ units });
  },
  setPov: (pov) => set({ pov }),
  setSpeed: (speed) => set({ speed }),
  play() {
    // A new ball from the start: a wobbling seam lands somewhere new.
    if (get().progress >= 1 && get().delivery.wobble !== undefined) get().change({ wobble: Math.random() * 2 - 1 });
    set((s) => ({ playing: true, progress: s.progress >= 1 ? 0 : s.progress }));
  },
  pause: () => set({ playing: false }),
  seek: (progress) => set({ progress, playing: false }),
  tick(dt) {
    const s = get();
    const progress = s.progress + (dt * s.speed) / s.result.timeToStumpsS;
    set(progress >= 1 ? { progress: 1, playing: false } : { progress });
  },
  setPhotos: (photos, match) => set({ photos, match }),
}));
