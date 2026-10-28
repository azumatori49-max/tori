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
import { cloudDeleteReport, cloudFetchReports, cloudUpsertReport } from '@/lib/cloudReports';
import { useAuthStore } from '@/store/authStore';
import { normalizeReport } from '@/lib/reportNormalize';
import { DEFAULT_SETTINGS, makeDefaultReport } from '@/constants/hygiene';
import type { AppSettings, MaintenanceReport, MaintenanceReportInsert } from '@/types/report';

const REPORTS_KEY = 'hygiene:reports';
const SETTINGS_KEY = 'hygiene:settings';
let mutationPending = false;
let hydrationVersion = 0;

function dataScope(): string | undefined {
  if (!isCloudEnabled) return 'local';
  const a = useAuthStore.getState();
  return a.guestOrg?.orgId ?? a.org?.id;
}

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
    const scope = dataScope();
    const version = ++hydrationVersion;
    if (!scope) return;
    try {
      const settingsRaw = await persist.getItem(SETTINGS_KEY);
      let settings = normalizeSettings(settingsRaw);
      const reports = isCloudEnabled
        ? await cloudFetchReports(scope)
        : (JSON.parse((await persist.getItem(REPORTS_KEY)) ?? '[]') as MaintenanceReport[]).map(
            normalizeReport,
          );
      if (dataScope() !== scope || version !== hydrationVersion) return;
      for (const r of reports) settings = mergeMaster(settings, r);
      set({ reports, settings, hydrated: true, settingsLoaded: true, error: null });
    } catch (e) {
      if (dataScope() !== scope || version !== hydrationVersion) return;
      set({ error: e instanceof Error ? e.message : 'データの取得に失敗しました。' });
    }
  },

  getReport: (id) => get().reports.find((r) => r.id === id),

  reportsByStore: (storeName) => {
    const list = storeName ? get().reports.filter((r) => r.storeName === storeName) : get().reports;
    return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  },

  createReport: async (data) => {
    if (!get().hydrated || mutationPending) {
      set({ error: '読み込み中または保存中です。完了後にもう一度保存してください。' });
      return false;
    }
    mutationPending = true;
    const scope = dataScope();
    try {
      const now = new Date().toISOString();
      let report: MaintenanceReport = { ...data, id: uuid(), createdAt: now, updatedAt: now };
      if (isCloudEnabled) report = await cloudUpsertReport(report, requireOrgId());
      const reports = [report, ...get().reports];
      if (!isCloudEnabled) await persist.setItem(REPORTS_KEY, JSON.stringify(reports));
      if (dataScope() === scope) {
        const settings = mergeMaster(get().settings, report);
        set({ reports, settings, error: null });
        // 本文の保存成功をマスタ保存の失敗で取り消さない。
        void persist.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {
          set({ error: '記録は保存済みですが、候補一覧の保存に失敗しました。' });
        });
      }
      return true;
    } catch (e) {
      set({ error: persistErrorMessage(e) });
      return false;
    } finally {
      mutationPending = false;
    }
  },

  updateReport: async (id, data) => {
    if (!get().hydrated || mutationPending) {
      set({ error: '読み込み中または保存中です。完了後にもう一度保存してください。' });
      return false;
    }
    const previous = get().reports.find((r) => r.id === id);
    if (!previous) {
      set({ error: '更新対象の記録が見つかりません。再読み込みしてください。' });
      return false;
    }
    mutationPending = true;
    const scope = dataScope();
    try {
      let report = { ...previous, ...data, updatedAt: new Date().toISOString() };
      if (isCloudEnabled) report = await cloudUpsertReport(report, requireOrgId());
      const reports = get().reports.map((r) => (r.id === id ? report : r));
      if (!isCloudEnabled) await persist.setItem(REPORTS_KEY, JSON.stringify(reports));
      if (dataScope() === scope) {
        const settings = mergeMaster(get().settings, report);
        set({ reports, settings, error: null });
        void persist.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(() => {
          set({ error: '記録は保存済みですが、候補一覧の保存に失敗しました。' });
        });
      }
      return true;
    } catch (e) {
      set({ error: persistErrorMessage(e) });
      return false;
    } finally {
      mutationPending = false;
    }
  },

  deleteReport: async (id) => {
    if (!get().hydrated || mutationPending) {
      set({ error: '読み込み中または保存中です。完了後にもう一度操作してください。' });
      return false;
    }
    mutationPending = true;
    const scope = dataScope();
    try {
      if (isCloudEnabled) await cloudDeleteReport(id, requireOrgId());
      const reports = get().reports.filter((r) => r.id !== id);
      if (!isCloudEnabled) await persist.setItem(REPORTS_KEY, JSON.stringify(reports));
      if (dataScope() === scope) set({ reports, error: null });
      return true;
    } catch (e) {
      set({ error: persistErrorMessage(e) });
      return false;
    } finally {
      mutationPending = false;
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
  for (const name of report.technician
    .split('、')
    .map((s) => s.trim())
    .filter(Boolean)) {
    if (!technicians.includes(name)) {
      technicians.push(name);
      changed = true;
    }
  }
  return changed ? { ...settings, stores, companies, billingTos, technicians } : settings;
}
