// Grip capture: add up to three photos, get a suggested match, confirm the grip, simulate it.
// The match is only ever a suggestion: nothing is simulated until the user has picked a grip.

import { useState } from 'react';
import { GRIPS } from '../physics/grips.ts';
import type { GripId } from '../physics/grips.ts';
import { navigate } from '../router.tsx';
import { useStore } from '../store.ts';
import { Eyebrow, card } from '../ui.tsx';
import { DEFAULT_ENGINE, ENGINES, VIEWS, classifyGrip, toDataUrl } from '../vision/classify.ts';
import type { Classification, Engine, GripImage, View } from '../vision/classify.ts';
import { newPhoto, savePhoto } from '../vision/labels.ts';
// The demo photos are the three in the project root. Which angle each one shows was judged by eye.
import seamPhoto from '../../photo1.jpeg';
import sidePhoto from '../../photo2.jpeg';
import releasePhoto from '../../photo3.jpeg';

const DEMO: Record<View, string> = { side: sidePhoto, seam: seamPhoto, release: releasePhoto };

const choice = 'flex min-h-[60px] items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-left';
const picked = 'border-sel bg-sel text-on-sel';
const unpicked = 'border-edge bg-raised text-text';

export default function Capture() {
  const store = useStore.getState();
  const [photos, setPhotos] = useState<GripImage[]>(store.photos);
  const [engine, setEngine] = useState<Engine>(DEFAULT_ENGINE);
  const [match, setMatch] = useState<Classification | null>(store.match);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState<GripId | null>(null);
  const [showLibrary, setShowLibrary] = useState(false);
  const [keep, setKeep] = useState(true);

  const step = photos.length === 0 ? 1 : confirmed ? 3 : 2;
  const about = ENGINES.find((e) => e.id === engine)!;

  async function setPhoto(view: View, file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      const dataUrl = await toDataUrl(file);
      setPhotos((old) => VIEWS.flatMap((v) => (v.id === view ? [{ view, dataUrl }] : old.filter((p) => p.view === v.id))));
      setMatch(null); // the old match was for different photos
      setConfirmed(null);
    } catch {
      setError('That file could not be read as a photo.');
    }
  }

  /** Fills all three slots with the demo photos, through the same shrink-and-encode step as an upload. */
  async function loadDemo() {
    setError(null);
    try {
      setPhotos(await Promise.all(VIEWS.map(async (v) => ({ view: v.id, dataUrl: await toDataUrl(await (await fetch(DEMO[v.id])).blob()) }))));
      setMatch(null);
      setConfirmed(null);
      setKeep(false); // or every run of the demo would add the same three photos to the training set
    } catch {
      setError('The demo photos could not be loaded.');
    }
  }

  function removePhoto(view: View) {
    setPhotos((old) => old.filter((p) => p.view !== view));
    setMatch(null);
    setConfirmed(null);
  }

  async function runMatch() {
    setBusy(true);
    setError(null);
    try {
      setMatch(await classifyGrip(photos, engine));
    } catch (e) {
      setMatch(null);
      setError(e instanceof Error ? e.message : 'The match failed.');
    } finally {
      setBusy(false);
    }
  }

  async function simulate() {
    if (!confirmed) return;
    if (keep) {
      // Best effort: a full or blocked browser store must not stop the simulation.
      await Promise.all(photos.map((p) => savePhoto(newPhoto(p.dataUrl, confirmed, p.view)))).catch(() => {});
    }
    useStore.getState().setPhotos(photos, match);
    useStore.getState().pickGrip(confirmed);
    navigate('/simulator');
  }

  return (
    <main className="mx-auto grid w-full max-w-[1320px] gap-5 px-4 pt-5 pb-10 lg:grid-cols-[minmax(0,1fr)_380px] lg:grid-rows-[auto_1fr] lg:items-start lg:gap-7 lg:px-6 lg:pt-8">
      <section aria-label="Photos" className="flex min-w-0 flex-col gap-5 lg:gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-[0.01em] uppercase lg:text-[44px]">Capture your grip</h1>
          <p className="max-w-[620px] text-muted">Hold the ball the way you would at release. Three angles give the best read of the seam and your fingers; one is enough to start.</p>
        </div>

        <ol className="flex flex-wrap gap-x-3 gap-y-2 text-sm font-semibold">
          {['Add photos', 'Confirm the grip', 'Simulate'].map((name, i) => {
            const state = i + 1 < step ? 'done' : i + 1 === step ? 'now' : 'next';
            return (
              <li
                key={name}
                aria-current={state === 'now' ? 'step' : undefined}
                className={`flex items-center gap-2 rounded-full py-2 pr-3.5 pl-2 ${state === 'now' ? 'bg-sel text-on-sel' : state === 'done' ? 'bg-raised text-soft' : 'border border-line bg-panel text-muted'}`}
              >
                <span className={`grid size-[26px] place-items-center rounded-full ${state === 'now' ? 'bg-on-sel text-sel' : state === 'done' ? 'bg-edge text-text' : 'bg-line text-soft'}`}>
                  {state === 'done' ? (
                    <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <title>Done</title>
                      <path d="M3 8.5l3.2 3L13 4.5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>
                {name}
              </li>
            );
          })}
        </ol>

        <div className="grid grid-cols-3 gap-2 sm:gap-3.5">
          {VIEWS.map((v) => {
            const photo = photos.find((p) => p.view === v.id);
            return (
              <figure
                key={v.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  setPhoto(v.id, e.dataTransfer.files[0]);
                }}
                className={`${card} flex flex-col overflow-hidden`}
              >
                {photo ? (
                  <img src={photo.dataUrl} alt={`Grip photo: ${v.name.toLowerCase()}`} className="block aspect-[3/4] w-full object-cover sm:aspect-auto sm:h-[250px]" />
                ) : (
                  <div className="grid aspect-[3/4] w-full place-items-center border-b border-dashed border-edge px-2 text-center text-[13px] text-muted sm:aspect-auto sm:h-[250px]">
                    <span>
                      <span className="hidden sm:inline">Drop a photo here, or </span>use the button below
                    </span>
                  </div>
                )}
                <figcaption className="flex flex-1 flex-col gap-1.5 p-2 sm:p-3.5">
                  <span className="text-sm font-semibold sm:text-[15px]">{v.name}</span>
                  <span className="hidden text-[13px] text-muted sm:block">{v.hint}</span>
                  {/* On a phone the system sheet for this input offers the camera as well as the photo library. */}
                  <label className="mt-auto flex min-h-11 items-center justify-center rounded-[10px] border border-edge bg-raised px-2 text-center text-sm font-semibold text-soft has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-text">
                    {photo ? 'Replace' : 'Add photo'}
                    <input
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      aria-label={`${photo ? 'Replace' : 'Add'} the ${v.name.toLowerCase()} photo`}
                      onChange={(e) => {
                        setPhoto(v.id, e.target.files?.[0]);
                        e.target.value = ''; // so the same file can be chosen again
                      }}
                    />
                  </label>
                  {photo && (
                    <button type="button" onClick={() => removePhoto(v.id)} aria-label={`Remove the ${v.name.toLowerCase()} photo`} className="min-h-11 rounded-[10px] text-sm font-semibold text-muted hover:text-text">
                      Remove
                    </button>
                  )}
                </figcaption>
              </figure>
            );
          })}
        </div>
        {photos.length === 0 && (
          <button type="button" onClick={loadDemo} className="min-h-11 self-start rounded-[10px] border border-edge bg-raised px-4 font-semibold text-soft">
            Use the demo photos
          </button>
        )}
      </section>

      <section aria-label="Grip match" className={`${card} flex min-w-0 flex-col gap-5 p-4 lg:row-span-2 lg:p-5`}>
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between gap-3">
            <Eyebrow>What the photos show</Eyebrow>
            {match?.engine === 'sample' && <span className="rounded-full bg-sel px-2.5 py-0.5 text-xs font-semibold text-on-sel">Sample data</span>}
          </div>
          {match ? (
            <>
              <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
                {(['seam', 'fingers', 'thumb', 'hand'] as const).map((key) => (
                  <div key={key} className="contents">
                    <dt className="text-muted capitalize">{key}</dt>
                    <dd className="font-semibold">{match.features[key]}</dd>
                  </div>
                ))}
              </dl>
              {match.note && <p className="text-[13px] text-muted">{match.note}</p>}
            </>
          ) : (
            <p className="text-sm text-muted">{photos.length ? 'Not read yet.' : 'Add a photo to begin.'}</p>
          )}

          <label className="mt-1 flex flex-col gap-1.5 text-sm text-muted">
            Read the photos with
            <select value={engine} onChange={(e) => setEngine(e.target.value as Engine)} className="min-h-11 rounded-[10px] border border-edge bg-raised px-3 font-semibold text-text">
              {ENGINES.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </label>
          <p className="text-[13px] text-muted">{about.about}</p>
          <button type="button" onClick={runMatch} disabled={busy || photos.length === 0} className="min-h-11 rounded-[10px] border border-edge font-semibold text-text disabled:border-line disabled:text-muted">
            {busy ? 'Reading the photos…' : match ? 'Read them again' : 'Find the closest grips'}
          </button>
          <p role="alert" className="text-sm font-semibold text-text empty:hidden">
            {error}
          </p>
        </div>

        {photos.length > 0 && (
          <div className="flex flex-col gap-2.5">
            <Eyebrow>Which grip is this?</Eyebrow>
            <div role="group" aria-label="Grip match" className="flex flex-col gap-2">
              {match?.matches.map((m) => {
                const grip = GRIPS.find((g) => g.id === m.gripId)!;
                const on = confirmed === m.gripId;
                return (
                  <button key={m.gripId} type="button" aria-pressed={on} onClick={() => setConfirmed(m.gripId)} className={`${choice} ${on ? picked : unpicked}`}>
                    <span className="flex flex-col">
                      <span className="font-semibold">{grip.name}</span>
                      <span className={`text-[13px] ${on ? 'text-sel-sub' : 'text-muted'}`}>{grip.blurb}</span>
                    </span>
                    <span className={`font-display text-[26px] font-semibold ${on ? '' : 'text-soft'}`}>{Math.round(m.confidence * 100)}%</span>
                  </button>
                );
              })}
              <button
                type="button"
                aria-expanded={showLibrary}
                onClick={() => setShowLibrary(!showLibrary)}
                className="min-h-12 rounded-xl border border-dashed border-edge px-3.5 text-left font-semibold text-soft"
              >
                {match?.matches.length ? 'None of these, choose from the library' : 'Choose from the library'}
              </button>
              {showLibrary && (
                <div className="grid grid-cols-2 gap-2">
                  {GRIPS.map((g) => (
                    <button key={g.id} type="button" aria-pressed={confirmed === g.id} onClick={() => setConfirmed(g.id)} className={`min-h-11 rounded-[10px] border px-3 text-left text-sm font-semibold ${confirmed === g.id ? picked : unpicked}`}>
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <p className="text-[13px] text-muted">The match is a suggestion from a still photo. Confirm it or change it before you simulate.</p>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <label className="flex min-h-11 items-center gap-2.5 text-sm text-soft">
            <input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} className="size-5 flex-none accent-text" />
            Keep these photos with the confirmed grip on this device, to build the training set
          </label>
          <button type="button" onClick={simulate} disabled={!confirmed} className="flex min-h-[52px] items-center justify-center gap-2 rounded-xl bg-sel text-base font-semibold text-on-sel disabled:bg-line disabled:text-muted">
            {confirmed ? `Simulate ${GRIPS.find((g) => g.id === confirmed)!.name}` : 'Simulate this grip'}
            <svg viewBox="0 0 20 20" aria-hidden="true" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 10h12M11 5l5 5-5 5" />
            </svg>
          </button>
          {!confirmed && <p className="text-[13px] text-muted">{photos.length ? 'Pick the grip above first.' : 'Or go straight to the simulator and pick a grip from its library.'}</p>}
        </div>
      </section>

      <section aria-label="Tips" className={`${card} flex flex-col gap-2.5 px-4 py-4 lg:px-[18px]`}>
        <Eyebrow>For a clean read</Eyebrow>
        <ul className="grid gap-x-6 gap-y-2 text-soft sm:grid-cols-2">
          <li>Keep the whole seam line in view</li>
          <li>Show every finger that touches the ball</li>
          <li>Use a plain background and daylight</li>
          <li>Shoot from about an arm’s length away</li>
        </ul>
      </section>
    </main>
  );
}
