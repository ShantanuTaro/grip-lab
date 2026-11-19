// The simulator: grip library, 3D view with playback and readouts, and the delivery controls.
// One layout from 1024 px up (three columns); below that, the phone layout from the design.

import { Component, Suspense, lazy, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { BALLS, PITCH, RELEASE, WOBBLE_DEG } from '../physics/constants.ts';
import type { BallType } from '../physics/constants.ts';
import { GRIPS, LENGTHS, LEVELS, LINES, SEAM_ANGLES, grip, lengthName, lineName, revs, spinDirection, turnAxis } from '../physics/grips.ts';
import { revsFor, seamFor, speedFor } from '../physics/match.ts';
import { pointAt, releasePoint, turnCm } from '../physics/simulate.ts';
import { FIELDS } from '../physics/measurements.ts';
import type { Field } from '../physics/measurements.ts';
import { VENUES, venue } from '../physics/venues.ts';
import { leather } from '../scene/tokens.ts';
import { source } from './GroundData.tsx';
import { Link } from '../router.tsx';
import { useStore } from '../store.ts';
import { Eyebrow, Segmented, Slider, card } from '../ui.tsx';

const Scene = lazy(() => import('../scene/Scene.tsx')); // three.js loads only when this screen is opened

const gripName = (id: string) => GRIPS.find((g) => g.id === id)!.name;
const BALL_TYPES = Object.keys(BALLS) as BallType[];

/** Different wording for wide and narrow screens. */
const fit = (wide: string, narrow: string) => (
  <>
    <span className="hidden lg:inline">{wide}</span>
    <span className="lg:hidden">{narrow}</span>
  </>
);

const MPH = 1.609344; // km in a mile

/** Speeds in the units picked in the Delivery panel; the physics stays in kph. */
function useSpeed() {
  const unit = useStore((s) => s.units);
  const n = (kph: number) => Math.round(unit === 'mph' ? kph / MPH : kph);
  return { n, unit, text: (kph: number) => `${n(kph)} ${unit}` };
}

export default function Simulator() {
  const sheet = useRef<HTMLDialogElement>(null);
  return (
    // From 1024 px the screen is exactly the window's height: the 3D view takes the spare height, and a column
    // scrolls inside itself only if the window is too short even at the smallest text size (index.css).
    <main className="mx-auto flex w-full max-w-xl flex-col gap-3 px-4 pt-3 pb-4 lg:grid lg:min-h-0 lg:max-w-none lg:flex-1 lg:grid-cols-[16.5rem_minmax(0,1fr)_18rem] lg:gap-5 lg:px-6 lg:pt-4 lg:pb-5 xl:grid-cols-[18rem_minmax(0,1fr)_19rem]">
      <section aria-label="Grip and ground" className="order-2 flex min-w-0 flex-col gap-4 lg:order-none lg:min-h-0 lg:gap-3 lg:overflow-y-auto">
        <PhotoCard />
        <GripLibrary />
        <div className={`${card} hidden flex-col gap-2.5 p-4 lg:flex`}>
          <Ground />
        </div>
      </section>

      <section aria-label="Delivery view" className="order-1 flex min-w-0 flex-col gap-3 lg:order-none lg:min-h-0">
        <PovBar />
        <Viewport />
        <Playback />
        <Tiles />
      </section>

      <section aria-label="Delivery settings" className={`${card} hidden flex-col gap-4 self-start p-4 lg:flex lg:max-h-full lg:overflow-y-auto`}>
        <Controls />
      </section>

      <section aria-label="Delivery settings" className={`${card} order-3 flex flex-col gap-1.5 px-3.5 pt-2.5 pb-3 lg:hidden`}>
        <QuickControls />
        <button
          type="button"
          onClick={() => sheet.current?.showModal()}
          className="mt-1 min-h-11 rounded-[10px] border border-edge bg-raised font-semibold text-soft"
        >
          All delivery controls
        </button>
        <p className="text-[13px] text-muted">A photo can’t measure speed or spin rate. Set them here.</p>
      </section>

      {/* The bottom sheet. Short enough that the 3D view stays visible above it while sliders move. */}
      <dialog
        ref={sheet}
        aria-label="Delivery controls"
        onClick={(e) => e.target === e.currentTarget && e.currentTarget.close()}
        className="m-0 mt-auto max-h-[50dvh] w-full max-w-none overflow-y-auto rounded-t-2xl border border-line bg-panel p-0 text-text backdrop:bg-transparent"
      >
        <div className="sticky top-0 z-10 flex justify-end bg-panel px-4 pt-3 pb-2">
          <button type="button" onClick={() => sheet.current?.close()} className="min-h-11 rounded-[10px] border border-edge bg-raised px-4 font-semibold text-soft">
            Done
          </button>
        </div>
        <div className="flex flex-col gap-4 px-4 pb-4">
          <Ground />
          <Controls />
          <p className="text-[13px] text-muted">A photo can’t measure speed or spin rate. Set them here; the grip sets the starting values.</p>
        </div>
      </dialog>
    </main>
  );
}

function PhotoCard() {
  const photos = useStore((s) => s.photos);
  const match = useStore((s) => s.match);
  const photo = photos.find((p) => p.view === 'seam') ?? photos[0];
  if (!photo) {
    return (
      <div className={`${card} hidden flex-col gap-2 p-4 lg:flex`}>
        <Eyebrow>Your grip</Eyebrow>
        <Link to="/capture" className="flex min-h-10 items-center justify-center rounded-[10px] border border-edge bg-raised font-semibold no-underline">
          Add a grip photo
        </Link>
      </div>
    );
  }
  return (
    <div className={`${card} hidden overflow-hidden lg:block`}>
      <img src={photo.dataUrl} alt="Your grip photo" className="block h-40 w-full object-cover" />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <Eyebrow>Closest matches</Eyebrow>
          <Link to="/capture" className="text-sm font-semibold">
            New photo
          </Link>
        </div>
        {match?.matches.length ? (
          <div className="flex flex-col gap-2.5">
            {match.matches.map((m, i) => (
              <div key={m.gripId} className="flex flex-col gap-1.5">
                <div className={`flex justify-between text-sm ${i ? 'text-muted' : ''}`}>
                  <span className={i ? '' : 'font-semibold'}>{gripName(m.gripId)}</span>
                  <span>{Math.round(m.confidence * 100)}%</span>
                </div>
                <div className="h-1.5 rounded-full bg-line">
                  <div className={`h-1.5 rounded-full ${i ? 'bg-edge' : 'bg-text'}`} style={{ width: `${m.confidence * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted">No match was made for this photo. The grip was chosen by hand.</p>
        )}
        {match?.engine === 'sample' && <p className="text-[13px] font-semibold text-text">Sample data, not a reading of your photo.</p>}
      </div>
    </div>
  );
}

function GripLibrary() {
  const gripId = useStore((s) => s.gripId);
  const pickGrip = useStore((s) => s.pickGrip);
  return (
    <div className="flex flex-col gap-3 lg:rounded-card lg:border lg:border-line lg:bg-panel lg:p-4">
      <Eyebrow className="hidden lg:block">Grip library</Eyebrow>
      {/* A scrolling row of chips on a phone, a two-column grid on a desktop. */}
      <div
        role="group"
        aria-label="Grip library"
        className="-mx-4 flex gap-2 overflow-x-auto px-4 py-1 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-2 lg:overflow-visible lg:p-0"
      >
        {GRIPS.map((g) => {
          const on = g.id === gripId;
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={on}
              onClick={() => pickGrip(g.id)}
              className={`min-h-11 flex-none rounded-full border px-3.5 font-semibold lg:flex lg:min-h-12 lg:flex-col lg:justify-center lg:rounded-[10px] lg:px-3 lg:py-1.5 lg:text-left lg:text-sm ${on ? 'border-sel bg-sel text-on-sel' : 'border-edge bg-raised text-text'}`}
            >
              {g.name}
              <span className={`hidden text-xs font-normal lg:block ${on ? 'text-sel-sub' : 'text-muted'}`}>{g.kind === 'pace' ? 'Pace' : 'Spin'}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function PovBar() {
  const pov = useStore((s) => s.pov);
  const setPov = useStore((s) => s.setPov);
  const gripId = useStore((s) => s.gripId);
  const arm = useStore((s) => s.delivery.arm);
  const wicket = useStore((s) => s.delivery.wicket ?? 'over');
  const batter = useStore((s) => s.delivery.batter);
  return (
    <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2.5">
      <Segmented
        label="Point of view"
        options={[['bowler', 'Bowler'], ['batter', 'Batter'], ['umpire', 'Umpire'], ['ball', 'Ball']]}
        value={pov}
        onChange={setPov}
        className="w-full bg-panel lg:w-auto lg:[&>button]:px-[18px]"
      />
      <div className="hidden text-sm text-muted lg:block">
        <span className="font-semibold text-text">{gripName(gripId)}</span> · {arm}-arm {wicket} · {batter}-hand batter
      </div>
    </div>
  );
}

/** Keeps the rest of the screen working if the 3D view cannot start. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <p className="grid h-full place-items-center p-6 text-center text-sm text-muted">The 3D view could not start in this browser (it needs WebGL). The numbers and the pitch map still work.</p>;
  }
}

function Viewport() {
  const pov = useStore((s) => s.pov);
  const gripId = useStore((s) => s.gripId);
  const speedKph = useStore((s) => s.delivery.speedKph);
  const lengthM = useStore((s) => s.delivery.lengthM);
  const speed = useStore((s) => s.speed);
  const { text } = useSpeed();
  const chip = 'absolute top-2.5 rounded-lg bg-bg/80 lg:top-3';
  return (
    <div className="relative aspect-[520/460] overflow-hidden rounded-card border border-line bg-bg lg:aspect-auto lg:min-h-48 lg:flex-1">
      <div role="img" aria-label={pov === 'ball' ? 'Ball flight, from a camera following just behind the ball' : `Ball flight from the ${pov}’s point of view`} className="size-full">
        <SceneBoundary>
          <Suspense fallback={<p className="grid h-full place-items-center text-sm text-muted">Loading the 3D view…</p>}>
            <Scene />
          </Suspense>
        </SceneBoundary>
      </div>
      <span className={`${chip} left-2.5 px-2.5 py-1 font-display text-base font-semibold tracking-[0.04em] uppercase lg:left-3 lg:text-lg`}>
        {fit(`${pov} view`, `${gripName(gripId)} · ${text(speedKph)}`)}
      </span>
      <span className={`${chip} right-3 hidden px-2.5 py-1.5 text-[0.8125rem] text-soft lg:block`}>{speed < 1 ? `${speed.toFixed(2)}× speed` : 'Real speed'} · {lengthName(lengthM, grip(gripId).kind)}</span>
      <PitchMap />
      <ConditionsStrip />
    </div>
  );
}

function Playback() {
  const id = useId();
  const playing = useStore((s) => s.playing);
  const progress = useStore((s) => s.progress);
  const total = useStore((s) => s.result.timeToStumpsS);
  const speed = useStore((s) => s.speed);
  const { play, pause, seek, setSpeed } = useStore.getState();
  const now = (progress * total).toFixed(2);
  return (
    <div className="flex items-center gap-3 lg:gap-4 lg:rounded-card lg:border lg:border-line lg:bg-panel lg:px-3.5 lg:py-2.5">
      <button
        type="button"
        onClick={playing ? pause : play}
        className="flex min-h-12 min-w-[104px] items-center justify-center gap-2 rounded-xl bg-action pr-4 pl-3 font-semibold text-on-action lg:min-h-11 lg:min-w-0 lg:rounded-[10px] lg:pr-[18px] lg:pl-3.5"
      >
        <svg viewBox="0 0 20 20" aria-hidden="true" className="size-[18px]" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          {playing ? <path d="M6 4v12M14 4v12" strokeWidth="2.5" /> : <path d="M6 4l10 6-10 6z" fill="currentColor" strokeWidth="1.5" />}
        </svg>
        {playing ? 'Pause' : 'Bowl it'}
      </button>
      <label htmlFor={id} className="sr-only">
        Position in delivery
      </label>
      <input
        id={id}
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={progress}
        aria-valuetext={`${now} of ${total.toFixed(2)} seconds`}
        onChange={(e) => seek(Number(e.target.value))}
        className="m-0 h-11 min-w-0 flex-1 lg:h-7"
      />
      <span className="hidden min-w-[6.5rem] text-right text-sm text-soft tabular-nums lg:block">
        {now} / {total.toFixed(2)} s
      </span>
      <label className="flex items-center gap-2 text-sm text-soft tabular-nums">
        <span className="sr-only">Playback speed</span>
        <input
          type="range"
          min={0.05}
          max={1}
          step={0.05}
          value={speed}
          aria-valuetext={`${speed.toFixed(2)} times real speed`}
          onChange={(e) => setSpeed(Number(e.target.value))}
          className="m-0 h-11 w-20 lg:h-7 lg:w-24"
        />
        <span className="min-w-[2.75rem]">{speed.toFixed(2)}×</span>
      </label>
    </div>
  );
}

function Tile({ label, value, unit, sub, className = '', words = false }: { label: ReactNode; value: ReactNode; unit?: string; sub: ReactNode; className?: string; words?: boolean }) {
  return (
    <div className={`rounded-xl border border-line bg-panel px-2.5 py-2 lg:px-3.5 lg:py-3 ${className}`}>
      <div className="text-[11px] font-semibold tracking-[0.06em] text-muted uppercase lg:text-xs lg:tracking-[0.08em]">{label}</div>
      <div className={`font-display leading-[1.15] font-semibold whitespace-nowrap ${words ? 'text-[23px] lg:text-[1.75rem] lg:leading-[1.4]' : 'text-[26px] lg:text-[2.125rem]'}`}>
        {value}
        {unit && <span className="text-[15px] text-muted lg:text-lg">{unit === '°' ? unit : ` ${unit}`}</span>}
      </div>
      <div className="text-xs text-muted lg:text-[0.8125rem]">{sub}</div>
    </div>
  );
}

function Tiles() {
  const r = useStore((s) => s.result);
  const d = useStore((s) => s.delivery);
  const kind = useStore((s) => grip(s.gripId).kind);
  const { n, unit } = useSpeed();
  // Signs: swing + is away from the batter, deviation + is into the batter (see physics/simulate.ts).
  const swing = Math.abs(r.swingCm) < 2 ? fit('Straight', 'Straight') : r.swingCm > 0 ? fit('Away from the batter', 'Away') : fit('Into the batter', 'In');
  const turn = Math.abs(r.deviationDeg) < 0.2 ? fit('Holds its line', 'Holds line') : r.deviationDeg > 0 ? fit('Into the batter', 'In') : fit('Away from the batter', 'Away');
  const verdict = {
    hitting: 'Hitting',
    'missing-off': 'Missing off',
    'missing-leg': 'Missing leg',
    'over-the-top': fit('Over the top', 'Over'),
  }[r.atStumps.verdict];
  return (
    <div className="grid grid-cols-3 gap-2 lg:grid-cols-[repeat(auto-fit,minmax(8.5rem,1fr))] lg:gap-2.5">
      <Tile className="hidden lg:block" label="Release speed" value={n(d.speedKph)} unit={unit} sub={lengthName(d.lengthM, kind)} />
      <Tile label={fit('Swing in air', 'Swing')} value={Math.round(Math.abs(r.swingCm))} unit="cm" sub={swing} />
      {/* How far it has moved off its line by the stumps, as a coach sees it; the angle is what TV quotes. */}
      <Tile label={fit('Off the pitch', 'Off pitch')} value={Math.round(Math.abs(turnCm(r)))} unit="cm" sub={<>{Math.abs(r.deviationDeg).toFixed(1)}° · {turn}</>} />
      <Tile className="hidden lg:block" label="Time to batter" value={r.timeToStumpsS.toFixed(2)} unit="s" sub="Release to stumps" />
      <Tile words className="border-2 border-action!" label={fit('At the batter', 'At batter')} value={verdict} sub={`${Math.round(r.atStumps.y * 100)} cm high`} />
    </div>
  );
}

/** The two controls a phone shows without opening the sheet. */
function QuickControls() {
  const d = useStore((s) => s.delivery);
  const kind = useStore((s) => grip(s.gripId).kind);
  const change = useStore((s) => s.change);
  const { text } = useSpeed();
  return (
    <>
      <Slider label="Release speed" display={text(d.speedKph)} value={d.speedKph} min={60} max={160} step={1} onChange={(speedKph) => change({ speedKph })} />
      <Slider label="Length" display={`${d.lengthM} m · ${lengthName(d.lengthM, kind)}`} value={d.lengthM} min={1} max={11} step={0.5} onChange={(lengthM) => change({ lengthM })} />
    </>
  );
}

const seg = 'bg-bg text-sm';
const box = 'h-10 min-w-0 rounded-lg border border-edge bg-bg px-2.5 text-sm text-text pointer-coarse:h-11';
const button = 'min-h-11 rounded-[10px] border border-edge bg-raised font-semibold disabled:opacity-50';

/** A folded helper under a setting: how to do it, its boxes, and what came of it. */
function Helper({ title, how, note, children }: { title: string; how: string; note?: string; children: ReactNode }) {
  return (
    <details>
      <summary className="cursor-pointer text-[13px] font-semibold text-soft">{title}</summary>
      <div className="mt-2 flex flex-col gap-2">
        <p className="text-[13px] text-muted">{how}</p>
        {children}
        <p role="status" className="text-[13px] text-text">
          {note}
        </p>
      </div>
    </details>
  );
}

/** One labelled box in a helper. */
function Box({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col justify-between gap-1 text-[13px] text-muted">
      {label}
      {children}
    </label>
  );
}

/** A video's frame rate. */
function Fps({ value, rates, onChange }: { value: number; rates: number[]; onChange(fps: number): void }) {
  return (
    <Box label="Frames a second">
      <select value={value} onChange={(e) => onChange(Number(e.target.value))} className={box}>
        {rates.map((f) => (
          <option key={f} value={f}>
            {f}
          </option>
        ))}
      </select>
    </Box>
  );
}

/** A box for a count or a measurement. */
const Count = ({ value, onChange }: { value: string; onChange(v: string): void }) => (
  <input type="number" inputMode="decimal" min={0} value={value} onChange={(e) => onChange(e.target.value)} className={box} />
);

/** A label, the setting in words or numbers on the right, and its controls under them. */
function Setting({ label, display, children }: { label: string; display?: ReactNode; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between gap-3 text-sm">
        <span className="text-muted">{label}</span>
        <span className="text-right font-semibold">{display}</span>
      </div>
      {children}
    </div>
  );
}

/**
 * The delivery in a coach's words: who bowls it, the seam or the revs, the length and the line. Each word stands for a
 * measured value (physics/grips.ts), shown beside it. The numbers themselves are under "Exact numbers".
 */
function Controls() {
  const d = useStore((s) => s.delivery);
  const kind = useStore((s) => grip(s.gripId).kind);
  const units = useStore((s) => s.units);
  const { change, setUnits } = useStore.getState();
  const { n, text } = useSpeed();
  const heightCm = Math.round((d.bowlerHeightM ?? RELEASE.height / RELEASE.perHeight) * 100);
  const seam = d.wobble !== undefined ? 'Wobbling' : d.seamAngleDeg > 2 ? `${d.seamAngleDeg}° to slips` : d.seamAngleDeg < -2 ? `${-d.seamAngleDeg}° to fine leg` : 'Upright';
  const spin = d.spinRpm > 50 ? `${d.spinRpm} rpm, turns in` : d.spinRpm < -50 ? `${-d.spinRpm} rpm, turns away` : 'None';
  const lengths = LENGTHS[kind];
  const ball = BALLS[d.ballType ?? 'kookaburra'];
  return (
    <>
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Delivery</Eyebrow>
        <Segmented label="Speeds in" options={[['kph', 'kph'], ['mph', 'mph']]} value={units} onChange={setUnits} className="text-xs [&>button]:px-2.5 lg:[&>button]:min-h-8" />
      </div>
      <Setting label="Bowler">
        <Segmented label="Bowling arm" options={[['right', 'Right arm'], ['left', 'Left arm']]} value={d.arm} onChange={(arm) => change({ arm })} className={seg} />
        <Segmented label="Side of the wicket" options={[['over', 'Over the wicket'], ['round', 'Round the wicket']]} value={d.wicket ?? 'over'} onChange={(wicket) => change({ wicket })} className={seg} />
      </Setting>
      <Slider label="Height" display={`${heightCm} cm · lets go at ${releasePoint(d).y.toFixed(2)} m`} value={heightCm} min={150} max={210} step={1} onChange={(cm) => change({ bowlerHeightM: cm / 100 })} />
      <Setting label="Batter">
        <Segmented label="Batter" options={[['right', 'Right-handed'], ['left', 'Left-handed']]} value={d.batter} onChange={(batter) => change({ batter })} className={seg} />
      </Setting>
      <div className="flex flex-col gap-1">
        <Slider label="Release speed" display={text(d.speedKph)} value={d.speedKph} min={60} max={160} step={1} onChange={(speedKph) => change({ speedKph })} />
        {/* Medians in the Hawk-Eye Test file (README, "Real tracking data"): fast seam 136 kph, medium seam 130; off-spin 86,
            left-arm orthodox 84, leg-spin 83. */}
        <p className="text-[13px] text-muted">
          {kind === 'pace' ? `Test fast bowlers average ${text(136)}, medium pacers ${n(130)}.` : `Test spinners average ${n(83)} to ${text(86)}.`}
        </p>
        <TimeIt />
      </div>
      {kind === 'pace' ? <Seam /> : <Revs />}
      <Setting label="Length" display={`${d.lengthM} m from the stumps`}>
        <Segmented
          label="Length"
          options={lengths.map(([name]) => [name, name] as const)}
          value={lengthName(d.lengthM, kind)}
          onChange={(name) => change({ lengthM: lengths.find(([n]) => n === name)![2] })}
          columns={kind === 'pace' ? 3 : 2}
          className={seg}
        />
      </Setting>
      <Setting label="Line" display={d.lineCm ? `${lineName(d.lineCm)} · ${Math.abs(d.lineCm)} cm from middle` : lineName(0)}>
        <Segmented
          label="Line"
          options={LINES.map(([name]) => [name, name] as const)}
          value={LINES.find(([, cm]) => lineName(cm) === lineName(d.lineCm))?.[0] ?? null}
          onChange={(name) => change({ lineCm: LINES.find(([n]) => n === name)![1] })}
          className={`${seg} [&>button]:px-1`}
        />
      </Setting>
      <Setting label="Ball">
        <Segmented
          label="Which ball"
          options={BALL_TYPES.map((t) => [t, BALLS[t].name] as const)}
          value={d.ballType ?? 'kookaburra'}
          onChange={(ballType) => change({ ballType })}
          columns={3}
          className={`${seg} text-[0.8125rem] [&>button]:px-0.5`}
        />
        <Segmented label="Ball condition" options={[['new', 'New ball'], ['old', 'Old ball']]} value={d.ball} onChange={(ball) => change({ ball })} className={seg} />
        <p className="text-[13px] text-muted">
          {ball.used}.{' '}
          {d.ball === 'new'
            ? `New, it swings the usual way up to about ${text(ball.reverseKph.new)}, then reverses.`
            : `Old, it reverses from about ${text(ball.reverseKph.old)}${ball.oldReverse === 1 ? '' : `, ${ball.oldReverse > 1 ? 'harder' : 'less'} than an old Dukes`}${ball.oldSeam < 1 ? ', and its flattened seam moves less off the pitch' : ''}.`}
        </p>
      </Setting>
      <details>
        <summary className="cursor-pointer text-sm font-semibold text-soft">Exact numbers</summary>
        <div className="mt-3 flex flex-col gap-4">
          <Slider label="Seam angle" display={seam} value={d.seamAngleDeg} min={-30} max={30} step={1} onChange={(seamAngleDeg) => change({ seamAngleDeg, wobble: undefined })} />
          <Slider label="Spin" display={spin} value={d.spinRpm} min={-3000} max={3000} step={10} onChange={(spinRpm) => change({ spinRpm })} />
          <Slider label="Length" display={`${d.lengthM} m · ${lengthName(d.lengthM, kind)}`} value={d.lengthM} min={1} max={11} step={0.5} onChange={(lengthM) => change({ lengthM })} />
          <Slider label="Line" display={`${d.lineCm} cm · ${lineName(d.lineCm)}`} value={d.lineCm} min={-50} max={50} step={0.5} onChange={(lineCm) => change({ lineCm })} />
        </div>
      </details>
    </>
  );
}

/** Seam grips: a steady seam, which way it points and how far, or a wobble seam; in words. */
function Seam() {
  const angle = useStore((s) => s.delivery.seamAngleDeg);
  const wobble = useStore((s) => s.delivery.wobble);
  const change = useStore((s) => s.change);
  const dir = angle > 2 ? 1 : angle < -2 ? -1 : 0; // rounded as the display rounds it
  const to = (deg: number) => (Math.abs(deg) > 2 ? `${Math.abs(deg)}° to ${deg > 0 ? 'slips' : 'fine leg'}` : 'upright');
  const display = wobble === undefined ? (dir ? to(angle) : 'Upright') : `Wobbling, landed ${to(Math.round(wobble * WOBBLE_DEG))}`;
  return (
    <Setting label="Seam" display={display}>
      <Segmented
        label="Seam in flight"
        options={[['steady', 'Steady seam'], ['wobble', 'Wobble seam']]}
        value={wobble === undefined ? 'steady' : 'wobble'}
        onChange={(v) => change({ wobble: v === 'wobble' ? Math.random() * 2 - 1 : undefined })}
        className={seg}
      />
      {wobble === undefined ? (
        <>
          <Segmented
            label="Seam points"
            options={[['-1', 'To fine leg'], ['0', 'Upright'], ['1', 'To slips']]}
            value={String(dir)}
            onChange={(v) => change({ seamAngleDeg: Number(v) * (dir ? Math.abs(angle) : 22) })}
            className={`${seg} [&>button]:px-1`}
          />
          {dir !== 0 && (
            <Segmented
              label="Seam angled"
              options={SEAM_ANGLES.map((a) => [a.id, a.name] as const)}
              value={SEAM_ANGLES.find((a) => a.deg === Math.abs(angle))?.id ?? null}
              onChange={(id) => change({ seamAngleDeg: dir * SEAM_ANGLES.find((a) => a.id === id)!.deg })}
              className={seg}
            />
          )}
        </>
      ) : (
        <p className="text-[13px] text-muted">
          The seam rocks either side of upright, so it doesn’t swing, and lands at random: each ball can seam either way or go straight on. Bowl it again for
          another.
        </p>
      )}
      <MatchSwing />
    </Setting>
  );
}

/** Seam grips: the steady seam angle that gives the swing a coach saw, at this speed, with this ball, here. */
function MatchSwing() {
  const [cm, setCm] = useState('');
  const [way, setWay] = useState('away');
  const [note, setNote] = useState('');
  const go = () => {
    const s = useStore.getState();
    const m = seamFor(s.delivery, s.venue, (way === 'away' ? 1 : -1) * Number(cm));
    if (m.value !== null) {
      s.change({ seamAngleDeg: Math.round(m.value * 10) / 10, wobble: undefined });
      return setNote('');
    }
    const most = Math.round(Math.max(-m.reach[0], m.reach[1]));
    setNote(most < 1 ? 'At this speed this ball doesn’t swing here. Try another ball or another speed.' : `At this speed, with this ball, it swings ${most} cm at most here.`);
  };
  return (
    <Helper title="Match a ball you saw" how="How far did it swing before it pitched? A bat is 11 cm wide." note={note}>
      <div className="grid grid-cols-2 gap-2">
        <Box label="Swing, cm">
          <Count value={cm} onChange={setCm} />
        </Box>
        <Box label="Which way">
          <select value={way} onChange={(e) => setWay(e.target.value)} className={box}>
            <option value="away">Away</option>
            <option value="in">In</option>
          </select>
        </Box>
      </div>
      <button type="button" disabled={!(Number(cm) >= 0) || cm === ''} onClick={go} className={button}>
        Set the seam to match
      </button>
    </Helper>
  );
}

/** Spin grips: the revs that give the turn a coach saw, at this speed, on this pitch. */
function MatchTurn() {
  const [cm, setCm] = useState('');
  const [note, setNote] = useState('');
  const go = () => {
    const s = useStore.getState();
    const m = revsFor(s.delivery, s.venue, Number(cm));
    if (m.value !== null) {
      s.change({ spinRpm: (Math.sign(s.delivery.spinRpm) || 1) * Math.round(m.value / 10) * 10 });
      return setNote('');
    }
    setNote(`At this speed it turns ${Math.round(m.reach[1])} cm at most on this pitch, at 3,000 rpm.`);
  };
  return (
    <Helper title="Match a ball you saw" how="How far had it turned off its line by the time it reached the stumps? A bat is 11 cm wide." note={note}>
      <Box label="Turn, cm">
        <Count value={cm} onChange={setCm} />
      </Box>
      <button type="button" disabled={!(Number(cm) >= 0) || cm === ''} onClick={go} className={button}>
        Set the revs to match
      </button>
    </Helper>
  );
}

/** The release speed from a video: frames from the hand to the far stumps, at this length. */
function TimeIt() {
  const [fps, setFps] = useState(240);
  const [frames, setFrames] = useState('');
  const [note, setNote] = useState('');
  const { text } = useSpeed();
  const go = () => {
    const s = useStore.getState();
    const seconds = Number(frames) / fps;
    const m = speedFor(s.delivery, s.venue, seconds);
    if (m.value !== null) {
      s.change({ speedKph: Math.round(m.value) });
      return setNote('');
    }
    setNote(`At this length that is ${seconds < m.reach[0] ? `faster than ${text(160)}` : `slower than ${text(60)}`}. Count again.`);
  };
  return (
    <Helper
      title="Time it on a video"
      how="Film the bowler from side-on or from behind, in the nets with nobody batting. Count the frames from the ball leaving the hand to it reaching the far stumps. Slow motion is more accurate; normal video works."
      note={note}
    >
      <div className="grid grid-cols-2 gap-2">
        <Fps value={fps} rates={[30, 60, 120, 240]} onChange={setFps} />
        <Box label="Frames to stumps">
          <Count value={frames} onChange={setFrames} />
        </Box>
      </div>
      <button type="button" disabled={!(Number(frames) > 0)} onClick={go} className={button}>
        Set the speed to match
      </button>
    </Helper>
  );
}

/** Spin grips: the revs from the spinner's level or counted on a video, and over-spin or side-spin. */
function Revs() {
  const d = useStore((s) => s.delivery);
  const gripId = useStore((s) => s.gripId);
  const chosen = useStore((s) => s.level);
  const { change, setLevel } = useStore.getState();
  const g = grip(gripId);
  const level = revs(gripId, chosen) === d.spinRpm ? chosen : null; // none lit for revs counted or set by hand
  // Turned 20° either way from the grip's measured axis (physics/grips.ts), about the spread between bowlers.
  const types = [
    ['over', 'Over-spin', turnAxis(g.spinAxis, -20)],
    ['usual', 'Usual', g.spinAxis],
    ['side', 'Side-spin', turnAxis(g.spinAxis, 20)],
  ] as const;
  const now = spinDirection(d.spinAxis ?? g.spinAxis);
  const type = types.find(([, , a]) => Math.abs(spinDirection(a) - now) < 0.5)?.[0] ?? null;
  return (
    <>
      <Setting label="Revs" display={`${Math.abs(d.spinRpm).toLocaleString()} rpm`}>
        <Segmented label="Spinner's level" options={LEVELS.map((l) => [l.id, l.name] as const)} value={level} onChange={setLevel} columns={2} className={seg} />
        <CountRevs onUse={(rpm) => change({ spinRpm: Math.sign(g.spinRpm) * rpm })} />
        <MatchTurn />
      </Setting>
      <Setting label="Spin">
        <Segmented
          label="Over-spin or side-spin"
          options={types.map(([id, name]) => [id, name] as const)}
          value={type}
          onChange={(id) => change({ spinAxis: types.find(([t]) => t === id)![2] })}
          className={`${seg} [&>button]:px-1`}
        />
        <p className="text-[13px] text-muted">More over-spin turns less and bounces higher. More side-spin drifts more and stays lower.</p>
      </Setting>
    </>
  );
}

/** Revs from a slow-motion video: the frame rate, and how many frames the ball takes to turn three times. */
function CountRevs({ onUse }: { onUse(rpm: number): void }) {
  const [fps, setFps] = useState(240);
  const [frames, setFrames] = useState('');
  const rpm = Number(frames) > 0 ? Math.round((fps * 60 * 3) / Number(frames) / 10) * 10 : 0;
  return (
    <Helper
      title="Count them on a slow-motion video"
      how="Draw a thick stripe on the ball and film the bowler side-on in slow motion. Step through the frames and count how many the ball takes to turn three times."
      note={rpm > 3000 ? 'That is over 3,000 rpm, more than the simulator takes. Count again.' : ''}
    >
      <div className="grid grid-cols-2 gap-2">
        <Fps value={fps} rates={[120, 240, 480, 960]} onChange={setFps} />
        <Box label="Frames for 3 turns">
          <Count value={frames} onChange={setFrames} />
        </Box>
      </div>
      {rpm > 0 && rpm <= 3000 && (
        <button type="button" onClick={() => onUse(rpm)} className={button}>
          Use {rpm.toLocaleString()} rpm
        </button>
      )}
    </Helper>
  );
}

/** The ground picker, the day and dew, and what they do to the ball. */
function Ground() {
  const v = useStore((s) => s.venue);
  const set = useStore((s) => s.setConditions);
  const crack = useStore((s) => s.result.crack);
  const mine = useStore((s) => s.myGrounds);
  const own = mine.find((g) => g.id === v.id);
  const id = useId();
  const wind = Math.hypot(...v.wind);
  // Each against a standard pitch; the ones that make no difference are left out.
  const facts = [
    ['Bounce', v.bounce],
    ['Turn', v.grip],
    ['Seam', v.seam],
    ['Swing', v.swing],
  ]
    .filter(([, x]) => Math.abs((x as number) - 1) >= 0.03)
    .map(([name, x]) => `${name} ${(x as number) > 1 ? '+' : '−'}${Math.round(Math.abs((x as number) - 1) * 100)}%`);
  if (wind > 0) facts.push(`Wind ${Math.round(wind * 3.6)} kph`);
  if (v.altitudeM > 300) facts.push(`${v.altitudeM.toLocaleString()} m up`);
  if (v.slopeDeg) facts.push(`Slope ${v.slopeDeg}°`);
  facts.push(`${v.tempC}°C`);
  const row = 'grid grid-cols-[2.5rem_minmax(0,1fr)] items-center gap-2';
  const seg = 'bg-bg text-sm lg:[&>button]:min-h-8 lg:[&>button]:px-1';
  return (
    <>
      <label htmlFor={id}>
        <Eyebrow>Ground</Eyebrow>
      </label>
      <select
        id={id}
        value={v.id}
        onChange={(e) => set({ ground: mine.find((g) => g.id === e.target.value) ?? venue(e.target.value) })}
        className="h-10 min-w-0 rounded-lg border border-edge bg-bg px-2.5 text-sm text-text pointer-coarse:h-11"
      >
        {mine.length > 0 && (
          <optgroup label="Your grounds">
            {mine.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </optgroup>
        )}
        <optgroup label="Famous grounds">
          {VENUES.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </optgroup>
      </select>
      <div className="flex items-baseline justify-between gap-2">
        <p className="min-w-0 text-[0.8125rem] text-soft">{v.note}</p>
        {own && (
          <Link to={`/grounds?edit=${own.id}`} className="flex-none text-[0.8125rem] font-semibold">
            Edit data
          </Link>
        )}
      </div>
      <div className={row}>
        <span className="text-sm text-muted">Day</span>
        <Segmented label="Day of the match" options={(['1', '2', '3', '4', '5'] as const).map((n) => [n, n] as const)} value={String(v.day) as '1'} onChange={(day) => set({ day: Number(day) })} className={seg} />
      </div>
      <div className={row}>
        <span className="text-sm text-muted">Ball</span>
        <Segmented label="Evening dew" options={[['dry', 'Dry'], ['dew', 'Dew on it']]} value={v.dew > 0 ? 'dew' : 'dry'} onChange={(w) => set({ dew: w === 'dew' ? 1 : 0 })} className={seg} />
      </div>
      <ul aria-label="Against a standard pitch" className="flex flex-wrap gap-1">
        {facts.map((f) => (
          <li key={f} className="rounded-full border border-line px-2 py-0.5 text-xs text-soft">
            {f}
          </li>
        ))}
      </ul>
      {v.cracks.length > 0 && (
        <p className="text-[0.8125rem] text-muted">
          {crack ? <strong className="text-text">Hit a crack: {crack === 'low' ? 'kept low' : 'kicked up'}.</strong> : `${v.cracks.length / 3} cracks. Aim at one on the pitch map.`}
        </p>
      )}
      <Link to="/grounds" className="mt-1 flex items-center gap-3 rounded-xl bg-sel px-3.5 py-2.5 text-on-sel no-underline">
        <svg viewBox="0 0 24 24" aria-hidden="true" className="size-5 flex-none" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
        <span className="flex flex-col">
          <span className="text-sm font-semibold">{mine.length ? 'Your grounds' : 'Use your own ground data'}</span>
          {!mine.length && <span className="text-xs text-sel-sub">Measurements, curator notes or tracking</span>}
        </span>
      </Link>
    </>
  );
}

const WIND_FROM = ['behind', 'the right', 'ahead', 'the left']; // as the bowler runs in
const num = (x: number) => String(+x.toFixed(1));
const vsStandard = (x: number) => `${x >= 1 ? '+' : '−'}${Math.round(Math.abs(x - 1) * 100)}%`;

/**
 * Over the 3D view, as TV coverage shows conditions: for one of the team's own grounds, the numbers it was built
 * from and what they do to the ball. Laptops and up; hidden with its own button.
 */
function ConditionsStrip() {
  const v = useStore((s) => s.venue);
  const own = useStore((s) => s.myGrounds.find((g) => g.id === s.venue.id));
  const [shown, setShown] = useState(true);
  if (!own?.data) return null;
  // Under the view's label, over the crowd: clear of the pitch, the ball and the pitch map.
  const chip = 'absolute top-14 left-3 hidden rounded-lg bg-bg/75 backdrop-blur-sm lg:flex';
  if (!shown) {
    return (
      <button type="button" onClick={() => setShown(true)} className={`${chip} px-3 py-1.5 text-[0.8125rem] font-semibold`}>
        Show conditions
      </button>
    );
  }
  const m = own.data.measurements as Partial<Record<Field, number>>;
  const rows = (Object.keys(FIELDS) as Field[])
    .filter((k) => m[k] !== undefined && k !== 'windFromDeg')
    .map((k) => {
      const f = FIELDS[k];
      const value = k === 'windKph' ? `${num(m[k]!)} kph${m.windFromDeg !== undefined ? ` from ${WIND_FROM[Math.round(m.windFromDeg / 90) % 4]}` : ''}` : `${num(m[k]!)}${f.unit === '°C' || f.unit === '%' ? '' : ' '}${f.unit}`;
      return [f.short, value] as const;
    });
  // What the simulation is using now, the day and dew included.
  const effects = (
    [
      ['Bounce', v.bounce],
      ['Grip', v.grip],
      ['Seam', v.seam],
      ['Swing', v.swing],
    ] as const
  )
    .filter(([, x]) => Math.abs(x - 1) >= 0.03)
    .map(([name, x]) => `${name} ${vsStandard(x)}`);
  if (v.day > 1) effects.push(`Day ${v.day}`);
  if (v.dew > 0) effects.push(`Dew ${Math.round(v.dew * 100)}%`);
  return (
    <section aria-label={`Conditions at ${own.name}`} className={`${chip} w-60 max-w-[34%] flex-col gap-1.5 px-3 py-2.5`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate font-display text-base leading-tight font-semibold tracking-[0.03em] uppercase">{own.name}</h3>
          <p className="text-[0.6875rem] text-muted">{source(own)}</p>
        </div>
        <button type="button" onClick={() => setShown(false)} aria-label="Hide conditions" className="-m-1 grid size-6 flex-none place-items-center rounded-md text-muted hover:text-text">
          <svg viewBox="0 0 16 16" aria-hidden="true" className="size-3" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
            <path d="M4 4l8 8M12 4l-8 8" />
          </svg>
        </button>
      </div>
      {rows.length > 0 && (
        <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 gap-y-px text-xs">
          {rows.slice(0, 9).map(([label, value]) => (
            <div key={label} className="contents">
              <dt className="text-muted">{label}</dt>
              <dd className="text-right font-semibold tabular-nums">{value}</dd>
            </div>
          ))}
        </dl>
      )}
      {effects.length > 0 && (
        <ul className="flex flex-wrap gap-x-2 border-t border-line pt-1.5 text-xs font-semibold text-soft">
          {effects.map((e) => (
            <li key={e}>{e}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

// Pitch map, looking down with the bowler at the bottom. +x is the bowler's left, so it is drawn on the left.
const mapX = (x: number) => 60 - x * 22;
const mapY = (z: number) => 216 - z * 10;

/** A small map over the corner of the 3D view, as TV coverage shows one: where it pitched, and the cracks. */
function PitchMap() {
  const r = useStore((s) => s.result);
  const d = useStore((s) => s.delivery);
  const kind = useStore((s) => grip(s.gripId).kind);
  const v = useStore((s) => s.venue);
  const path = useMemo(
    () =>
      r.points
        .filter((_, i) => i % 10 === 0 || i === r.points.length - 1)
        .map((p, i) => `${i ? 'L' : 'M'}${mapX(p.x).toFixed(1)} ${mapY(p.z).toFixed(1)}`)
        .join(' '),
    [r],
  );
  return (
    <svg
      viewBox="20 -8 80 232"
      role="img"
      aria-label={`Pitch map from above. ${lengthName(d.lengthM, kind)}, ${lineName(d.lineCm)}.`}
      className="absolute right-2.5 bottom-2.5 h-[42%] max-h-64 w-auto rounded-lg border border-line/60 bg-bg/70 p-1.5 lg:right-3 lg:bottom-3"
    >
      <rect x={mapX(PITCH.width / 2)} y={mapY(PITCH.stumpsZ) - 4} width={PITCH.width * 22} height={PITCH.stumpsZ * 10 + 8} rx="2" style={{ fill: `color-mix(in srgb, var(--pitch), var(--grass) ${Math.round(v.grass * 70)}%)` }} />
      {v.cracks.map((c, i) => (
        <line key={i} x1={mapX(c.x1)} y1={mapY(c.z1)} x2={mapX(c.x2)} y2={mapY(c.z2)} stroke="#000" strokeOpacity="0.45" strokeWidth={0.6 + c.width * 120} strokeLinecap="round" />
      ))}
      {[PITCH.bowlerCreaseZ, PITCH.batterCreaseZ].map((z) => (
        <line key={z} x1={mapX(PITCH.width / 2)} x2={mapX(-PITCH.width / 2)} y1={mapY(z)} y2={mapY(z)} className="stroke-crease" />
      ))}
      {[0, PITCH.stumpsZ].map((z) => (
        <line key={z} x1={mapX(0.16)} x2={mapX(-0.16)} y1={mapY(z)} y2={mapY(z)} className="stroke-stumps" strokeWidth="3" strokeLinecap="round" />
      ))}
      <path d={path} fill="none" className="stroke-action" strokeWidth="2" strokeLinecap="round" />
      <circle cx={mapX(r.bounce.x)} cy={mapY(r.bounce.z)} r="4" fill="none" className="stroke-ring" strokeWidth="1.5" />
      <MapBall />
    </svg>
  );
}

/** The moving dot, on its own so playback does not redraw the whole map 60 times a second. */
function MapBall() {
  const r = useStore((s) => s.result);
  const progress = useStore((s) => s.progress);
  const type = useStore((s) => s.delivery.ballType);
  const p = pointAt(r.points, progress * r.timeToStumpsS);
  return <circle cx={mapX(p.x)} cy={mapY(p.z)} r="3.2" className="stroke-crease" style={{ fill: `var(--${leather(type)})` }} />;
}
