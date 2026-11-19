// Grip recognition: one interface, three engines behind it.
//   groq    a hosted vision model on Groq's free tier (needs GROQ_API_KEY on the dev server)
//   device  hand tracking and a seam finder that run in the browser (Phase B scaffold)
//   sample  fixed sample output (the Phase A stub)
// Whatever an engine says is a suggestion. The capture screen makes the user confirm the grip.

import type { GripId } from '../physics/grips.ts';
import { classifyWithGroq } from './groq.ts';

export type View = 'side' | 'seam' | 'release';

export const VIEWS: readonly { id: View; name: string; hint: string }[] = [
  { id: 'side', name: 'Side on', hint: 'Thumb and fingers in profile' },
  { id: 'seam', name: 'Seam, front on', hint: 'Looking straight at the seam' },
  { id: 'release', name: 'Release position', hint: 'Wrist as you let go' },
];

/** A photo as a JPEG data URL, at most MAX_SIDE px on its long side. */
export interface GripImage {
  view: View;
  dataUrl: string;
}

/** What the photos show, in a few words each. */
export interface GripFeatures {
  seam: string;
  fingers: string;
  thumb: string;
  hand: string;
}

export interface GripMatch {
  gripId: GripId;
  /** 0 to 1. The engine's own estimate: not calibrated against real outcomes. */
  confidence: number;
}

export type Engine = 'groq' | 'device' | 'sample';

export interface Classification {
  features: GripFeatures;
  /** Best first, at most three. Empty when the engine could not name a grip. */
  matches: GripMatch[];
  engine: Engine;
  /** Anything the user should know about this result. */
  note?: string;
}

export const ENGINES: readonly { id: Engine; name: string; about: string }[] = [
  ...(__GROQ__
    ? [
        {
          id: 'groq' as const,
          name: 'Groq vision model',
          about: 'Sends your photos to a general vision model on Groq’s free tier. It was not trained on cricket grips, and the free tier allows about one three-photo check a minute.',
        },
      ]
    : []),
  {
    id: 'device',
    name: 'On this device (experimental)',
    about: 'Hand tracking and a seam finder that run in your browser. Photos stay on the device. It can only name a grip once photos have been labelled.',
  },
  { id: 'sample', name: 'Sample data', about: 'Fixed sample output. It does not look at your photos.' },
];

/** Groq when the dev server has a key, otherwise the sample stub. */
export const DEFAULT_ENGINE: Engine = __GROQ__ ? 'groq' : 'sample';

export async function classifyGrip(images: GripImage[], engine: Engine = DEFAULT_ENGINE): Promise<Classification> {
  if (images.length === 0) throw new Error('Add at least one photo first.');
  if (engine === 'groq') return classifyWithGroq(images);
  if (engine === 'device') return (await import('./device.ts')).classifyOnDevice(images);
  return {
    engine: 'sample',
    features: { seam: 'Upright', fingers: 'Index and middle, along the seam', thumb: 'Under the ball, on the seam', hand: 'Right' },
    matches: [
      { gripId: 'seam-up', confidence: 0.86 },
      { gripId: 'outswinger', confidence: 0.09 },
      { gripId: 'off-cutter', confidence: 0.05 },
    ],
  };
}

const MAX_SIDE = 1024;

/** Shrinks a photo and re-encodes it as JPEG, turned the right way up. */
export async function toDataUrl(file: Blob): Promise<string> {
  const bitmap = await createImageBitmap(file); // applies the camera's orientation tag
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return canvas.toDataURL('image/jpeg', 0.85);
}
