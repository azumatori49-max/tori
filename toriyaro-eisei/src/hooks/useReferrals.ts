import { useEffect, useState } from 'react';
import { get, onValue, ref, remove, set, update } from 'firebase/database';
import {
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import { db, storage } from '../lib/firebase';
import { ensureAuth, withRetry } from './useSubmissions';
import type {
  ReferralChecklist,
  ReferralDraft,
  ReferralKind,
  ReferralRequest,
  ReferralStatus,
  StoreKey,
} from '../types';

/** 全カタカナをひらがなに（U+30A1〜U+30F6） */
const kanaToHira = (s: string): string =>
  s.replace(/[ァ-ヶ]/g, (m) =>
    String.fromCharCode(m.charCodeAt(0) - 0x60),
  );

/** 重複検知用: 全ての空白（半角/全角/タブ）を除去し、カタカナをひらがな化 */
export const normalizeName = (name: string): string =>
  kanaToHira(name.replace(/[\s　]+/g, '').trim());

/** UUID を組み立てる（crypto.randomUUID フォールバック付き） */
const genRequestId = (): string => {
  const g = (globalThis as { crypto?: { randomUUID?: () => string } }).crypto;
  if (g?.randomUUID) return g.randomUUID();
  return `req_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
};

const dataUrlToBlob = (dataUrl: string): Blob => {
  const [meta, base64] = dataUrl.split(',');
  const mime = /:(.*?);/.exec(meta)?.[1] ?? 'image/png';
  const bin = atob(base64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) buf[i] = bin.charCodeAt(i);
  return new Blob([buf], { type: mime });
};

interface SignatureInput {
  /** data URL (PNG) */
  dataUrl: string;
  signedAt: string;
}

interface SubmitInput {
  kind: ReferralKind;
  storeKey: StoreKey;
  storeName: string;
  managerName: string;
  referrerName: string;
  referredName: string;
  hireDate: string;
  thresholdDate: string;
  signatures: {
    manager: SignatureInput;
    referrer: SignatureInput;
    referred: SignatureInput;
  };
}

/** 全申請を購読 */
export const useAllReferrals = () => {
  const [items, setItems] = useState<ReferralRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const r = ref(db, 'referralRequests');
    const unsub = onValue(
      r,
      (snap) => {
        const val = snap.val() as Record<string, ReferralRequest> | null;
        if (!val) {
          setItems([]);
          setError(null);
          return;
        }
        const arr = Object.values(val).sort(
          (a, b) => (b.appliedAt ?? '').localeCompare(a.appliedAt ?? ''),
        );
        setItems(arr);
        setError(null);
      },
      (err) => {
        setError(err.message ?? '紹介手当申請の取得に失敗しました');
        setItems([]);
      },
    );
    return () => unsub();
  }, []);

  return { items, error };
};

/** 自店の申請のみを購読 */
export const useStoreReferrals = (storeKey: StoreKey | null) => {
  const [items, setItems] = useState<ReferralRequest[] | null>(null);

  useEffect(() => {
    if (!storeKey) {
      setItems([]);
      return;
    }
    const r = ref(db, 'referralRequests');
    const unsub = onValue(
      r,
      (snap) => {
        const val = snap.val() as Record<string, ReferralRequest> | null;
        if (!val) {
          setItems([]);
          return;
        }
        const arr = Object.values(val)
          .filter((x) => x.storeKey === storeKey)
          .sort((a, b) => (b.appliedAt ?? '').localeCompare(a.appliedAt ?? ''));
        setItems(arr);
      },
      () => setItems([]),
    );
    return () => unsub();
  }, [storeKey]);

  return items;
};

/** 送信前の重複チェック（rejected は除外） */
export interface DuplicateHit {
  storeName: string;
  appliedAt: string;
  status: ReferralStatus;
}

export const findDuplicate = async (
  normalizedReferredName: string,
): Promise<DuplicateHit | null> => {
  await ensureAuth();
  const snap = await get(ref(db, 'referralRequests'));
  const val = snap.val() as Record<string, ReferralRequest> | null;
  if (!val) return null;
  for (const r of Object.values(val)) {
    if (r.status === 'rejected') continue;
    if (r.normalizedReferredName === normalizedReferredName) {
      return {
        storeName: r.storeName,
        appliedAt: r.appliedAt,
        status: r.status,
      };
    }
  }
  return null;
};

const uploadSignature = async (
  requestId: string,
  role: 'manager' | 'referrer' | 'referred',
  sig: SignatureInput,
): Promise<{ imageUrl: string; signedAt: string }> => {
  const blob = dataUrlToBlob(sig.dataUrl);
  const path = `referral-signs/${requestId}/${role}.png`;
  const r = storageRef(storage, path);
  await withRetry(() =>
    uploadBytes(r, blob, { contentType: 'image/png' }),
  );
  const imageUrl = await withRetry(() => getDownloadURL(r));
  return { imageUrl, signedAt: sig.signedAt };
};

/** 申請の送信。サイン画像を Storage にアップロードし、RTDB に保存 */
export const submitReferral = async (
  input: SubmitInput,
): Promise<ReferralRequest> => {
  await ensureAuth();
  const id = genRequestId();

  const [managerSig, referrerSig, referredSig] = await Promise.all([
    uploadSignature(id, 'manager', input.signatures.manager),
    uploadSignature(id, 'referrer', input.signatures.referrer),
    uploadSignature(id, 'referred', input.signatures.referred),
  ]);

  const payload: ReferralRequest = {
    id,
    kind: input.kind,
    storeKey: input.storeKey,
    storeName: input.storeName,
    managerName: input.managerName,
    referrerName: input.referrerName,
    referredName: input.referredName,
    normalizedReferredName: normalizeName(input.referredName),
    hireDate: input.hireDate,
    thresholdDate: input.thresholdDate,
    signatures: {
      manager: managerSig,
      referrer: referrerSig,
      referred: referredSig,
    },
    appliedAt: new Date().toISOString(),
    status: 'pending',
  };

  await withRetry(() => set(ref(db, `referralRequests/${id}`), payload));
  return payload;
};

/** 承認 */
export const approveReferral = async (
  id: string,
  decidedBy: string,
  checklist: ReferralChecklist,
): Promise<void> => {
  await ensureAuth();
  await withRetry(() =>
    update(ref(db, `referralRequests/${id}`), {
      status: 'approved',
      checklist,
      decidedBy,
      decidedAt: new Date().toISOString(),
    }),
  );
};

/** 差戻し */
export const rejectReferral = async (
  id: string,
  decidedBy: string,
  reason: string,
): Promise<void> => {
  await ensureAuth();
  await withRetry(() =>
    update(ref(db, `referralRequests/${id}`), {
      status: 'rejected',
      rejectReason: reason,
      decidedBy,
      decidedAt: new Date().toISOString(),
    }),
  );
};

/** 支払済みに更新（承認済みからのみ） */
export const markReferralPaid = async (id: string): Promise<void> => {
  await ensureAuth();
  await withRetry(() =>
    update(ref(db, `referralRequests/${id}`), {
      status: 'paid',
      paidAt: new Date().toISOString(),
    }),
  );
};

// ============================================================
// 下書き（送信前の途中保存）
// referralDrafts/{storeKey}/{draftId}
// ============================================================

/** 新しい下書きID */
export const generateDraftId = (): string => genRequestId();

/** 店舗の下書き一覧を購読（更新時刻の新しい順） */
export const useStoreDrafts = (storeKey: StoreKey | null) => {
  const [items, setItems] = useState<ReferralDraft[] | null>(null);

  useEffect(() => {
    if (!storeKey) {
      setItems([]);
      return;
    }
    const r = ref(db, `referralDrafts/${storeKey}`);
    const unsub = onValue(
      r,
      (snap) => {
        const val = snap.val() as Record<string, Omit<ReferralDraft, 'id' | 'storeKey'>> | null;
        if (!val) {
          setItems([]);
          return;
        }
        const arr: ReferralDraft[] = Object.entries(val).map(([id, v]) => ({
          ...(v as Omit<ReferralDraft, 'id' | 'storeKey'>),
          id,
          storeKey,
        }));
        arr.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
        setItems(arr);
      },
      () => setItems([]),
    );
    return () => unsub();
  }, [storeKey]);

  return items;
};

/** 下書きに部分更新を書き込む（updatedAt は自動付与） */
export const saveReferralDraft = async (
  storeKey: StoreKey,
  draftId: string,
  patch: Record<string, unknown>,
): Promise<void> => {
  await ensureAuth();
  const payload = { ...patch, updatedAt: new Date().toISOString() };
  await withRetry(() =>
    update(ref(db, `referralDrafts/${storeKey}/${draftId}`), payload),
  );
};

/** 下書きの削除 */
export const deleteReferralDraft = async (
  storeKey: StoreKey,
  draftId: string,
): Promise<void> => {
  await ensureAuth();
  await withRetry(() =>
    remove(ref(db, `referralDrafts/${storeKey}/${draftId}`)),
  );
};
