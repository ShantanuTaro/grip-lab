// Scores the Groq grip matcher against labelled photos exported from the Label screen.
//
//   npm run eval -- grip-labels-2026-11-11.json
//   npm run eval -- grip-labels-2026-11-11.json 20     only the first 20 photos
//
// It sends one photo per request, so each photo is judged on its own. It needs GROQ_API_KEY in
// .env.local. The free tier allows two photos a minute, so the script waits when told to.

import { readFileSync } from 'node:fs';
import { GRIPS } from '../src/physics/grips.ts';
import type { GripId } from '../src/physics/grips.ts';
import { GROQ_MODEL, RateLimited, classifyWithGroq } from '../src/vision/groq.ts';

function fail(message: string): never {
  console.error(`eval: ${message}`);
  process.exit(1);
}

const [file, limit] = process.argv.slice(2);
if (!file) fail('usage: npm run eval -- <labels.json> [how many photos]');
const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) fail('GROQ_API_KEY is not set. Put it in .env.local.');

let data: any;
try {
  data = JSON.parse(readFileSync(file, 'utf8'));
} catch (error) {
  fail(`cannot read ${file}: ${(error as Error).message}`);
}
if (data?.format !== 'grip-lab-labels' || !Array.isArray(data.photos)) fail('this is not a file exported from the Label screen');
const ids = new Set<string>(GRIPS.map((g) => g.id));
const photos: { gripId: GripId; view: 'side' | 'seam' | 'release' | null; dataUrl: string }[] = data.photos.slice(0, Number(limit) || undefined);
photos.forEach((p, i) => {
  if (!ids.has(p.gripId)) fail(`photos[${i}].gripId is not a known grip: ${JSON.stringify(p.gripId)}`);
  if (typeof p.dataUrl !== 'string' || !p.dataUrl.startsWith('data:image/')) fail(`photos[${i}].dataUrl is not an image`);
});
if (photos.length === 0) fail('the file has no labelled photos');

console.log(`\n${GROQ_MODEL} on ${photos.length} labelled photo${photos.length === 1 ? '' : 's'}, one photo per request\n`);

const tally = new Map<GripId, { n: number; top1: number; top3: number; called: Map<string, number> }>();
let failed = 0;
let stoppedEarly = '';
scoring: for (const [i, photo] of photos.entries()) {
  let picks: GripId[];
  for (;;) {
    try {
      picks = (await classifyWithGroq([photo], { url: 'https://api.groq.com/openai/v1/chat/completions', apiKey })).matches.map((m) => m.gripId);
      break;
    } catch (error) {
      if (error instanceof RateLimited && error.retryAfterS <= 90) {
        await new Promise((resolve) => setTimeout(resolve, (error.retryAfterS + 1) * 1000));
        continue;
      }
      if (error instanceof RateLimited) {
        stoppedEarly = `Stopped after ${i} photos: the free tier is used up for now (retry in about ${Math.ceil(error.retryAfterS / 60)} min).`;
        break scoring;
      }
      console.log(`  photo ${i + 1}: failed (${(error as Error).message})`);
      failed++;
      continue scoring;
    }
  }
  const row = tally.get(photo.gripId) ?? { n: 0, top1: 0, top3: 0, called: new Map() };
  row.n++;
  if (picks[0] === photo.gripId) row.top1++;
  if (picks.includes(photo.gripId)) row.top3++;
  row.called.set(picks[0], (row.called.get(picks[0]) ?? 0) + 1);
  tally.set(photo.gripId, row);
  console.log(`  photo ${i + 1}: labelled ${photo.gripId}, model said ${picks.join(', ')}`);
}

const scored = [...tally.values()].reduce((sum, row) => sum + row.n, 0);
if (scored > 0) {
  const share = (n: number, of: number) => `${n} (${Math.round((100 * n) / of)}%)`;
  const table = [['grip', 'photos', 'top pick right', 'in top 3', 'most often called']];
  for (const g of GRIPS) {
    const row = tally.get(g.id);
    if (row) table.push([g.id, String(row.n), share(row.top1, row.n), share(row.top3, row.n), [...row.called].sort((a, b) => b[1] - a[1])[0][0]]);
  }
  const sum = (key: 'top1' | 'top3') => [...tally.values()].reduce((total, row) => total + row[key], 0);
  table.push(['all', String(scored), share(sum('top1'), scored), share(sum('top3'), scored), '']);
  const widths = table[0].map((_, col) => Math.max(...table.map((row) => row[col].length)));
  console.log('');
  for (const row of table) console.log('  ' + row.map((cell, col) => cell.padEnd(widths[col])).join('   ').trimEnd());
  console.log(`\n  Picking at random would get 13% for the top pick and 38% for the top three.`);
  if (scored < 80) console.log(`  ${scored} photos is too few to trust these percentages: aim for at least 10 per grip.`);
}
if (failed) console.log(`  ${failed} photo${failed === 1 ? '' : 's'} could not be scored.`);
if (stoppedEarly) console.log(`  ${stoppedEarly}`);
console.log('');
