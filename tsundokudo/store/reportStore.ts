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
import { isCloudEnabled } from '@/lib/firebase';
import {
  cloudDeleteReport,
  cloudFetchReports,
  cloudUpsertReport,
} from '@/lib/cloudReports';
import { useAuthStore } from '@/store/authStore';
import { normalizeReport } from '@/lib/reportNormalize';
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
  /** 設定（マスタ）の読み込みが完了したか */
  settingsLoaded: boolean;
  /** 直近の保存エラー（容量超過など） */
  error: string | null;

  /** 起動時にストレージから読み込む */
  hydrate: () => Promise<void>;
  /** 設定（マスタ）のみ先に読み込む（承認待ち中の初期設定画面用） */
  hydrateSettings: () => Promise<void>;

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

/** クラウド保存時の組織ID（未所属ならエラー） */
function requireOrgId(): string {
  const org = useAuthStore.getState().org;
  if (!org) {
    throw new Error('組織情報が取得できません。一度ログアウトして再ログインしてください。');
  }
  return org.id;
}

/** 保存失敗時のメッセージ整形 */
function persistErrorMessage(e: unknown): string {
  const name = e instanceof Error ? e.name : '';
  if (name === 'QuotaExceededError') {
    return '保存容量の上限に達しました。写真の枚数を減らすか、古いレポートを削除してください。';
  }
  const detail = e instanceof Error ? e.message : String(e);
  return `保存に失敗しました。\n${detail}`;
}

/** 保存済み設定を読み込み、旧データの不足キーをデフォルトで補完する */
function normalizeSettings(raw: string | null): AppSettings {
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...parse<Partial<AppSettings>>(raw, {}),
  };
  settings.companies = settings.companies ?? [];
  settings.billingTos =
    settings.billingTos ?? (settings.defaultBillingTo ? [settings.defaultBillingTo] : []);
  // 既に既定値が入っている（＝以前から使っている）場合は初期設定済み扱い
  settings.setupDone =
    settings.setupDone ??
    (Boolean(settings.defaultBillingTo.trim()) || settings.technicians.length > 0);
  return settings;
}

export const useReportStore = create<ReportState>((set, get) => ({
  reports: [],
  settings: DEFAULT_SETTINGS,
  hydrated: false,
  settingsLoaded: false,
  error: null,

  hydrateSettings: async () => {
    if (get().settingsLoaded || get().hydrated) return;
    const settingsRaw = await persist.getItem(SETTINGS_KEY);
    set({ settings: normalizeSettings(settingsRaw), settingsLoaded: true });
  },

  hydrate: async () => {
    if (get().hydrated) return;
    // 設定（マスタ）は端末ローカルに保持
    const settingsRaw = await persist.getItem(SETTINGS_KEY);
    let settings = normalizeSettings(settingsRaw);

    if (isCloudEnabled) {
      // クラウド: 組織のレポートを取得（閲覧リンク時はゲスト組織のID）
      try {
        const auth = useAuthStore.getState();
        const orgId = auth.guestOrg?.orgId ?? auth.org?.id;
        const reports = orgId ? await cloudFetchReports(orgId) : [];
        // 取得したレポートから店舗・担当者をマスタへ取り込む
        for (const r of reports) settings = mergeMaster(settings, r);
        set({ reports, settings, hydrated: true, settingsLoaded: true });
      } catch (e) {
        set({
          hydrated: true,
          settingsLoaded: true,
          error: e instanceof Error ? e.message : 'データの取得に失敗しました。',
        });
      }
      return;
    }

    // ローカル: IndexedDB / MMKV から取得
    const reportsRaw = await persist.getItem(REPORTS_KEY);
    const reports = parse<MaintenanceReport[]>(reportsRaw, []).map(normalizeReport);
    set({ reports, settings, hydrated: true, settingsLoaded: true });
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
    const prevSettings = get().settings;
    set({ reports, settings, error: null });
    try {
      if (isCloudEnabled) {
        // 写真アップロード後（URL置換済み）のレポートで差し替える
        const saved = await cloudUpsertReport(report, requireOrgId());
        set({ reports: get().reports.map((r) => (r.id === saved.id ? saved : r)) });
      } else {
        await persist.setItem(REPORTS_KEY, JSON.stringify(reports));
      }
      if (settings !== prevSettings) {
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
    const prevSettings = get().settings;
    set({ reports, settings, error: null });
    try {
      if (isCloudEnabled) {
        if (updated) {
          const saved = await cloudUpsertReport(updated, requireOrgId());
          set({ reports: get().reports.map((r) => (r.id === saved.id ? saved : r)) });
        }
      } else {
        await persist.setItem(REPORTS_KEY, JSON.stringify(reports));
      }
      if (settings !== prevSettings) {
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
      if (isCloudEnabled) {
        await cloudDeleteReport(id, requireOrgId());
      } else {
        await persist.setItem(REPORTS_KEY, JSON.stringify(reports));
      }
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

/** レポートに含まれる店舗名・会社名・御請求先・担当者をマスタへ取り込む（重複は無視） */
function mergeMaster(settings: AppSettings, report: MaintenanceReport): AppSettings {
  let changed = false;
  const stores = [...settings.stores];
  const companies = [...(settings.companies ?? [])];
  const billingTos = [...(settings.billingTos ?? [])];
  const technicians = [...settings.technicians];

  if (report.storeName && !stores.includes(report.storeName)) {
    stores.push(report.storeName);
    changed = true;
  }
  if (report.company && !companies.includes(report.company)) {
    companies.push(report.company);
    changed = true;
  }
  const billingTo = report.billingTo.trim();
  if (billingTo && !billingTos.includes(billingTo)) {
    billingTos.push(billingTo);
    changed = true;
  }
  // 「、」区切りの複数担当者をそれぞれ取り込む
  for (const name of report.technician.split('、').map((s) => s.trim()).filter(Boolean)) {
    if (!technicians.includes(name)) {
      technicians.push(name);
      changed = true;
    }
  }
  return changed ? { ...settings, stores, companies, billingTos, technicians } : settings;
}
