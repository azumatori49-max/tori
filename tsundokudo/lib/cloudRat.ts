/**
 * ネズミ駆除契約のクラウド保存（Firestore `orgs/{orgId}/ratContracts/{id}`）。
 * 写真はレポートと同じ `orgs/{orgId}/photos/` にアップロードする。
 */
import {
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadString } from 'firebase/storage';

import { fbDb, fbStorage } from '@/lib/firebase';
import type { RatContract } from '@/types/rat';
import type { ReportPhoto } from '@/types/report';

interface ContractDoc {
  data: RatContract;
  createdAt: string;
  updatedAt: string;
}

async function uploadPhotoList(photos: ReportPhoto[], orgId: string): Promise<ReportPhoto[]> {
  if (!fbStorage) return photos;
  return Promise.all(
    photos.map(async (p) => {
      if (!p.uri.startsWith('data:')) return p;
      const storageRef = ref(fbStorage!, `orgs/${orgId}/photos/${p.id}.jpg`);
      await uploadString(storageRef, p.uri, 'data_url');
      const url = await getDownloadURL(storageRef);
      return { ...p, uri: url };
    }),
  );
}

/** 旧データに不足フィールドを補完 */
export function normalizeRatContract(c: RatContract): RatContract {
  return {
    ...c,
    tsubo: c.tsubo ?? 0,
    renewals: c.renewals ?? [],
    note: c.note ?? '',
    visits: (c.visits ?? []).map((v) => ({ ...v, photos: v.photos ?? [], presence: v.presence ?? '' })),
  };
}

export async function cloudFetchRatContracts(orgId: string): Promise<RatContract[]> {
  if (!fbDb) return [];
  const snap = await getDocs(
    query(collection(fbDb, 'orgs', orgId, 'ratContracts'), orderBy('createdAt', 'desc')),
  );
  return snap.docs.map((d) => normalizeRatContract((d.data() as ContractDoc).data));
}

export async function cloudUpsertRatContract(
  contract: RatContract,
  orgId: string,
): Promise<RatContract> {
  if (!fbDb) throw new Error('クラウドが無効です');
  const visits = await Promise.all(
    contract.visits.map(async (v) => ({
      ...v,
      photos: await uploadPhotoList(v.photos, orgId),
    })),
  );
  const saved: RatContract = { ...contract, visits };
  const docBody: ContractDoc = {
    data: saved,
    createdAt: saved.createdAt,
    updatedAt: saved.updatedAt,
  };
  await setDoc(doc(fbDb, 'orgs', orgId, 'ratContracts', saved.id), docBody);
  return saved;
}

export async function cloudDeleteRatContract(id: string, orgId: string): Promise<void> {
  if (!fbDb) throw new Error('クラウドが無効です');
  await deleteDoc(doc(fbDb, 'orgs', orgId, 'ratContracts', id));
}
