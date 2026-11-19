// The labelling tool: build our own set of grip photos, each with its confirmed grip, and export it as JSON.

import { useEffect, useState } from 'react';
import { GRIPS } from '../physics/grips.ts';
import type { GripId } from '../physics/grips.ts';
import { Eyebrow, card } from '../ui.tsx';
import { VIEWS, toDataUrl } from '../vision/classify.ts';
import type { View } from '../vision/classify.ts';
import { allPhotos, deletePhoto, exportJson, newPhoto, savePhoto } from '../vision/labels.ts';
import type { LabelledPhoto } from '../vision/labels.ts';

const field = 'min-h-11 w-full rounded-[10px] border border-edge bg-raised px-2.5 text-sm font-semibold text-text';

export default function Label() {
  const [photos, setPhotos] = useState<LabelledPhoto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const labelled = photos.filter((p) => p.gripId);

  // Every change goes to the browser's store first and is then read back, so the screen shows what was really saved.
  async function save(work: () => Promise<unknown>) {
    try {
      await work();
      setError(null);
    } catch {
      setError('This browser would not save the change. Private windows and full storage can cause that.');
    }
    setPhotos((await allPhotos().catch(() => [])).sort((a, b) => b.addedAt.localeCompare(a.addedAt)));
  }

  useEffect(() => {
    save(async () => {});
  }, []);

  const add = (files: File[]) =>
    save(async () => {
      for (const file of files) await savePhoto(newPhoto(await toDataUrl(file)));
    });

  function download() {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([exportJson(photos)], { type: 'application/json' }));
    link.download = `grip-labels-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  }

  return (
    <main className="mx-auto flex w-full max-w-[1320px] flex-col gap-5 px-4 pt-5 pb-10 lg:px-6 lg:pt-8">
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl leading-[1.05] font-bold tracking-[0.01em] uppercase lg:text-[44px]">Label grip photos</h1>
        <p className="max-w-[680px] text-muted">
          No public set of labelled grip photos exists, so this is where we build one. Add photos, say which grip each shows, and export the set. Photos stay in this browser until you export them.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="flex min-h-11 items-center rounded-[10px] bg-sel px-4 font-semibold text-on-sel has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-text">
          Add photos
          <input
            type="file"
            accept="image/*"
            multiple
            className="sr-only"
            onChange={(e) => {
              add([...(e.target.files ?? [])]); // copied first: clearing the input empties its own list
              e.target.value = '';
            }}
          />
        </label>
        <button type="button" onClick={download} disabled={labelled.length === 0} className="min-h-11 rounded-[10px] border border-edge px-4 font-semibold text-text disabled:border-line disabled:text-muted">
          Export {labelled.length} labelled as JSON
        </button>
        <span className="text-sm text-muted">
          {photos.length} photo{photos.length === 1 ? '' : 's'}, {photos.length - labelled.length} still to label
        </span>
      </div>
      <p role="alert" className="text-sm font-semibold text-text empty:hidden">
        {error}
      </p>

      <div className={`${card} flex flex-col gap-2.5 p-4`}>
        <Eyebrow>Labelled so far</Eyebrow>
        <ul className="flex flex-wrap gap-2 text-sm">
          {GRIPS.map((g) => {
            const n = labelled.filter((p) => p.gripId === g.id).length;
            return (
              <li key={g.id} className={`rounded-full border border-line px-3 py-1 ${n ? 'text-text' : 'text-muted'}`}>
                {g.name} <span className="font-semibold tabular-nums">{n}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {photos.length === 0 ? (
        <p className="text-muted">Nothing here yet. Photos you confirm on the capture screen land here too.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-[repeat(auto-fill,minmax(210px,1fr))]">
          {photos.map((photo, i) => (
            <li key={photo.id} className={`${card} flex flex-col overflow-hidden`}>
              <img src={photo.dataUrl} alt={`Photo ${i + 1}`} loading="lazy" className="block aspect-square w-full object-cover" />
              <div className="flex flex-col gap-2 p-2.5">
                <select
                  aria-label={`Grip shown in photo ${i + 1}`}
                  value={photo.gripId ?? ''}
                  onChange={(e) => save(() => savePhoto({ ...photo, gripId: (e.target.value || null) as GripId | null }))}
                  className={`${field} ${photo.gripId ? '' : 'border-text'}`}
                >
                  <option value="">Which grip?</option>
                  {GRIPS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <select
                  aria-label={`Angle of photo ${i + 1}`}
                  value={photo.view ?? ''}
                  onChange={(e) => save(() => savePhoto({ ...photo, view: (e.target.value || null) as View | null }))}
                  className={field}
                >
                  <option value="">Which angle?</option>
                  {VIEWS.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => confirm('Delete this photo from the training set?') && save(() => deletePhoto(photo.id))}
                  aria-label={`Delete photo ${i + 1}`}
                  className="min-h-11 rounded-[10px] text-sm font-semibold text-muted hover:text-text"
                >
                  Delete
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
