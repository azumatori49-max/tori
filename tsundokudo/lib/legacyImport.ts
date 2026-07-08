/**
 * 旧システム（Supabase）からのデータ引っ越し。
 *
 * 旧アプリの「閲覧用リンク」を貼り付けると、リンク中のトークンで
 * 旧データベースからレポート一覧を取得できる（読み取りのみ・公開RPC）。
 * 取得したレポートは Firebase 側へ保存し直す（写真もStorageへ移る）。
 *
 * 旧接続情報は従来のビルド変数（EXPO_PUBLIC_SUPABASE_URL / ANON_KEY）を
 * そのまま使う。未設定のビルドでは引っ越し機能自体が非表示になる。
 */
import { normalizeReport } from '@/lib/reportNormalize';
import type { MaintenanceReport } from '@/types/report';

const LEGACY_URL = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '');
const LEGACY_KEY = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '');

/** 旧システムからの引っ越しが可能か（旧接続情報がビルドに含まれるか） */
export const canImportLegacy = Boolean(LEGACY_URL && LEGACY_KEY);

/** 貼り付けられた閲覧用リンク（またはトークンそのもの）からトークンを抜き出す */
export function extractLegacyToken(input: string): string {
  const s = input.trim();
  const m = s.match(/\/v\/([0-9a-f]+)/i);
  if (m?.[1]) return m[1];
  return /^[0-9a-f]{16,}$/i.test(s) ? s : '';
}

interface LegacyRow {
  id: string;
  data: MaintenanceReport;
}

/** 旧システムのレポートを閲覧トークンで全件取得する */
export async function fetchLegacyReports(viewerLinkOrToken: string): Promise<MaintenanceReport[]> {
  const token = extractLegacyToken(viewerLinkOrToken);
  if (!canImportLegacy || !token) {
    throw new Error('旧システムの閲覧用リンクが正しくありません。');
  }
  const res = await fetch(`${LEGACY_URL}/rest/v1/rpc/get_reports_by_viewer_token`, {
    method: 'POST',
    headers: {
      apikey: LEGACY_KEY,
      Authorization: `Bearer ${LEGACY_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ t: token }),
  });
  if (!res.ok) {
    throw new Error('旧システムへの接続に失敗しました。時間をおいて再度お試しください。');
  }
  const rows = (await res.json()) as LegacyRow[];
  if (!Array.isArray(rows)) return [];
  return rows.map((row) => normalizeReport(row.data));
}
