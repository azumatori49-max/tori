import type { MaintenanceReport } from '@/types/report';

/** 旧データ・外部データに不足フィールドを補完する */
export function normalizeReport(r: MaintenanceReport): MaintenanceReport {
  return {
    ...r,
    company: r.company ?? '',
    photos: r.photos ?? [],
    checklist: (r.checklist ?? []).map((c) => ({ ...c, photos: c.photos ?? [] })),
    pestControl: {
      basic: r.pestControl?.basic ?? false,
      antiDrug: r.pestControl?.antiDrug ?? false,
      strongPesticide: r.pestControl?.strongPesticide ?? false,
      presence: r.pestControl?.presence ?? '',
      photos: r.pestControl?.photos ?? [],
    },
    diy: (r.diy ?? []).map((d) => ({ ...d, fee: d.fee ?? 0, photos: d.photos ?? [] })),
    annualSchedule: r.annualSchedule ?? { comment: '', fee: 0, photos: [] },
  };
}
