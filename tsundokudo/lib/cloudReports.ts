/**
 * Supabase 上の共有レポート（reports テーブル）へのアクセス。
 * クラウド有効時のみ利用される。
 */
import { REPORTS_TABLE, supabase } from '@/lib/supabase';
import { normalizeReport } from '@/lib/reportNormalize';
import type { MaintenanceReport } from '@/types/report';

interface ReportRow {
  id: string;
  data: MaintenanceReport;
  created_at: string;
  updated_at: string;
}

/** 全レポートを新しい順に取得 */
export async function cloudFetchReports(): Promise<MaintenanceReport[]> {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from(REPORTS_TABLE)
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return ((data as ReportRow[] | null) ?? []).map((row) => normalizeReport(row.data));
}

/** 1件を作成/更新（id をキーに upsert） */
export async function cloudUpsertReport(report: MaintenanceReport): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase
    .from(REPORTS_TABLE)
    .upsert({ id: report.id, data: report, updated_at: report.updatedAt });
  if (error) throw new Error(error.message);
}

/** 1件を削除 */
export async function cloudDeleteReport(id: string): Promise<void> {
  if (!supabase) return;
  const { error } = await supabase.from(REPORTS_TABLE).delete().eq('id', id);
  if (error) throw new Error(error.message);
}
