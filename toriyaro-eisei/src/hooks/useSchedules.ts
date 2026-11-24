import { useEffect, useState } from 'react';
import { onValue, ref, remove, set, update } from 'firebase/database';
import {
  ref as storageRef,
  uploadBytes,
  uploadBytesResumable,
  getDownloadURL,
  deleteObject,
  listAll,
} from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { generateScheduleId, type ScheduleInput } from '../lib/schedule';
import { ensureAuth, prepareBlob, withRetry } from './useSubmissions';
import type { Schedule, ScheduleItem, ScheduleVideo, StoreKey } from '../types';

/** schedules 全体を購読する */
export const useSchedules = () => {
  const [schedules, setSchedules] = useState<Record<string, Schedule>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsub = onValue(
      ref(db, 'schedules'),
      (snap) => {
        const value = snap.val() as Record<string, Schedule> | null;
        setSchedules(value ?? {});
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message ?? 'スケジュールの取得に失敗しました');
        setLoading(false);
      },
    );
    return () => unsub();
  }, []);

  return { schedules, loading, error };
};

/** DB に書く形（undefined を含めない） */
const toVideoObject = (v: ScheduleVideo | undefined): ScheduleVideo | null => {
  if (!v) return null;
  const out: ScheduleVideo = { type: v.type, url: v.url };
  if (v.path) out.path = v.path;
  if (v.title && v.title.trim()) out.title = v.title.trim();
  if (typeof v.size === 'number') out.size = v.size;
  return out;
};

const toItemsObject = (items: ScheduleItem[]): Record<string, ScheduleItem> => {
  const out: Record<string, ScheduleItem> = {};
  items.forEach((it, i) => {
    const entry: ScheduleItem = {
      label: it.label.trim(),
      required: it.required,
      max: it.max,
      source: it.source,
    };
    const note = (it.note ?? '').trim();
    if (note) entry.note = note;
    if (it.helpImage) entry.helpImage = it.helpImage;
    const video = toVideoObject(it.video);
    if (video) entry.video = video;
    if (it.stores && Object.keys(it.stores).length > 0) entry.stores = { ...it.stores };
    out[String(i)] = entry;
  });
  return out;
};

const toStoresObject = (stores: StoreKey[] | null): Record<StoreKey, true> | null => {
  if (!stores) return null;
  const out: Record<StoreKey, true> = {};
  stores.forEach((k) => {
    out[k] = true;
  });
  return out;
};

/** 新しい id を作る（作成前に参考画像・動画をアップロードするために先に決める） */
export const newScheduleId = (from: string): string => generateScheduleId(from);

/**
 * 参考画像を Storage（schedule-refs/{scheduleId}/）にアップロードして URL を返す。
 * 店舗の写真と同じく圧縮してから送る。
 */
export const uploadScheduleRefImage = async (
  scheduleId: string,
  itemIndex: number,
  file: File,
): Promise<string> => {
  await ensureAuth();
  const { blob, type } = await prepareBlob(file);
  const path = `schedule-refs/${scheduleId}/${itemIndex}_${Date.now()}.jpg`;
  const r = storageRef(storage, path);
  await withRetry(() => uploadBytes(r, blob, { contentType: type }));
  const url = await withRetry(() => getDownloadURL(r));
  if (typeof url !== 'string' || url.length === 0) throw new Error('参考画像のURL取得に失敗しました');
  return url;
};

export interface UploadedMedia {
  url: string;
  path: string;
  size: number;
}

/**
 * 参考動画を Storage（schedule-media/{scheduleId}/）に再開可能アップロードで送る。
 * onBytes で進捗を通知。戻り値の path は差し替え・削除時に deleteObject する。
 */
export const uploadScheduleMedia = (
  scheduleId: string,
  file: File,
  onBytes?: (loaded: number, total: number) => void,
): Promise<UploadedMedia> =>
  new Promise((resolve, reject) => {
    ensureAuth()
      .then(() => {
        const ext = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'mp4';
        const path = `schedule-media/${scheduleId}/${Date.now()}.${ext}`;
        const r = storageRef(storage, path);
        const task = uploadBytesResumable(r, file, { contentType: file.type || 'video/mp4' });
        task.on(
          'state_changed',
          (snap) => onBytes?.(snap.bytesTransferred, snap.totalBytes),
          (err) => reject(err),
          () => {
            getDownloadURL(task.snapshot.ref).then(
              (url) => resolve({ url, path, size: file.size }),
              reject,
            );
          },
        );
      })
      .catch(reject);
  });

/** アップロード済みの参考動画を Storage から消す（失敗しても呼び出し側は処理を続ける） */
export const deleteScheduleMediaObject = async (path: string): Promise<void> => {
  try {
    await deleteObject(storageRef(storage, path));
  } catch {
    // 既に無い等は無視
  }
};

/** schedule-media/{scheduleId}/ 配下を全部消す（スケジュール削除時） */
const deleteAllScheduleMedia = async (scheduleId: string): Promise<void> => {
  try {
    const listing = await listAll(storageRef(storage, `schedule-media/${scheduleId}`));
    await Promise.all(listing.items.map((item) => deleteObject(item).catch(() => undefined)));
  } catch {
    // フォルダが無い等は無視
  }
};

/** 新規作成。id は newScheduleId で先に決めたものを渡す */
export const createSchedule = async (id: string, input: ScheduleInput): Promise<void> => {
  const payload: Record<string, unknown> = {
    title: input.title.trim(),
    from: input.from,
    to: input.to,
    items: toItemsObject(input.items),
    createdAt: new Date().toISOString(),
  };
  const description = input.description.trim();
  if (description) payload.description = description;
  const stores = toStoresObject(input.stores);
  if (stores) payload.stores = stores;
  const video = toVideoObject(input.video);
  if (video) payload.video = video;
  await set(ref(db, `schedules/${id}`), payload);
};

/** 編集。id と createdAt は変えない。items は必ず全体を書き換える（順番＝番号） */
export const updateSchedule = async (id: string, input: ScheduleInput): Promise<void> => {
  const patch: Record<string, unknown> = {
    title: input.title.trim(),
    description: input.description.trim() || null,
    from: input.from,
    to: input.to,
    stores: toStoresObject(input.stores),
    items: toItemsObject(input.items),
    video: toVideoObject(input.video),
  };
  await update(ref(db, `schedules/${id}`), patch);
};

/** 非表示（archived）の切り替え */
export const setScheduleArchived = async (id: string, archived: boolean): Promise<void> => {
  await update(ref(db, `schedules/${id}`), { archived: archived ? true : null });
};

/** 削除（呼び出し側で「どの店舗も未提出」を確認してから呼ぶ）。紐づく参考動画も消す */
export const deleteSchedule = async (id: string): Promise<void> => {
  await remove(ref(db, `schedules/${id}`));
  await deleteAllScheduleMedia(id);
};
