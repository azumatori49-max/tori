import { get, ref, remove } from 'firebase/database';
import { deleteObject, ref as storageRefFn } from 'firebase/storage';
import { db, storage } from './firebase';
import type { Submission } from '../types';

const CLEANUP_KEY = 'toriyaro-last-cleanup';
const CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const RETENTION_DAYS = 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

export interface CleanupResult {
  scanned: number;
  removed: number;
  photoErrors: number;
}

const collectPhotoUrls = (sub: Submission): string[] => {
  const out: string[] = [];
  const raw = sub.photos as unknown;
  if (Array.isArray(raw)) {
    for (const v of raw) if (typeof v === 'string' && v) out.push(v);
  } else if (raw && typeof raw === 'object') {
    for (const v of Object.values(raw as Record<string, unknown>)) {
      if (typeof v === 'string' && v) out.push(v);
    }
  }
  return out;
};

const tryDeletePhoto = async (url: string): Promise<boolean> => {
  try {
    const objRef = storageRefFn(storage, url);
    await deleteObject(objRef);
    return true;
  } catch {
    return false;
  }
};

export const runRetentionCleanup = async (
  options: { force?: boolean } = {},
): Promise<CleanupResult | null> => {
  if (typeof window !== 'undefined' && !options.force) {
    const last = window.localStorage.getItem(CLEANUP_KEY);
    if (last && Date.now() - Number(last) < CLEANUP_INTERVAL_MS) return null;
  }

  const cutoff = Date.now() - RETENTION_MS;
  let scanned = 0;
  let removed = 0;
  let photoErrors = 0;

  const snap = await get(ref(db, 'submissions'));
  const all = (snap.val() as Record<string, Record<string, Record<string, Submission>>> | null) ?? {};

  for (const [storeKey, byType] of Object.entries(all)) {
    for (const [reportType, byPeriod] of Object.entries(byType ?? {})) {
      for (const [periodKey, sub] of Object.entries(byPeriod ?? {})) {
        if (!sub) continue;
        scanned++;
        const submittedAt = sub.submittedAt ? new Date(sub.submittedAt).getTime() : NaN;
        if (Number.isNaN(submittedAt)) continue;
        if (submittedAt >= cutoff) continue;

        for (const url of collectPhotoUrls(sub)) {
          const ok = await tryDeletePhoto(url);
          if (!ok) photoErrors++;
        }
        try {
          await remove(ref(db, `submissions/${storeKey}/${reportType}/${periodKey}`));
          removed++;
        } catch {
          photoErrors++;
        }
      }
    }
  }

  if (typeof window !== 'undefined') {
    window.localStorage.setItem(CLEANUP_KEY, Date.now().toString());
  }
  return { scanned, removed, photoErrors };
};
