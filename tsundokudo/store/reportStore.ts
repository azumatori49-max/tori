/**
 * 衛生管理レポート ストア（Zustand + 非同期永続化）
 *
 * 保存先:
 *   - Web: IndexedDB（写真base64も保存可能。localStorageの容量制限を回避）
 *   - ネイティブ: MMKV
 * 将来的に Supabase 等へ同期する場合は CRUD 内に送信処理を足せばよい。
 */
import { create } from 'zustand';

import { persist } from '@/lib/persist';
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

function parse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

interface ReportState {
  reports: MaintenanceReport[];
  settings: AppSettings;
  hydrated: boolean;
  /** 直近の保存エラー（容量超過など） */
  error: string | null;

  /** 起動時にストレージから読み込む */
  hydrate: () => Promise<void>;

  // CRUD（成功で true / 失敗で false）
  getReport: (id: string) => MaintenanceReport | undefined;
  reportsByStore: (storeName?: string) => MaintenanceReport[];
  createReport: (data: MaintenanceReportInsert) => Promise<boolean>;
  updateReport: (id: string, data: Partial<MaintenanceReportInsert>) => Promise<boolean>;
  deleteReport: (id: string) => Promise<boolean>;
  draftReport: () => MaintenanceReportInsert;

  updateSettings: (data: Partial<AppSettings>) => void;
  clearError: () => void;
}

/** 保存失敗時のメッセージ整形 */
function persistErrorMessage(e: unknown): string {
  const name = e instanceof Error ? e.name : '';
  if (name === 'QuotaExceededError') {
    return '保存容量の上限に達しました。写真の枚数を減らすか、古いレポートを削除してください。';
  }
  return '保存に失敗しました。時間をおいて再度お試しください。';
}

export const useReportStore = create<ReportState>((set, get) => ({
  reports: [],
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  error: null,

  hydrate: async () => {
    if (get().hydrated) return;
    const [reportsRaw, settingsRaw] = await Promise.all([
      persist.getItem(REPORTS_KEY),
      persist.getItem(SETTINGS_KEY),
    ]);
    const raw = parse<MaintenanceReport[]>(reportsRaw, []);
    // 旧バージョンのデータに不足フィールドを補完
    const reports = raw.map((r) => ({
      ...r,
      photos: r.photos ?? [],
      diy: (r.diy ?? []).map((d) => ({ ...d, fee: d.fee ?? 0, photos: d.photos ?? [] })),
      annualSchedule: r.annualSchedule ?? { comment: '', fee: 0, photos: [] },
    }));
    const settings = parse<AppSettings>(settingsRaw, DEFAULT_SETTINGS);
    set({ reports, settings, hydrated: true });
  },

  getReport: (id) => get().reports.find((r) => r.id === id),

  reportsByStore: (storeName) => {
    const list = storeName
      ? get().reports.filter((r) => r.storeName === storeName)
      : get().reports;
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  createReport: async (data) => {
    const now = new Date().toISOString();
    const report: MaintenanceReport = {
      ...data,
      id: uuid(),
      createdAt: now,
      updatedAt: now,
    };
    const prev = get().reports;
    const reports = [report, ...prev];
    const settings = mergeMaster(get().settings, report);
    set({ reports, settings, error: null });
    try {
      await persist.setItem(REPORTS_KEY, JSON.stringify(reports));
      if (settings !== get().settings) {
        await persist.setItem(SETTINGS_KEY, JSON.stringify(settings));
      }
      return true;
    } catch (e) {
      set({ reports: prev, error: persistErrorMessage(e) });
      return false;
    }
  },

  updateReport: async (id, data) => {
    const prev = get().reports;
    const reports = prev.map((r) =>
      r.id === id ? { ...r, ...data, updatedAt: new Date().toISOString() } : r,
    );
    const updated = reports.find((r) => r.id === id);
    const settings = updated ? mergeMaster(get().settings, updated) : get().settings;
    set({ reports, settings, error: null });
    try {
      await persist.setItem(REPORTS_KEY, JSON.stringify(reports));
      if (settings !== get().settings) {
        await persist.setItem(SETTINGS_KEY, JSON.stringify(settings));
      }
      return true;
    } catch (e) {
      set({ reports: prev, error: persistErrorMessage(e) });
      return false;
    }
  },

  deleteReport: async (id) => {
    const prev = get().reports;
    const reports = prev.filter((r) => r.id !== id);
    set({ reports, error: null });
    try {
      await persist.setItem(REPORTS_KEY, JSON.stringify(reports));
      return true;
    } catch (e) {
      set({ reports: prev, error: persistErrorMessage(e) });
      return false;
    }
  },

  draftReport: () => makeDefaultReport(get().settings),

  updateSettings: (data) => {
    const settings = { ...get().settings, ...data };
    set({ settings });
    void persist.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {
      set({ error: '設定の保存に失敗しました。' });
    });
  },

  clearError: () => set({ error: null }),
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
  // 「、」区切りの複数担当者をそれぞれ取り込む
  for (const name of report.technician.split('、').map((s) => s.trim()).filter(Boolean)) {
    if (!technicians.includes(name)) {
      technicians.push(name);
      changed = true;
    }
  }
  return changed ? { ...settings, stores, technicians } : settings;
}
