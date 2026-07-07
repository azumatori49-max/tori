/**
 * 認証ストア（Supabase Auth）。クラウド有効時のみ使用。
 *
 * ログイン方法:
 *   - 担当者: メールアドレス＋パスワード（編集可）
 *   - 閲覧用: ログイン不要のゲスト閲覧モード（読み取りのみ。
 *     Supabase 側は anon の select ポリシーで許可し、書き込みは不可）
 */
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';
import { persist } from '@/lib/persist';

const GUEST_VIEWER_KEY = 'auth:guestViewer';

interface AuthState {
  session: Session | null;
  /** ログイン不要の閲覧モード中か */
  guestViewer: boolean;
  /** 初回のセッション確認が完了したか */
  ready: boolean;
  loading: boolean;
  error: string | null;

  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  /** ログイン不要の閲覧モードに入る */
  enterGuestViewer: () => void;
  /** ログアウト（ゲスト閲覧中は閲覧モードを終了してログイン画面へ） */
  signOut: () => Promise<void>;
  clearError: () => void;
}

/** 閲覧専用か（ゲスト閲覧、または app_metadata.role === 'viewer'） */
export function sessionIsViewer(session: Session | null): boolean {
  const meta = session?.user.app_metadata as Record<string, unknown> | undefined;
  return meta?.role === 'viewer';
}

/** 現在閲覧専用モードかを返すフック */
export function useIsViewer(): boolean {
  return useAuthStore((s) => s.guestViewer || sessionIsViewer(s.session));
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  guestViewer: false,
  ready: false,
  loading: false,
  error: null,

  init: async () => {
    if (!supabase) {
      set({ ready: true });
      return;
    }
    const [{ data }, guestFlag] = await Promise.all([
      supabase.auth.getSession(),
      persist.getItem(GUEST_VIEWER_KEY),
    ]);
    set({
      session: data.session,
      // ログイン済みならゲスト閲覧フラグは無視する
      guestViewer: !data.session && guestFlag === '1',
      ready: true,
    });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      if (session) set({ guestViewer: false });
    });
  },

  signIn: async (email, password) => {
    if (!supabase) return false;
    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      set({ loading: false, error: 'メールアドレスまたはパスワードが正しくありません。' });
      return false;
    }
    set({ session: data.session, guestViewer: false, loading: false });
    void persist.removeItem(GUEST_VIEWER_KEY);
    return true;
  },

  enterGuestViewer: () => {
    set({ guestViewer: true, error: null });
    void persist.setItem(GUEST_VIEWER_KEY, '1');
  },

  signOut: async () => {
    if (get().guestViewer) {
      set({ guestViewer: false });
      void persist.removeItem(GUEST_VIEWER_KEY);
      return;
    }
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ session: null });
  },

  clearError: () => set({ error: null }),
}));
