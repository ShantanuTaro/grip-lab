// Grip matching with a vision model on Groq. Works in the browser (through the dev server's
// /api/groq proxy, which holds the key) and in Node (scripts/eval-grips.ts, with the key passed in).

import { GRIPS } from '../physics/grips.ts';
import type { GripId } from '../physics/grips.ts';
import type { Classification, GripMatch, View } from './classify.ts';

/** The one model on Groq's free tier that accepts images (checked 2026-11-11). Three images at most. */
export const GROQ_MODEL = 'qwen/qwen3.8-27b';

const VIEW_NAMES = { side: 'side on', seam: 'looking straight at the seam', release: 'at the release position' };

const PROMPT = `You read cricket bowling grips from photos of a hand holding a cricket ball. You get one to three photos of the same grip, each named by its angle.

First describe only what is visible, in a few plain words each:
- seam: how the seam sits against the first two fingers: along them and upright, along them and angled (say whether its far end leans to the thumb side or the little-finger side), or across them. Say "Not visible" if you cannot see it.
- fingers: which fingers are on the ball, whether the first two are together or spread, and whether they lie on, beside or across the seam.
- thumb: where the thumb sits.
- hand: Right, Left or Not clear.

Then rank the three grips that fit best, most likely first:
- seam-up: first two fingers close together on top, one either side of an upright seam; thumb underneath on the seam.
- outswinger: as seam-up, but the seam is angled toward the slips: its far end leans to the thumb side of a right hand (the little-finger side of a left hand).
- inswinger: as seam-up, but the seam is angled toward fine leg: its far end leans to the little-finger side of a right hand (the thumb side of a left hand).
- off-cutter: a pace grip with the index finger on the seam and the middle finger spread off to one side of it.
- leg-cutter: a pace grip with the middle finger on the seam and the index finger spread off to one side of it.
- off-break: finger spin. The seam runs across the fingers; index and middle fingers spread wide over the seam with their top joints gripping it; the ball rests on the third finger and thumb.
- leg-break: wrist spin. The seam runs across the fingers; the first two fingers lie across the seam on top and the third finger is bent along the seam; the thumb is light on the ball or off it.
- googly: the leg-break grip with the wrist turned further, so the back of the hand faces the batter at release. Choose it over leg-break only when a release photo shows that.

Give each a confidence from 0 to 1; the three add up to at most 1. A still photo often cannot separate similar grips. When it cannot, spread the confidence instead of guessing.

Reply with JSON only: {"seam": "...", "fingers": "...", "thumb": "...", "hand": "Right|Left|Not clear", "matches": [{"grip": "seam-up", "confidence": 0.5}]}`;

/** Thrown when the free tier's limit is hit. */
export class RateLimited extends Error {
  retryAfterS: number;
  constructor(retryAfterS: number) {
    super(`The free Groq tier is at its limit. Try again in ${Math.ceil(retryAfterS)} s.`);
    this.retryAfterS = retryAfterS;
  }
}

interface Options {
  /** Defaults to the dev server's proxy. */
  url?: string;
  /** Only for Node. In the browser the proxy adds the key. */
  apiKey?: string;
}

export async function classifyWithGroq(images: { view: View | null; dataUrl: string }[], { url = '/api/groq/chat/completions', apiKey }: Options = {}): Promise<Classification> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}) },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.2,
      max_completion_tokens: 400,
      reasoning_effort: 'none', // keeps the reply fast; the free tier's limit is on input tokens (7,000 a minute, 2,048 per photo)
      // Plain JSON mode. Groq's strict schema mode made this model emit junk (tried 2026-11-11), so parseReply does the checking.
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PROMPT },
        {
          role: 'user',
          content: [
            { type: 'text', text: images.map((image, i) => `Photo ${i + 1}: ${image.view ? VIEW_NAMES[image.view] : 'angle not given'}.`).join(' ') },
            ...images.map((image) => ({ type: 'image_url', image_url: { url: image.dataUrl } })),
          ],
        },
      ],
    }),
  });
  if (response.status === 429) throw new RateLimited(Number(response.headers.get('retry-after')) || 60);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Groq said no (${response.status}): ${body?.error?.message ?? 'no details'}`);
  return { ...parseReply(body?.choices?.[0]?.message?.content ?? ''), engine: 'groq' };
}

/** Checks the model's reply. Nothing it says is trusted: unknown grips are dropped and numbers are clamped. */
export function parseReply(reply: string): Pick<Classification, 'features' | 'matches'> {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1));
  } catch {
    throw new Error('The model did not reply with JSON.');
  }
  const words = (value: unknown) => (typeof value === 'string' && value.trim() ? value.trim().slice(0, 100) : 'Not clear');

  const known = new Set<string>(GRIPS.map((g) => g.id));
  const raw = (Array.isArray(data.matches) ? data.matches : [])
    .map((m) => ({ gripId: m?.grip as GripId, confidence: Number(m?.confidence) }))
    .filter((m) => known.has(m.gripId) && Number.isFinite(m.confidence) && m.confidence >= 0);
  const percent = raw.some((m) => m.confidence > 1); // some models answer 85 instead of 0.85
  const best = new Map<GripId, number>();
  for (const m of raw) best.set(m.gripId, Math.max(best.get(m.gripId) ?? 0, Math.min(1, percent ? m.confidence / 100 : m.confidence)));
  const matches: GripMatch[] = [...best].map(([gripId, confidence]) => ({ gripId, confidence })).sort((a, b) => b.confidence - a.confidence).slice(0, 3);
  if (matches.length === 0) throw new Error('The model did not name a grip.');

  return { features: { seam: words(data.seam), fingers: words(data.fingers), thumb: words(data.thumb), hand: words(data.hand) }, matches };
}
