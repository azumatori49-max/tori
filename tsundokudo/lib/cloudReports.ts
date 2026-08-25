/**
 * Firebase 上の共有レポートへのアクセス。クラウド有効時のみ利用される。
 *
 * - レポート本文: Firestore `orgs/{orgId}/reports/{id}`（{ data, createdAt, updatedAt }）
 * - 写真: Firebase Storage `orgs/{orgId}/photos/{photoId}.jpg`
 *   保存時に base64（data URL）の写真をアップロードし、URLに置き換える。
 *   これによりレポート1件のデータが軽くなり、保存タイムアウトも起きない。
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
import { normalizeReport } from '@/lib/reportNormalize';
import type { MaintenanceReport, ReportPhoto } from '@/types/report';

interface ReportDoc {
  data: MaintenanceReport;
  createdAt: string;
  updatedAt: string;
}

/** 組織のレポートを新しい順に取得（権限はセキュリティルールで判定） */
export async function cloudFetchReports(orgId: string): Promise<MaintenanceReport[]> {
  if (!fbDb) return [];
  const snap = await getDocs(
    query(collection(fbDb, 'orgs', orgId, 'reports'), orderBy('createdAt', 'desc')),
  );
  return snap.docs.map((d) => normalizeReport((d.data() as ReportDoc).data));
}

/** data URL の写真を Storage にアップロードして URL に置き換える */
async function uploadPhotoList(
  photos: ReportPhoto[],
  orgId: string,
): Promise<ReportPhoto[]> {
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

/** レポート内の全写真（各セクション）をアップロード済みURLへ変換 */
export async function uploadReportPhotos(
  report: MaintenanceReport,
  orgId: string,
): Promise<MaintenanceReport> {
  const [photos, pestPhotos, ratPhotos, annualPhotos, checklist, diy] = await Promise.all([
    uploadPhotoList(report.photos, orgId),
    uploadPhotoList(report.pestControl.photos, orgId),
    uploadPhotoList(report.ratControl.photos, orgId),
    uploadPhotoList(report.annualSchedule.photos, orgId),
    Promise.all(
      report.checklist.map(async (item) => ({
        ...item,
        photos: await uploadPhotoList(item.photos, orgId),
      })),
    ),
    Promise.all(
      report.diy.map(async (item) => ({
        ...item,
        photos: await uploadPhotoList(item.photos, orgId),
      })),
    ),
  ]);
  return {
    ...report,
    photos,
    checklist,
    diy,
    pestControl: { ...report.pestControl, photos: pestPhotos },
    ratControl: { ...report.ratControl, photos: ratPhotos },
    annualSchedule: { ...report.annualSchedule, photos: annualPhotos },
  };
}

/**
 * 1件を作成/更新（id をキーに上書き）。
 * 写真アップロード後のレポート（URL置換済み）を返す。
 */
export async function cloudUpsertReport(
  report: MaintenanceReport,
  orgId: string,
): Promise<MaintenanceReport> {
  if (!fbDb) return report;
  const uploaded = await uploadReportPhotos(report, orgId);
  const docBody: ReportDoc = {
    data: uploaded,
    createdAt: uploaded.createdAt,
    updatedAt: uploaded.updatedAt,
  };
  await setDoc(doc(fbDb, 'orgs', orgId, 'reports', report.id), docBody);
  return uploaded;
}

/** 1件を削除（写真はStorageに残るが実害なし・容量は微小） */
export async function cloudDeleteReport(id: string, orgId: string): Promise<void> {
  if (!fbDb) return;
  await deleteDoc(doc(fbDb, 'orgs', orgId, 'reports', id));
}
