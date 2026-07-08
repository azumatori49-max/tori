/**
 * Supabase 上の共有レポート（reports テーブル）へのアクセス。
 * クラウド有効時のみ利用される。データは組織（org_id）ごとに分離。
 */
import { REPORTS_TABLE, supabase } from '@/lib/supabase';
import { normalizeReport } from '@/lib/reportNormalize';
import type { MaintenanceReport } from '@/types/report';

interface ReportRow {
  id: string;
  org_id: string | null;
  data: MaintenanceReport;
  created_at: string;
  updated_at: string;
}

/** 自組織のレポートを新しい順に取得（RLSでスコープされる） */
export async function cloudFetchReports(): Promise<MaintenanceReport[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(REPORTS_TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as ReportRow[] | null) ?? []).map((row) => normalizeReport(row.data));
}

/** 閲覧用リンクのトークンでレポートを取得（未ログイン可・読み取りのみ） */
export async function cloudFetchReportsByToken(token: string): Promise<MaintenanceReport[]> {
  if (!supabase) return [];
  const res = (await supabase.rpc('get_reports_by_viewer_token', { t: token })) as {
    data: ReportRow[] | null;
    error: { message: string } | null;
  };
  if (res.error) throw new Error(res.error.message);
  return (res.data ?? []).map((row) => normalizeReport(row.data));
}

/** 1件を作成/更新（id をキーに upsert。org_id 必須） */
export async function cloudUpsertReport(report: MaintenanceReport, orgId: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(REPORTS_TABLE).upsert({
    id: report.id,
    org_id: orgId,
    data: report,
    updated_at: report.updatedAt,
  });
  if (error) throw new Error(error.message);
}

/** 1件を削除 */
export async function cloudDeleteReport(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(REPORTS_TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
