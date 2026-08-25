import type { MaintenanceReport, PhotoCategory, ReportPhoto } from '@/types/report';

/** 旧分類（作業前/作業中/作業後）→ 新分類（施工前/施工中/施工後） */
const CATEGORY_MIGRATION: Record<string, PhotoCategory> = {
  作業前: '施工前',
  作業中: '施工中',
  作業後: '施工後',
};

function normPhotos(photos: ReportPhoto[] | undefined): ReportPhoto[] {
  return (photos ?? []).map((p) => {
    const migrated = CATEGORY_MIGRATION[p.category];
    return migrated ? { ...p, category: migrated } : p;
  });
}

/** 旧データ・外部データに不足フィールドを補完する */
export function normalizeReport(r: MaintenanceReport): MaintenanceReport {
  return {
    ...r,
    reportType: r.reportType === 'order' ? 'order' : 'maintenance',
    billingDone: r.billingDone ?? false,
    prevIssues: r.prevIssues ?? [],
    nextIssues: r.nextIssues ?? [],
    company: r.company ?? '',
    photos: normPhotos(r.photos),
    checklist: (r.checklist ?? []).map((c) => ({ ...c, photos: normPhotos(c.photos) })),
    pestControl: {
      basic: r.pestControl?.basic ?? false,
      antiDrug: r.pestControl?.antiDrug ?? false,
      strongPesticide: r.pestControl?.strongPesticide ?? false,
      presence: r.pestControl?.presence ?? '',
      photos: normPhotos(r.pestControl?.photos),
    },
    ratControl: {
      done: r.ratControl?.done ?? false,
      work: r.ratControl?.work ?? '',
      presence: r.ratControl?.presence ?? '',
      initialFee: r.ratControl?.initialFee ?? 0,
      monthlyFee: r.ratControl?.monthlyFee ?? 0,
      photos: normPhotos(r.ratControl?.photos),
    },
    diy: (r.diy ?? []).map((d) => ({ ...d, fee: d.fee ?? 0, photos: normPhotos(d.photos) })),
    annualSchedule: r.annualSchedule
      ? { ...r.annualSchedule, photos: normPhotos(r.annualSchedule.photos) }
      : { comment: '', fee: 0, photos: [] },
  };
}
