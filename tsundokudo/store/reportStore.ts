/**
 * 衛生管理レポート ストア（Zustand + MMKV ローカル永続化）
 *
 * バックエンド不要で動くローカルファースト構成。
 * 将来的に Supabase 等へ同期する場合は CRUD 内に送信処理を足せばよい。
 */
import { create } from 'zustand';

import { storage } from '@/lib/mmkv';
import { DEFAULT_SETTINGS, makeDefaultReport } from '@/constants/hygiene';
import type {
  AppSettings,
  MaintenanceReport,
  MaintenanceReportInsert,
} from '@/types/report';

const REPORTS_KEY = 'hygiene:reports';
const SETTINGS_KEY = 'hygiene:settings';

function uuid(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function load<T>(key: string, fallback: T): T {
  const raw = storage.getString(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function save<T>(key: string, value: T): void {
  storage.set(key, JSON.stringify(value));
}

interface ReportState {
  reports: MaintenanceReport[];
  settings: AppSettings;
  hydrated: boolean;

  /** 起動時にローカルストレージから読み込む */
  hydrate: () => void;

  // CRUD
  getReport: (id: string) => MaintenanceReport | undefined;
  /** 店舗名でフィルタした一覧（新しい順） */
  reportsByStore: (storeName?: string) => MaintenanceReport[];
  createReport: (data: MaintenanceReportInsert) => MaintenanceReport;
  updateReport: (id: string, data: Partial<MaintenanceReportInsert>) => void;
  deleteReport: (id: string) => void;
  /** マスタ既定値から空のレポート雛形を作る（保存はしない） */
  draftReport: () => MaintenanceReportInsert;

  // 設定
  updateSettings: (data: Partial<AppSettings>) => void;
}

export const useReportStore = create<ReportState>((set, get) => ({
  reports: [],
  settings: DEFAULT_SETTINGS,
  hydrated: false,

  hydrate: () => {
    if (get().hydrated) return;
    const raw = load<MaintenanceReport[]>(REPORTS_KEY, []);
    // 旧バージョンのデータに不足フィールドを補完
    const reports = raw.map((r) => ({
      ...r,
      photos: r.photos ?? [],
      diy: (r.diy ?? []).map((d) => ({ ...d, fee: d.fee ?? 0, photos: d.photos ?? [] })),
      annualSchedule: r.annualSchedule ?? { comment: '', fee: 0, photos: [] },
    }));
    const settings = load<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
    set({ reports, settings, hydrated: true });
  },

  getReport: (id) => get().reports.find((r) => r.id === id),

  reportsByStore: (storeName) => {
    const list = storeName
      ? get().reports.filter((r) => r.storeName === storeName)
      : get().reports;
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  createReport: (data) => {
    const now = new Date().toISOString();
    const report: MaintenanceReport = {
      ...data,
      id: uuid(),
      createdAt: now,
      updatedAt: now,
    };
    set((s) => {
      const reports = [report, ...s.reports];
      save(REPORTS_KEY, reports);
      // 新しい店舗・担当者をマスタに自動追加
      const settings = mergeMaster(s.settings, report);
      if (settings !== s.settings) save(SETTINGS_KEY, settings);
      return { reports, settings };
    });
    return report;
  },

  updateReport: (id, data) => {
    set((s) => {
      const reports = s.reports.map((r) =>
        r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r,
      );
      save(REPORTS_KEY, reports);
      const updated = reports.find((r) => r.id === id);
      const settings = updated ? mergeMaster(s.settings, updated) : s.settings;
      if (settings !== s.settings) save(SETTINGS_KEY, settings);
      return { reports, settings };
    });
  },

  deleteReport: (id) => {
    set((s) => {
      const reports = s.reports.filter((r) => r.id !== id);
      save(REPORTS_KEY, reports);
      return { reports };
    });
  },

  draftReport: () => makeDefaultReport(get().settings),

  updateSettings: (data) => {
    set((s) => {
      const settings = { ...s.settings, ...data };
      save(SETTINGS_KEY, settings);
      return { settings };
    });
  },
}));

/** レポートに含まれる店舗名・担当者をマスタへ取り込む（重複は無視） */
function mergeMaster(settings: AppSettings, report: MaintenanceReport): AppSettings {
  let changed = false;
  const stores = [...settings.stores];
  const technicians = [...settings.technicians];

  if (report.storeName && !stores.includes(report.storeName)) {
    stores.push(report.storeName);
    changed = true;
  }
  if (report.technician && !technicians.includes(report.technician)) {
    technicians.push(report.technician);
    changed = true;
  }
  return changed ? { ...settings, stores, technicians } : settings;
}
