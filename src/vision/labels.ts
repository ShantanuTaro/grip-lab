// The training set: photos with their confirmed grip. They live in this browser (IndexedDB) and
// leave it only when the user exports them. No public dataset of labelled grip photos exists,
// so this is how one gets collected.

import type { GripId } from '../physics/grips.ts';
import type { View } from './classify.ts';

export interface LabelledPhoto {
  id: string;
  /** JPEG data URL, at most 1024 px on its long side. */
  dataUrl: string;
  /** null until someone has labelled it. */
  gripId: GripId | null;
  view: View | null;
  addedAt: string;
  /** Measurements cached by the on-device engine (vision/device.ts). */
  features?: number[];
}

const STORE = 'photos';

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('grip-lab', 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE, { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run<T>(mode: IDBTransactionMode, work: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await open();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction(STORE, mode);
      const request = work(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(tx.error ?? request.error);
    });
  } finally {
    db.close();
  }
}

export const allPhotos = () => run<LabelledPhoto[]>('readonly', (store) => store.getAll());
export const savePhoto = (photo: LabelledPhoto) => run('readwrite', (store) => store.put(photo));
export const deletePhoto = (id: string) => run('readwrite', (store) => store.delete(id));

export function newPhoto(dataUrl: string, gripId: GripId | null = null, view: View | null = null): LabelledPhoto {
  // Not crypto.randomUUID: that is missing when the app is opened over plain http on a phone.
  return { id: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`, dataUrl, gripId, view, addedAt: new Date().toISOString() };
}

/** The labelled photos as a JSON file: the input to `npm run eval` and, later, to training. */
export function exportJson(photos: LabelledPhoto[]): string {
  return JSON.stringify({
    format: 'grip-lab-labels',
    version: 1,
    exportedAt: new Date().toISOString(),
    photos: photos.filter((p) => p.gripId).map(({ id, gripId, view, addedAt, dataUrl }) => ({ id, gripId, view, addedAt, dataUrl })),
  });
}
