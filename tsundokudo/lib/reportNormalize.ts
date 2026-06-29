import type { MaintenanceReport } from '@/types/report';

/** 旧データ・外部データに不足フィールドを補完する */
export function normalizeReport(r: MaintenanceReport): MaintenanceReport {
  return {
    ...r,
    photos: r.photos ?? [],
    diy: (r.diy ?? []).map((d) => ({ ...d, fee: d.fee ?? 0, photos: d.photos ?? [] })),
    annualSchedule: r.annualSchedule ?? { comment: '', fee: 0, photos: [] },
  };
}
