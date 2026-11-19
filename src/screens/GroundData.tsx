// The ground form: a team enters what it knows about a pitch and the weather, pastes notes for the AI to read,
// or uploads tracked deliveries to fit. Everything becomes a ground in the Ground list.
// Precedence: tracked deliveries over measurements over the ground it starts from.

import { useId, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { readNotes } from '../ground/ai.ts';
import type { Reading } from '../ground/ai.ts';
import { DEMOS } from '../ground/demo.ts';
import { TEMPLATE, fitGround, readCsv } from '../ground/tracked.ts';
import type { Observation } from '../physics/fit.ts';
import { FIELDS, clean, fromMeasurements } from '../physics/measurements.ts';
import type { Field } from '../physics/measurements.ts';
import { VENUES, venue as famous } from '../physics/venues.ts';
import type { Venue } from '../physics/venues.ts';
import { useStore } from '../store.ts';
import { Eyebrow, Segmented, card } from '../ui.tsx';

const ENTRIES = Object.entries(FIELDS) as [Field, (typeof FIELDS)[Field]][];
const button = 'min-h-10 rounded-[10px] border px-4 font-semibold disabled:opacity-50';
const input = 'h-10 min-w-0 rounded-lg border border-edge bg-bg px-3 text-[0.9375rem] text-text tabular-nums';

/** A new ground (editing null) or changes to a saved one. `onDone` gets the saved ground, or nothing on cancel. */
export default function GroundForm({ editing, onDone }: { editing: Venue | null; onDone(saved?: Venue): void }) {
  const saveGround = useStore((s) => s.saveGround);
  const ids = { name: useId(), base: useId(), notes: useId(), file: useId() };
  const [name, setName] = useState(editing?.name ?? '');
  const [baseId, setBaseId] = useState(editing?.data?.base ?? 'neutral');
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.entries(editing?.data?.measurements ?? {}).map(([k, v]) => [k, String(v)])),
  );
  const [text, setText] = useState(editing?.data?.text ?? '');
  const [why, setWhy] = useState<Reading['why']>({});
  const [reading, setReading] = useState<'idle' | 'busy' | string>('idle');
  const [tracked, setTracked] = useState<{ file: string; rows: Observation[] } | null>(null);
  // An earlier fit is kept until a new file is fitted.
  const [fitted, setFitted] = useState<{ venue: Venue; notes: string[] } | null>(editing?.data?.fitNotes ? { venue: editing, notes: editing.data.fitNotes } : null);
  const [fileError, setFileError] = useState('');
  const [fitting, setFitting] = useState(false);
  const [tab, setTab] = useState<Tab>(editing ? 'measure' : 'notes');

  const base = famous(baseId);
  const measured = useMemo(() => fromMeasurements(base, clean(values)), [base, values]);
  // Tracking wins over measurements for the four pitch settings it fits.
  const result: Venue = fitted ? { ...measured.venue, ...pick(fitted.venue) } : measured.venue;
  const notes = [...measured.notes, ...(fitted?.notes ?? [])];

  async function read() {
    setReading('busy');
    try {
      const r = await readNotes(text);
      setValues((v) => ({ ...v, ...Object.fromEntries(Object.entries(r.values).map(([k, n]) => [k, String(n)])) }));
      setWhy((w) => ({ ...w, ...r.why }));
      if (r.name && !name) setName(r.name);
      setReading('idle');
      setTab('measure'); // show what it filled in, with its quotes
    } catch (e) {
      setReading((e as Error).message);
    }
  }

  async function load(file: File | undefined) {
    setFileError('');
    setTracked(null);
    if (!file) return;
    try {
      setTracked({ file: file.name, rows: readCsv(await file.text()) });
    } catch (e) {
      setFileError((e as Error).message);
    }
  }

  // A real ground's tracking, bowled in that ground's air: its file, its base ground and its name (unless one was typed).
  function tryDemo(d: (typeof DEMOS)[number]) {
    setFileError('');
    setTracked({ file: d.file, rows: readCsv(d.csv) });
    setBaseId(d.base);
    if (!name.trim() || DEMOS.some((x) => x.name === name)) setName(d.name);
  }

  function runFit() {
    if (!tracked) return;
    setFitting(true);
    // Let the button show "Fitting…" before the work blocks the page for a second or two.
    setTimeout(() => {
      try {
        setFitted(fitGround(measured.venue, tracked.rows));
      } catch (e) {
        setFileError((e as Error).message);
      }
      setFitting(false);
    }, 30);
  }

  function save() {
    const measurements = clean(values);
    const ground: Venue = {
      ...result,
      id: editing?.id ?? `my-${Date.now().toString(36)}`,
      name: name.trim() || 'My ground',
      note: 'From your data',
      data: {
        base: baseId,
        measurements,
        notes: measured.notes,
        text: text || undefined,
        tracked: fitted && tracked ? `${tracked.rows.length} tracked deliveries (${tracked.file})` : fitted ? editing?.data?.tracked : undefined,
        fitNotes: fitted?.notes,
      },
    };
    saveGround(ground);
    onDone(ground);
  }

  const template = `data:text/csv;charset=utf-8,${encodeURIComponent(TEMPLATE)}`;
  const measuredCount = Object.keys(clean(values)).length;
  const tabs: [Tab, string][] = [
    ['notes', `Paste notes${text.trim() ? ' ✓' : ''}`],
    ['measure', `Measurements${measuredCount ? ` · ${measuredCount}` : ''}`],
    ['track', `Tracking${fitted ? ' ✓' : ''}`],
  ];
  return (
    <form onSubmit={(e) => (e.preventDefault(), save())} className="flex flex-col gap-5 lg:grid lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-start">
      <div className="flex min-w-0 flex-col gap-4">
        <Segmented<Tab> label="How to add data" options={tabs} value={tab} onChange={(t) => setTab(t)} className="bg-panel [&>button]:min-h-10" />

        {tab === 'notes' && (
          <Panel title="Paste anything" text="A curator’s report, pitch notes, a forecast or a table from a spreadsheet. AI turns it into measurements and shows the words behind each number, so you can check them.">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[0.8125rem] text-muted">Try an example:</span>
              {EXAMPLES.map(([label, example]) => (
                <button key={label} type="button" onClick={() => setText(example)} aria-pressed={text === example} className={chip(text === example)}>
                  {label}
                </button>
              ))}
            </div>
            <label htmlFor={ids.notes} className="sr-only">
              Notes to read
            </label>
            <textarea id={ids.notes} value={text} onChange={(e) => setText(e.target.value)} rows={9} placeholder={PLACEHOLDER} className="rounded-xl border border-edge bg-bg p-3.5 text-[0.9375rem] leading-relaxed text-text" />
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={read} disabled={!__GROQ__ || !text.trim() || reading === 'busy'} className={`${button} border-sel bg-sel text-on-sel`}>
                {reading === 'busy' ? 'Reading…' : 'Read with AI'}
              </button>
              <span className="text-[0.8125rem] text-muted">{__GROQ__ ? 'Sends this text to Groq. Nothing else leaves this browser.' : 'Needs GROQ_API_KEY in .env.local (see README). You can still enter measurements yourself.'}</span>
            </div>
            {reading !== 'idle' && reading !== 'busy' && <p className="text-sm font-semibold">{reading}</p>}
          </Panel>
        )}

        {tab === 'measure' && (
          <Panel title="Measurements" text="Fill in what you have and leave the rest. Anything blank comes from the ground on the right. Typical values are under each box.">
            {(['Pitch', 'Weather'] as const).map((group) => (
              <fieldset key={group} className="flex flex-col gap-3">
                <legend className="mb-2">
                  <Eyebrow>{group}</Eyebrow>
                </legend>
                <div className="grid gap-x-4 gap-y-3.5 sm:grid-cols-2">
                  {ENTRIES.filter(([, f]) => f.group === group).map(([k]) => (
                    <FieldInput key={k} field={k} value={values[k] ?? ''} why={why[k]} onChange={(v) => setValues((s) => ({ ...s, [k]: v }))} />
                  ))}
                </div>
              </fieldset>
            ))}
          </Panel>
        )}

        {tab === 'track' && (
          <Panel title="Tracked deliveries" text="A CSV of balls bowled at this ground, from Hawk-Eye or similar: each delivery (speed, seam, spin, length, line, arm, batter, ball) and whatever was measured. The physics is fitted to them, and that beats every other setting. The file is read here and never uploaded.">
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[0.8125rem] text-muted">Try real Hawk-Eye data:</span>
                {DEMOS.map((d) => (
                  <button key={d.file} type="button" onClick={() => tryDemo(d)} aria-pressed={tracked?.file === d.file} className={chip(tracked?.file === d.file)}>
                    {d.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-muted">Seam bowlers in men’s Tests (ICC data). It has each ball’s speed, where it pitched and how high it passed the stumps, but not its seam or spin, so only the bounce can be fitted.</p>
            </div>
            <label htmlFor={ids.file} className="flex cursor-pointer flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-edge bg-bg px-4 py-8 text-center">
              <span className="font-semibold">{tracked ? tracked.file : 'Choose a CSV file'}</span>
              <span className="text-[0.8125rem] text-muted">{tracked ? `${tracked.rows.length} deliveries read` : 'One row per delivery'}</span>
              <input id={ids.file} type="file" accept=".csv,text/csv" onChange={(e) => load(e.target.files?.[0])} className="sr-only" />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={runFit} disabled={!tracked || fitting} className={`${button} border-sel bg-sel text-on-sel`}>
                {fitting ? 'Fitting…' : tracked ? `Fit to ${tracked.rows.length} deliveries` : 'Fit'}
              </button>
              <a href={template} download="tracked-deliveries-template.csv" className="text-sm font-semibold">
                Download the template
              </a>
            </div>
            {fileError && <p className="text-sm font-semibold">{fileError}</p>}
            {!tracked && fitted && editing?.data?.tracked && (
              <p className="text-[0.8125rem] text-muted">
                Fitted to {editing.data.tracked}. Choose a new file to refit, or{' '}
                <button type="button" onClick={() => setFitted(null)} className="font-semibold underline">
                  drop the fit
                </button>
                .
              </p>
            )}
          </Panel>
        )}
      </div>

      <Preview
        result={result}
        notes={notes}
        name={name}
        setName={setName}
        baseId={baseId}
        setBaseId={setBaseId}
        editing={editing}
        cancel={() => onDone()}
        ids={ids}
      />
    </form>
  );
}

type Tab = 'notes' | 'measure' | 'track';

// Made-up notes for trying the reader, one of each kind a team might paste.
const EXAMPLES: [label: string, text: string][] = [
  [
    'Green seamer, England',
    `Pitch report, day one, Riverside Ground.
Plenty of grass left on, about a quarter of an inch, and it's tinged green. Rebound tests on Tuesday averaged 61 cm; moisture readings around 21%.
Forecast: overcast all day, 59°F, humidity 88%. A 12 mph breeze blowing straight down the ground from behind the bowler at the Pavilion End.`,
  ],
  [
    'Dry turner, India',
    `Curator's notes, Test pitch, day three.
Very little grass, cover under 40% and shaved to about 2 mm. Bone dry: moisture down to 9%. Footmarks and rough already forming where the spinners land, roughly 25% of the surface damaged there. Clegg readings vary a lot from end to end, spread around 22%.
Hot and clear, 34°C, humidity 55%, evening temperature 27°C. Barely any wind.`,
  ],
  [
    'Highveld night game',
    `Venue sheet: day-night match, 1,750 m above sea level.
Hard, fast surface. Clegg hammer averaging 420 g, ball keeps about 92% of its speed off the pitch. Grass cover 85%, length 5 mm.
Weather: 24°C at the start falling to 13°C in the evening, dew point 12°C. Wind 20 kph from the bowler's right.`,
  ],
];

const PLACEHOLDER = `e.g.
Green top with 6 mm of grass left on. Rebound tests around 62 cm, moisture 19%.
Overcast, 16°C, humidity 85%, 20 kph breeze from fine leg.`;

function Panel({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <section className={`${card} flex flex-col gap-4 p-5`}>
      <div className="flex flex-col gap-1">
        <h2 className="font-display text-2xl font-semibold uppercase">{title}</h2>
        <p className="max-w-2xl text-sm text-muted">{text}</p>
      </div>
      {children}
    </section>
  );
}

/** The live result: what the simulator will do with this ground, and why. */
function Preview({ result, notes, name, setName, baseId, setBaseId, editing, cancel, ids }: {
  result: Venue;
  notes: string[];
  name: string;
  setName(v: string): void;
  baseId: string;
  setBaseId(v: string): void;
  editing: Venue | null;
  cancel(): void;
  ids: { name: string; base: string };
}) {
  const wind = Math.hypot(...result.wind);
  const air = [`${result.tempC}°C`, `${result.altitudeM.toLocaleString()} m up`, wind > 0 ? `Wind ${Math.round(wind * 3.6)} kph` : 'No wind', `Dew ${Math.round((result.dew ?? 0) * 100)}%`, ...(result.uneven ? [`Uneven bounce ${Math.round(result.uneven * 100)}%`] : [])];
  return (
    <aside aria-label="Result" className={`${card} flex flex-col gap-4 p-5 lg:sticky lg:top-4`}>
      <div className="flex flex-col gap-1">
        <label htmlFor={ids.name} className="sr-only">
          Ground name
        </label>
        <input id={ids.name} value={name} onChange={(e) => setName(e.target.value)} placeholder="Name this ground" className="min-w-0 border-b border-edge bg-transparent pb-1 font-display text-2xl font-semibold uppercase placeholder:text-muted focus:border-text focus:outline-none" />
        <label htmlFor={ids.base} className="mt-1 flex items-center gap-2 text-[0.8125rem] text-muted">
          <span className="flex-none">Blanks from</span>
          <select id={ids.base} value={baseId} onChange={(e) => setBaseId(e.target.value)} className="h-8 min-w-0 flex-1 rounded-lg border border-edge bg-bg px-2 text-[0.8125rem] text-text">
            {VENUES.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* The pitch as it will be drawn: greener with grass, paler when dry. */}
      <div aria-hidden="true" className="relative h-14 overflow-hidden rounded-lg" style={{ background: `color-mix(in srgb, var(--pitch), var(--grass) ${Math.round(result.grass * 70)}%)` }}>
        <div className="absolute inset-y-2 left-[12%] w-0.5 bg-crease/80" />
        <div className="absolute inset-y-2 right-[12%] w-0.5 bg-crease/80" />
        <div className="absolute inset-y-0 left-0 w-[4%] bg-grass" />
        <div className="absolute inset-y-0 right-0 w-[4%] bg-grass" />
      </div>

      <div className="flex flex-col gap-3">
        <Eyebrow>Against a standard pitch</Eyebrow>
        <Meter label="Bounce" value={result.bounce} />
        <Meter label="Grip and turn" value={result.grip} />
        <Meter label="Seam" value={result.seam} />
        <Meter label="Swing" value={result.swing} />
      </div>

      <ul aria-label="Air" className="flex flex-wrap gap-1">
        {air.map((c) => (
          <li key={c} className="rounded-full border border-line px-2 py-0.5 text-xs text-soft">
            {c}
          </li>
        ))}
      </ul>

      <details open={notes.length > 0 && notes.length <= 4} className="text-[0.8125rem] text-muted">
        <summary className="cursor-pointer font-semibold text-soft">{notes.length ? `Why · ${notes.length}` : 'Nothing entered yet'}</summary>
        {notes.length > 0 ? (
          <ul className="mt-1.5 flex list-disc flex-col gap-1 pl-4">
            {notes.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        ) : (
          <p className="mt-1.5">Every setting comes from the ground above until you add data.</p>
        )}
      </details>

      <div className="flex flex-col gap-2">
        <button type="submit" className="min-h-11 rounded-xl bg-sel font-semibold text-on-sel">
          Save and bowl on it
        </button>
        {editing && (
          <button type="button" onClick={cancel} className="text-sm font-semibold text-muted">
            Discard changes
          </button>
        )}
        <p className="text-center text-xs text-muted">Saved in this browser only.</p>
      </div>
    </aside>
  );
}

/** One setting against a standard pitch: a bar out from the middle, right for more, left for less. */
function Meter({ label, value }: { label: string; value: number }) {
  const d = Math.max(-0.5, Math.min(0.5, value - 1)); // shown from 50% to 150%
  return (
    <div className="flex flex-col gap-1">
      <div className="flex justify-between text-sm">
        <span className="text-soft">{label}</span>
        <span className="font-semibold tabular-nums">{Math.abs(value - 1) < 0.005 ? 'Standard' : pct(value)}</span>
      </div>
      <div className="relative h-1.5 rounded-full bg-line">
        <div className="absolute inset-y-[-3px] left-1/2 w-px bg-muted" />
        <div className="absolute inset-y-0 rounded-full bg-text" style={{ left: `${50 + Math.min(0, d) * 100}%`, width: `${Math.abs(d) * 100}%` }} />
      </div>
    </div>
  );
}

function FieldInput({ field, value, why, onChange }: { field: Field; value: string; why?: { quote: string; guess: boolean }; onChange(v: string): void }) {
  const id = useId();
  const f = FIELDS[field];
  const bad = value !== '' && clean({ [field]: value })[field] === undefined;
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-sm font-semibold text-soft">
        {f.label}
      </label>
      <div className="relative">
        <input id={id} type="number" inputMode="decimal" min={f.min} max={f.max} step="any" value={value} placeholder="—" onChange={(e) => onChange(e.target.value)} aria-invalid={bad} className={`${input} w-full pr-12 ${value !== '' && !bad ? 'border-text' : ''}`} />
        <span className="pointer-events-none absolute inset-y-0 right-3 grid place-items-center text-sm text-muted">{f.unit}</span>
      </div>
      {bad ? <span className="text-xs font-semibold">Must be from {f.min} to {f.max}; not used.</span> : f.hint && <span className="text-xs text-muted">{f.hint}</span>}
      {why && value !== '' && (
        <span className="text-xs text-muted">
          {why.guess ? <strong className="text-text">AI guess</strong> : 'AI read'}: “{why.quote || 'no quote given'}”
        </span>
      )}
    </div>
  );
}

const pct = (x: number) => `${x >= 1 ? '+' : '−'}${Math.round(Math.abs(x - 1) * 100)}%`;
const chip = (on: boolean) => `rounded-full border px-3 py-1 text-[0.8125rem] font-semibold ${on ? 'border-sel bg-sel text-on-sel' : 'border-edge hover:border-text'}`;

/** The settings in a few words, for a saved ground's card. */
export function chips(v: Venue): string[] {
  return [`Bounce ${pct(v.bounce)}`, `Grip ${pct(v.grip)}`, `Seam ${pct(v.seam)}`, `Swing ${pct(v.swing)}`];
}

/** What a saved ground was built from, in a few words. */
export function source(g: Venue): string {
  const n = Object.keys(g.data?.measurements ?? {}).length;
  const parts = [n && `${n} measurement${n > 1 ? 's' : ''}`, g.data?.tracked && 'tracking', g.data?.text && 'notes'].filter(Boolean);
  return parts.length ? `From ${parts.join(', ')}` : 'No data yet';
}

const pick = ({ bounce, grip, seam, swing }: Venue) => ({ bounce, grip, seam, swing });
