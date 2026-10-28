import type { MaintenanceReport } from '@/types/report';

/** 過去の記録で会社との所属が確認できる店舗だけを候補にする。 */
export function companyStores(
  reports: Pick<MaintenanceReport, 'company' | 'storeName'>[],
  company: string,
): string[] {
  if (!company.trim()) return [];
  return [
    ...new Set(
      reports
        .filter((r) => r.company.trim() === company.trim())
        .map((r) => r.storeName.trim())
        .filter(Boolean),
    ),
  ].sort((a, b) => a.localeCompare(b, 'ja'));
}
