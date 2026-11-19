// My grounds: a team's own pitches, built from their curator notes, measurements or tracked deliveries.
// The saved grounds across the top; the workspace for a new one, or the one being changed, below.

import { useState } from 'react';
import type { Venue } from '../physics/venues.ts';
import { navigate } from '../router.tsx';
import { useStore } from '../store.ts';
import { card } from '../ui.tsx';
import GroundForm, { chips, source } from './GroundData.tsx';

export default function Grounds() {
  const mine = useStore((s) => s.myGrounds);
  const current = useStore((s) => s.ground.id);
  const setConditions = useStore((s) => s.setConditions);
  const deleteGround = useStore((s) => s.deleteGround);
  // /grounds?edit=<id> opens that ground (the simulator's Edit link).
  const [editingId, setEditingId] = useState<string | null>(() => new URLSearchParams(location.search).get('edit'));
  const [formKey, setFormKey] = useState(0);
  const editing = mine.find((g) => g.id === editingId) ?? null;

  const bowl = (g: Venue) => {
    setConditions({ ground: g });
    navigate('/simulator');
  };
  const open = (id: string | null) => {
    setEditingId(id);
    setFormKey((k) => k + 1);
    history.replaceState(null, '', id ? `/grounds?edit=${id}` : '/grounds');
  };

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pt-6 pb-12 lg:px-6">
      <header className="flex flex-col gap-1.5">
        <h1 className="font-display text-4xl font-bold uppercase">My grounds</h1>
        <p className="max-w-3xl text-[1.0625rem] text-soft">
          Your pitch, your weather. Paste a curator’s report, enter your measurements or upload tracked deliveries, and every ball bounces, grips, seams and swings the way it does at your ground.
        </p>
      </header>

      <section aria-label="Saved grounds" className="grid gap-3 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
        <button
          type="button"
          onClick={() => open(null)}
          aria-pressed={!editing}
          className={`flex min-h-36 flex-col items-start justify-center gap-1 rounded-card border-2 border-dashed p-4 text-left ${!editing ? 'border-text bg-panel' : 'border-edge hover:border-text'}`}
        >
          <span className="text-2xl leading-none font-light">+</span>
          <span className="font-semibold">New ground</span>
          <span className="text-[0.8125rem] text-muted">Start from notes, numbers or tracking</span>
        </button>
        {mine.map((g) => {
          const on = g.id === editingId;
          return (
            <article key={g.id} className={`${card} flex min-h-36 flex-col gap-2 p-4 ${on ? 'border-text' : ''}`}>
              <div className="flex items-start gap-3">
                <span aria-hidden="true" className="mt-0.5 h-9 w-5 flex-none rounded" style={{ background: `color-mix(in srgb, var(--pitch), var(--grass) ${Math.round(g.grass * 70)}%)` }} />
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{g.name}</h2>
                  <p className="text-xs text-muted">
                    {source(g)}
                    {g.id === current && ' · in the simulator'}
                  </p>
                </div>
              </div>
              <p className="text-xs text-soft">{chips(g).join(' · ')}</p>
              <div className="mt-auto flex gap-2">
                <button type="button" onClick={() => bowl(g)} className="min-h-9 flex-1 rounded-lg bg-sel px-3 text-sm font-semibold text-on-sel">
                  Bowl on it
                </button>
                <button type="button" onClick={() => open(g.id)} disabled={on} className="min-h-9 rounded-lg border border-edge px-3 text-sm font-semibold disabled:opacity-50">
                  {on ? 'Editing' : 'Edit'}
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${g.name}`}
                  onClick={() => confirm(`Delete “${g.name}” from this browser?`) && (deleteGround(g.id), on && open(null))}
                  className="min-h-9 rounded-lg border border-edge px-2.5 text-muted"
                >
                  <svg viewBox="0 0 20 20" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
                    <path d="M4 6h12M8 6V4h4v2M6 6l1 10h6l1-10" />
                  </svg>
                </button>
              </div>
            </article>
          );
        })}
      </section>

      <GroundForm key={`${editing?.id ?? 'new'}-${formKey}`} editing={editing} onDone={(saved) => (saved ? bowl(saved) : open(null))} />
    </main>
  );
}
