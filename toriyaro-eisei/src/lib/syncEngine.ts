/** 送信キューをFirebaseへ同期するエンジン。排他制御・自動再送・状態通知を担当 */

import { get, push, ref, serverTimestamp, set } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';
import { ensureAuth, withRetry } from '../hooks/useSubmissions';
import {
  cleanupSynced,
  countUnsynced,
  listUnsynced,
  saveRecord,
  type QueueRecord,
} from './offlineQueue';

export interface SyncStatus {
  online: boolean;
  pending: number;
  phase: 'idle' | 'syncing' | 'done' | 'error';
  message: string;
}

let status: SyncStatus = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pending: 0,
  phase: 'idle',
  message: '',
};

const listeners = new Set<(s: SyncStatus) => void>();
const emit = () => listeners.forEach((l) => l({ ...status }));

export const subscribeSync = (cb: (s: SyncStatus) => void): (() => void) => {
  listeners.add(cb);
  cb({ ...status });
  return () => {
    listeners.delete(cb);
  };
};

export const refreshPending = async (): Promise<void> => {
  status.pending = await countUnsynced();
  emit();
};

/** 応答がないまま固まる通信に制限時間を付ける */
const withTimeout = <T>(p: Promise<T>, ms = 30000): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('通信タイムアウト')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });

/** 送信失敗を本部のエラーログへ記録（これ自体の失敗は無視） */
const logSyncError = async (rec: QueueRecord, message: string): Promise<void> => {
  try {
    const uploaded = rec.slots.filter((s) => s.uploadedUrl).length;
    const total = rec.slots.filter((s) => s.blob || s.data || s.uploadedUrl).length;
    await withTimeout(
      set(push(ref(db, 'errorLogs')), {
        storeKey: rec.storeId,
        storeName: rec.storeName,
        type: rec.type,
        dateOrWeekKey: rec.dateOrWeekKey,
        message: `[オフライン再送] ${message}`,
        uploaded,
        total,
        at: new Date().toISOString(),
      }),
      10000,
    );
  } catch {
    // ログ送信自体の失敗は無視
  }
};

/** 1レコードをFirebaseへ送信（何度呼んでも結果は同じ＝冪等） */
const sendRecord = async (
  rec: QueueRecord,
  onProgress: (done: number, total: number) => void,
): Promise<void> => {
  const path = `submissions/${rec.storeId}/${rec.type}/${rec.dateOrWeekKey}`;

  const toUpload = rec.slots.filter((s) => (s.data || s.blob) && !s.uploadedUrl);
  const totalNew = toUpload.length + rec.slots.filter((s) => s.uploadedUrl).length;
  let done = rec.slots.filter((s) => s.uploadedUrl).length;
  onProgress(done, totalNew);

  for (const slot of rec.slots) {
    const body: ArrayBuffer | Blob | undefined = slot.data ?? slot.blob;
    if (body && !slot.uploadedUrl) {
      if (body instanceof Blob && body.size === 0) {
        throw new Error('端末内の写真データが破損しています。お手数ですが撮り直して再提出してください');
      }
      const objectPath = `photos/${rec.storeId}/${rec.type}/${rec.dateOrWeekKey}/${slot.index}_${rec.id}.jpg`;
      const r0 = storageRef(storage, objectPath);
      await withRetry(
        () => withTimeout(uploadBytes(r0, body, { contentType: 'image/jpeg' })),
        2,
      );
      const url = await withRetry(() => withTimeout(getDownloadURL(r0), 15000), 2);
      slot.uploadedUrl = url;
      await saveRecord(rec);
      done += 1;
      onProgress(done, totalNew);
    }
  }

  const snap = await withRetry(() => withTimeout(get(ref(db, path)), 15000), 2);
  const existing = (snap.val() ?? {}) as Record<string, unknown>;

  const photosObj: Record<string, string> = {};
  const existingMeta = (existing.photoMeta || {}) as Record<string, { uploadedAt: string }>;
  const metaObj: Record<string, { uploadedAt: string }> = {};

  for (const slot of rec.slots) {
    const url = slot.uploadedUrl ?? slot.existingUrl;
    if (!url) continue;
    const key = String(slot.index);
    photosObj[key] = url;
    if (slot.uploadedUrl) {
      metaObj[key] = { uploadedAt: rec.savedAt };
    } else if (existingMeta[key]) {
      metaObj[key] = existingMeta[key];
    }
  }

  const payload: Record<string, unknown> = {
    count: Object.keys(photosObj).length,
    submittedAt: new Date().toISOString(),
    photos: photosObj,
    storeName: rec.storeName,
    photoMeta: metaObj,
    recordId: rec.id,
    tenantId: rec.tenantId,
    storeId: rec.storeId,
    clientCreatedAt: rec.createdAt,
    clientSavedAt: rec.savedAt,
    serverReceivedAt: serverTimestamp(),
  };
  if (existing.viaLine) payload.viaLine = true;

  await withRetry(() => withTimeout(set(ref(db, path), payload), 15000), 2);
};

let running = false;

const runSync = async (): Promise<void> => {
  status.online = navigator.onLine;
  await cleanupSynced();
  status.pending = await countUnsynced();

  const recs = await listUnsynced();
  if (recs.length === 0) {
    status.phase = 'idle';
    status.message = '';
    emit();
    return;
  }
  if (!navigator.onLine) {
    status.phase = 'idle';
    status.message = 'オフラインです。通信回復後に自動送信します';
    emit();
    return;
  }

  status.phase = 'syncing';
  status.message = '送信中…';
  emit();

  let okAll = true;
  let firstError = '';

  try {
    await withTimeout(ensureAuth(), 15000);
  } catch (err) {
    okAll = false;
    firstError = '認証エラー: ' + (err instanceof Error ? err.message : String(err));
  }

  if (okAll) {
    const ordered = [...recs].sort((a, b) => a.savedAt.localeCompare(b.savedAt));
    for (const rec of ordered) {
      rec.state = 'syncing';
      rec.attempts += 1;
      await saveRecord(rec);
      try {
        await sendRecord(rec, (done, total) => {
          status.message = `送信中…（${rec.storeName} ${done}/${total}枚）`;
          emit();
        });
        rec.state = 'synced';
        rec.syncedAt = new Date().toISOString();
        rec.lastError = undefined;
        rec.slots = rec.slots.map((s) => ({
          index: s.index,
          existingUrl: s.existingUrl,
          uploadedUrl: s.uploadedUrl,
        }));
        await saveRecord(rec);
      } catch (err) {
        okAll = false;
        const msg = err instanceof Error ? err.message : String(err);
        if (!firstError) firstError = msg;
        rec.state = 'failed';
        rec.lastError = msg;
        await saveRecord(rec);
        await logSyncError(rec, msg);
        // 失敗しても次の記録の送信は続行する
      }
    }
  }

  status.pending = await countUnsynced();
  status.phase = okAll ? 'done' : 'error';
  status.message = okAll
    ? '送信完了'
    : '送信に失敗しました: ' + firstError.slice(0, 120);
  emit();

  if (okAll) {
    setTimeout(() => {
      if (status.phase === 'done') {
        status.phase = 'idle';
        status.message = '';
        emit();
      }
    }, 3000);
  }
};

/** 再送を開始（多重実行しない排他制御つき） */
export const syncNow = async (): Promise<void> => {
  if (running) return;
  running = true;
  try {
    const nav = navigator as Navigator & {
      locks?: { request: (name: string, opts: { ifAvailable: boolean }, cb: (lock: unknown) => Promise<void>) => Promise<void> };
    };
    if (nav.locks) {
      await nav.locks.request('rakuraku-sync', { ifAvailable: true }, async (lock) => {
        if (lock) await runSync();
      });
    } else {
      await runSync();
    }
  } finally {
    running = false;
  }
};

/** 記録をキューに入れて即座に送信を試みる（オフラインなら端末保存のまま待機） */
export const enqueueSubmission = async (rec: QueueRecord): Promise<void> => {
  await saveRecord(rec);
  await refreshPending();
  void syncNow();
};

let inited = false;

/** アプリ起動時に1回だけ呼ぶ。各種トリガーを登録 */
export const initSyncEngine = (): void => {
  if (inited) return;
  inited = true;
  window.addEventListener('online', () => {
    status.online = true;
    emit();
    void syncNow();
  });
  window.addEventListener('offline', () => {
    status.online = false;
    emit();
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void syncNow();
  });
  void syncNow();
};