// Phase B scaffold: grip recognition that runs on the device, so photos never leave it.
//   1. MediaPipe Hand Landmarker finds 21 points on the hand.
//   2. A seam finder looks for pale stitching on a red ball and measures which way it runs.
//   3. A nearest-neighbour classifier compares those measurements with photos labelled under /label.
// Status: 1 and 2 run. 3 has nothing to compare against until photos are labelled. None of the
// thresholds below has been tuned or scored against real data, and the seam finder is red-ball only.
// Known limit: the hand tracker misses tight close-ups where the ball hides the palm.

import type { GripId } from '../physics/grips.ts';
import type { Classification, GripImage, GripMatch, View } from './classify.ts';
import { allPhotos, savePhoto } from './labels.ts';

const TASKS_VERSION = '1.2.2'; // keep in step with @mediapipe/tasks-vision in package.json
const WASM_URL = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${TASKS_VERSION}/wasm`;
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const DEG = Math.PI / 180;

interface Point {
  x: number;
  y: number;
}

/** The smallest angle between two lines given by their directions in degrees: 0 to 90. */
const lineAngle = (a: number, b: number) => {
  const d = Math.abs(a - b) % 180;
  return d > 90 ? 180 - d : d;
};

/** Measurements from MediaPipe's 21 hand landmarks (0 wrist, 4 thumb tip, 8 index tip, 12 middle tip, 16 ring tip). */
export function handMeasures(p: Point[]) {
  const gap = (a: number, b: number) => Math.hypot(p[a].x - p[b].x, p[a].y - p[b].y);
  const direction = (a: number, b: number) => Math.atan2(p[b].y - p[a].y, p[b].x - p[a].x) / DEG;
  const palm = gap(0, 9) || 1;
  const index = direction(5, 8);
  const middle = direction(9, 12);
  return {
    /** Which way the first two fingers point in the image, in degrees. */
    fingersDeg: Math.atan2(p[8].y + p[12].y - p[5].y - p[9].y, p[8].x + p[12].x - p[5].x - p[9].x) / DEG,
    /** Angle between the index and middle fingers. */
    spreadDeg: Math.min(Math.abs(index - middle), 360 - Math.abs(index - middle)),
    /** Distances in palm lengths, so they do not depend on how close the camera was. */
    tipGap: gap(8, 12) / palm,
    thumbGap: gap(4, 5) / palm,
    ringCurl: gap(16, 13) / palm,
  };
}

/**
 * Finds the seam on a red ball: pale, unsaturated pixels with red leather around them.
 * Returns which way the stitching runs in the image (degrees, image axes) and how line-like
 * it is (0 to 1), or null when there is too little to go on.
 */
export function findSeam(rgba: Uint8ClampedArray, width: number, height: number): { angleDeg: number; straightness: number } | null {
  // Running totals of "is red" so the red share of any box is four lookups.
  const stride = width + 1;
  const redSum = new Uint32Array(stride * (height + 1));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = 4 * (y * width + x);
      const red = rgba[i] > 80 && rgba[i] > 1.7 * rgba[i + 1] && rgba[i] > 1.7 * rgba[i + 2] ? 1 : 0;
      redSum[(y + 1) * stride + x + 1] = red + redSum[y * stride + x + 1] + redSum[(y + 1) * stride + x] - redSum[y * stride + x];
    }
  }

  const reach = Math.max(3, Math.round(Math.max(width, height) / 40));
  let n = 0, sx = 0, sy = 0, sxx = 0, syy = 0, sxy = 0;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = 4 * (y * width + x);
      const hi = Math.max(rgba[i], rgba[i + 1], rgba[i + 2]);
      const lo = Math.min(rgba[i], rgba[i + 1], rgba[i + 2]);
      if (lo < 120 || hi - lo > 0.22 * hi) continue; // not pale thread
      const x0 = Math.max(0, x - reach), y0 = Math.max(0, y - reach);
      const x1 = Math.min(width, x + reach + 1), y1 = Math.min(height, y + reach + 1);
      const red = redSum[y1 * stride + x1] - redSum[y0 * stride + x1] - redSum[y1 * stride + x0] + redSum[y0 * stride + x0];
      if (red < 0.35 * (x1 - x0) * (y1 - y0)) continue; // not on the ball
      n++; sx += x; sy += y; sxx += x * x; syy += y * y; sxy += x * y;
    }
  }
  if (n < 30 || n < 0.004 * redSum[redSum.length - 1]) return null;

  // The long axis of the stitch pixels is the seam's direction.
  const cxx = sxx / n - (sx / n) ** 2;
  const cyy = syy / n - (sy / n) ** 2;
  const cxy = sxy / n - (sx / n) * (sy / n);
  return { angleDeg: (0.5 * Math.atan2(2 * cxy, cxx - cyy)) / DEG, straightness: Math.hypot(cxx - cyy, 2 * cxy) / (cxx + cyy || 1) };
}

export interface Example {
  gripId: GripId;
  view: View | null;
  features: number[];
}

/** Votes among the k labelled photos whose measurements are closest. Missing measurements (NaN) are skipped. */
export function nearest(query: number[], view: View, examples: Example[], k = 5): GripMatch[] {
  const scored = examples
    .map((e) => {
      let total = 0;
      let used = 0;
      e.features.forEach((value, i) => {
        if (Number.isFinite(value) && Number.isFinite(query[i])) {
          total += Math.abs(value - query[i]);
          used++;
        }
      });
      return { gripId: e.gripId, distance: used ? total / used + (e.view === view ? 0 : 0.1) : Infinity };
    })
    .filter((s) => Number.isFinite(s.distance))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, k);
  const votes = new Map<GripId, number>();
  let total = 0;
  for (const s of scored) {
    const weight = 1 / (s.distance + 0.05);
    votes.set(s.gripId, (votes.get(s.gripId) ?? 0) + weight);
    total += weight;
  }
  return [...votes].map(([gripId, v]) => ({ gripId, confidence: v / total })).sort((a, b) => b.confidence - a.confidence).slice(0, 3);
}

interface Measured {
  /** seam against fingers (0 along, 1 across), finger spread, fingertip gap, thumb gap, ring-finger curl. */
  features: number[];
  hand: string | null;
  seamStraightness: number;
}

let landmarker: Promise<import('@mediapipe/tasks-vision').HandLandmarker> | undefined;

async function measure(dataUrl: string): Promise<Measured> {
  landmarker ??= (async () => {
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
    return HandLandmarker.createFromOptions(await FilesetResolver.forVisionTasks(WASM_URL), {
      baseOptions: { modelAssetPath: MODEL_URL },
      numHands: 1,
    });
  })();
  landmarker.catch(() => (landmarker = undefined)); // let the next call retry a failed download
  const bitmap = await createImageBitmap(await (await fetch(dataUrl)).blob());
  const found = (await landmarker).detect(bitmap);

  const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const context = canvas.getContext('2d', { willReadFrequently: true })!;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const seam = findSeam(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height);

  const points = found.landmarks[0]?.map((p) => ({ x: p.x * bitmap.width, y: p.y * bitmap.height }));
  bitmap.close();
  const hand = points ? handMeasures(points) : null;
  const straight = seam && seam.straightness >= 0.5 ? seam : null;
  // Left or right as MediaPipe reports it. Its documentation says a mirrored selfie is assumed, but on the
  // two ordinary photos of a right hand tried so far it said Right, so the answer is passed through. Unverified.
  const named = found.handedness[0]?.[0]?.categoryName;
  return {
    features: [
      hand && straight ? lineAngle(straight.angleDeg, hand.fingersDeg) / 90 : NaN,
      hand ? hand.spreadDeg / 45 : NaN,
      hand ? hand.tipGap : NaN,
      hand ? hand.thumbGap : NaN,
      hand ? hand.ringCurl : NaN,
    ],
    hand: named ? `${named} (estimate)` : null,
    seamStraightness: straight?.straightness ?? 0,
  };
}

export async function classifyOnDevice(images: GripImage[]): Promise<Classification> {
  const measured: Measured[] = [];
  for (const image of images) measured.push(await measure(image.dataUrl));

  // Describe the clearest photo for each feature.
  const withHand = measured.find((m) => m.hand);
  const withSeam = [...measured].sort((a, b) => b.seamStraightness - a.seamStraightness).find((m) => Number.isFinite(m.features[0]));
  const seamDeg = withSeam ? Math.round(withSeam.features[0] * 90) : null;
  const spreadDeg = withHand ? Math.round(withHand.features[1] * 45) : null;
  const features = {
    seam: seamDeg === null ? 'Not found' : seamDeg < 25 ? 'Runs along the fingers' : seamDeg > 65 ? 'Runs across the fingers' : `About ${seamDeg}° to the fingers`,
    fingers: spreadDeg === null ? 'Not found' : spreadDeg < 12 ? 'First two together' : spreadDeg < 25 ? `First two slightly apart (${spreadDeg}°)` : `First two spread wide (${spreadDeg}°)`,
    thumb: !withHand ? 'Not found' : withHand.features[3] < 0.75 ? 'Close to the index finger' : 'Opposite the fingers',
    hand: withHand?.hand ?? 'Not found',
  };
  // Tried on six photos: the tracker found the hand in both arm's-length colour shots, and missed three
  // tight close-ups and one old black-and-white photo.
  if (!withHand) return { engine: 'device', features, matches: [], note: 'No hand was found. The hand tracker needs the whole hand in the picture: step back to about an arm’s length and try again.' };

  // Compare with the labelled photos, measuring any that have not been measured yet.
  const examples: Example[] = [];
  for (const photo of await allPhotos()) {
    if (!photo.gripId) continue;
    if (!photo.features) {
      photo.features = (await measure(photo.dataUrl)).features;
      await savePhoto(photo);
    }
    examples.push({ gripId: photo.gripId, view: photo.view, features: photo.features });
  }
  if (examples.length === 0) {
    return { engine: 'device', features, matches: [], note: 'The photos were measured, but there are no labelled photos to compare them with yet. Label some under Label and this engine will start naming grips.' };
  }

  const totals = new Map<GripId, number>();
  images.forEach((image, i) => {
    for (const m of nearest(measured[i].features, image.view, examples)) totals.set(m.gripId, (totals.get(m.gripId) ?? 0) + m.confidence / images.length);
  });
  return {
    engine: 'device',
    features,
    matches: [...totals].map(([gripId, confidence]) => ({ gripId, confidence })).sort((a, b) => b.confidence - a.confidence).slice(0, 3),
    note: `Compared with ${examples.length} labelled photo${examples.length === 1 ? '' : 's'}. This engine has not been scored yet: treat it as a rough guess.`,
  };
}
