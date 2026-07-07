/**
 * 認証ストア（Supabase Auth）。クラウド有効時のみ使用。
 */
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

interface AuthState {
  session: Session | null;
  /** 初回のセッション確認が完了したか */
  ready: boolean;
  loading: boolean;
  error: string | null;

  init: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signOut: () => Promise<void>;
  clearError: () => void;
}

/** 閲覧専用（店長）アカウントか。app_metadata.role === 'viewer' で判定 */
export function sessionIsViewer(session: Session | null): boolean {
  const meta = session?.user.app_metadata as Record<string, unknown> | undefined;
  return meta?.role === 'viewer';
}

/** 現在のログインが閲覧専用かを返すフック */
export function useIsViewer(): boolean {
  return useAuthStore((s) => sessionIsViewer(s.session));
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  ready: false,
  loading: false,
  error: null,

  init: async () => {
    if (!supabase) {
      set({ ready: true });
      return;
    }
    const { data } = await supabase.auth.getSession();
    set({ session: data.session, ready: true });
    supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
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
    set({ session: data.session, loading: false });
    return true;
  },

  signOut: async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    set({ session: null });
  },

  clearError: () => set({ error: null }),
}));
