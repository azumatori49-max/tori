/**
 * 認証・組織ストア（Supabase）。クラウド有効時のみ使用。
 *
 * マルチテナント:
 *   - ログインユーザーは「組織（会社）」に所属し、データは組織ごとに分離される
 *   - 新規登録後は「組織を作成」or「招待コードで参加」
 *   - 閲覧は組織ごとの閲覧用リンク（トークン）から。ログイン不要・読み取りのみ
 */
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { persist } from '@/lib/persist';

const GUEST_ORG_KEY = 'auth:guestOrg';

export interface OrgInfo {
  id: string;
  name: string;
  role: 'admin' | 'member';
  inviteCode: string;
  viewerToken: string;
}

interface GuestOrg {
  token: string;
  name: string;
}

interface OrgRow {
  id: string;
  name: string;
  role: string;
  invite_code: string;
  viewer_token: string;
}

function toOrgInfo(row: OrgRow): OrgInfo {
  return {
    id: row.id,
    name: row.name,
    role: row.role === 'admin' ? 'admin' : 'member',
    inviteCode: row.invite_code,
    viewerToken: row.viewer_token,
  };
}

/** このアプリの公開URL（GitHub Pages はサブパス /tori 付き） */
function appOrigin(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  const sub = window.location.hostname.endsWith('github.io') ? '/tori' : '';
  return window.location.origin + sub;
}

interface RpcResult<T> {
  data: T | T[] | null;
  error: { message: string } | null;
}

/** RPC を呼び、先頭行を返す（supabase-js の rpc は単一行/配列どちらもあり得る） */
async function rpcRow<T>(fn: string, args?: Record<string, unknown>): Promise<T | null> {
  if (!supabase) return null;
  const res = (await supabase.rpc(fn, args)) as RpcResult<T>;
  if (res.error) return null;
  const row = Array.isArray(res.data) ? res.data[0] : res.data;
  return row ?? null;
}

interface AuthState {
  session: Session | null;
  /** 所属組織（未所属なら null） */
  org: OrgInfo | null;
  /** 所属確認が完了したか（ログイン後） */
  orgChecked: boolean;
  /** 閲覧用リンクで開いているゲスト状態 */
  guestOrg: GuestOrg | null;
  /** 初回のセッション確認が完了したか */
  ready: boolean;
  loading: boolean;
  error: string | null;

  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  /** 新規登録。'ok'=即ログイン / 'confirm'=確認メール送信 / 'error' */
  signUp: (email: string, password: string) => Promise<'ok' | 'confirm' | 'error'>;
  /** 組織を新規作成（作成者はadmin） */
  createOrg: (name: string) => Promise<boolean>;
  /** 招待コードで組織に参加 */
  joinOrg: (code: string) => Promise<boolean>;
  /** 閲覧用リンクのトークンでゲスト閲覧を開始 */
  enterGuestByToken: (token: string) => Promise<boolean>;
  /** 招待コード/閲覧リンクの再発行（adminのみ） */
  rotateOrgCode: (kind: 'invite' | 'viewer') => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

/** 現在閲覧専用モードか（閲覧リンクで開いている） */
export function useIsViewer(): boolean {
  return useAuthStore((s) => s.guestOrg != null);
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  org: null,
  orgChecked: false,
  guestOrg: null,
  ready: false,
  loading: false,
  error: null,

  init: async () => {
    if (!supabase) {
      set({ ready: true, orgChecked: true });
      return;
    }
    const [{ data }, guestRaw] = await Promise.all([
      supabase.auth.getSession(),
      persist.getItem(GUEST_ORG_KEY),
    ]);
    let guestOrg: GuestOrg | null = null;
    if (!data.session && guestRaw) {
      try {
        guestOrg = JSON.parse(guestRaw) as GuestOrg;
      } catch {
        guestOrg = null;
      }
    }
    set({ session: data.session, guestOrg });
    if (data.session) {
      await loadOrg(set);
    } else {
      set({ orgChecked: true });
    }
    set({ ready: true });

    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      if (session) {
        set({ guestOrg: null, orgChecked: false });
        void persist.removeItem(GUEST_ORG_KEY);
        void loadOrg(set);
      } else {
        set({ org: null, orgChecked: true });
      }
    });
  },

  signIn: async (email, password) => {
    if (!supabase) return false;
    set({ loading: true, error: null });
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      set({ loading: false, error: 'メールアドレスまたはパスワードが正しくありません。' });
      return false;
    }
    set({ loading: false });
    return true;
  },

  signUp: async (email, password) => {
    if (!supabase) return 'error';
    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // 確認メールのリンクからこのアプリのURLへ戻す（localhostへ飛ぶのを防ぐ）
      options: { emailRedirectTo: appOrigin() },
    });
    if (error) {
      set({
        loading: false,
        error: error.message.includes('at least')
          ? 'パスワードは6文字以上にしてください。'
          : '登録に失敗しました。すでに登録済みの可能性があります。',
      });
      return 'error';
    }
    set({ loading: false });
    return data.session ? 'ok' : 'confirm';
  },

  createOrg: async (name) => {
    if (!supabase) return false;
    set({ loading: true, error: null });
    const row = await rpcRow<OrgRow>('create_org', { org_name: name.trim() });
    if (!row) {
      set({ loading: false, error: '会社の作成に失敗しました。' });
      return false;
    }
    set({ org: toOrgInfo(row), orgChecked: true, loading: false });
    return true;
  },

  joinOrg: async (code) => {
    if (!supabase) return false;
    set({ loading: true, error: null });
    const row = await rpcRow<OrgRow>('join_org', { code: code.trim() });
    if (!row) {
      set({ loading: false, error: '招待コードが正しくありません。' });
      return false;
    }
    set({ org: toOrgInfo(row), orgChecked: true, loading: false });
    return true;
  },

  enterGuestByToken: async (token) => {
    if (!supabase) return false;
    const t = token.trim();
    if (!t) return false;
    const row = await rpcRow<{ id: string; name: string }>('get_org_by_viewer_token', { t });
    if (!row) return false;
    const guestOrg: GuestOrg = { token: t, name: row.name };
    set({ guestOrg });
    void persist.setItem(GUEST_ORG_KEY, JSON.stringify(guestOrg));
    return true;
  },

  rotateOrgCode: async (kind) => {
    const org = get().org;
    if (!supabase || !org) return false;
    const row = await rpcRow<OrgRow>('rotate_org_code', { p_org: org.id, kind });
    if (!row) {
      set({ error: '再発行に失敗しました。' });
      return false;
    }
    set({ org: toOrgInfo(row) });
    return true;
  },

  signOut: async () => {
    if (get().guestOrg) {
      set({ guestOrg: null });
      void persist.removeItem(GUEST_ORG_KEY);
      return;
    }
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ session: null, org: null });
  },

  clearError: () => set({ error: null }),
}));

/** 所属組織を取得して state に反映 */
async function loadOrg(set: (partial: Partial<AuthState>) => void): Promise<void> {
  if (!supabase) return;
  const row = await rpcRow<OrgRow>('my_org');
  set(row ? { org: toOrgInfo(row), orgChecked: true } : { org: null, orgChecked: true });
}
