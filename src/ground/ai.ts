// Reads a pasted pitch report, curator's notes or forecast into the measurement fields, with a language model on
// Groq (through the dev server's /api/groq proxy, which holds the key). The model only fills in the form, quoting
// where each number came from; the physics does the simulating. The provider can be swapped here.

import { FIELDS } from '../physics/measurements.ts';
import type { Field, Measurements } from '../physics/measurements.ts';
import { GROQ_MODEL, RateLimited } from '../vision/groq.ts';

export interface Reading {
  name: string | null;
  values: Measurements;
  /** For each field filled in: the words it came from, and whether the number was inferred rather than stated. */
  why: Partial<Record<Field, { quote: string; guess: boolean }>>;
}

const PROMPT = `You turn cricket pitch and weather notes into measurements for a ball-flight simulator.

Fields (key: meaning, unit):
${(Object.entries(FIELDS) as [Field, (typeof FIELDS)[Field]][]).map(([k, f]) => `- ${k}: ${f.label}, ${f.unit}${f.hint ? ` (${f.hint})` : ''}`).join('\n')}

Rules:
- Fill in only fields the text supports. Leave out everything else. Never invent a number with nothing behind it.
- Convert units: inches to mm, °F to °C, mph or knots to kph, feet to m.
- windFromDeg is relative to the pitch, not the compass: 0 means blowing from behind the bowler toward the batter, 90 from the bowler's right. Give it only if the text says how the wind sits relative to the pitch or its ends.
- A number stated in the text: guess false. A number you inferred from words (a "green top" suggests longer grass, "bone dry" suggests low moisture, "humid evening" suggests a dew point near the temperature): guess true, and keep it modest.
- quote: the exact words from the text the value is based on, at most 15 words.
- name: the ground's name if the text gives one, else null.

Reply with JSON only: {"name": "...", "fields": {"grassLengthMm": {"value": 6, "quote": "...", "guess": false}}}`;

export async function readNotes(text: string, url = '/api/groq/chat/completions'): Promise<Reading> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: GROQ_MODEL,
      temperature: 0.1,
      max_completion_tokens: 900,
      reasoning_effort: 'none',
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: text.slice(0, 12000) },
      ],
    }),
  });
  if (response.status === 429) throw new RateLimited(Number(response.headers.get('retry-after')) || 60);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`Groq said no (${response.status}): ${body?.error?.message ?? 'no details'}`);
  return parseReading(body?.choices?.[0]?.message?.content ?? '', text);
}

/**
 * Checks the model's reply. Nothing it says is trusted: unknown fields and out-of-range numbers are dropped, and
 * a value whose quote is not in the text is marked as a guess.
 */
export function parseReading(reply: string, text: string): Reading {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(reply.slice(reply.indexOf('{'), reply.lastIndexOf('}') + 1));
  } catch {
    throw new Error('The model did not reply with JSON.');
  }
  const fields = (data.fields ?? {}) as Record<string, { value?: unknown; quote?: unknown; guess?: unknown }>;
  const out: Reading = { name: typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 60) : null, values: {}, why: {} };
  const plain = (s: string) => s.toLowerCase().replace(/\s+/g, ' ');
  for (const [k, f] of Object.entries(FIELDS) as [Field, (typeof FIELDS)[Field]][]) {
    const v = Number(fields[k]?.value);
    if (fields[k]?.value == null || !Number.isFinite(v) || v < f.min || v > f.max) continue;
    const quote = typeof fields[k].quote === 'string' ? (fields[k].quote as string).slice(0, 160) : '';
    out.values[k] = v;
    out.why[k] = { quote, guess: fields[k].guess === true || !quote || !plain(text).includes(plain(quote)) };
  }
  if (Object.keys(out.values).length === 0) throw new Error('Nothing in that text could be turned into a measurement.');
  return out;
}
