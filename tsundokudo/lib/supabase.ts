/**
 * Supabase クライアント。
 *
 * 環境変数（EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY）が
 * 設定されている場合のみ有効化される。未設定時は null（ローカル動作のまま）。
 */
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = String(process.env.EXPO_PUBLIC_SUPABASE_URL ?? '');
const anonKey = String(process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '');

/** クラウド（共有＋ログイン）が有効かどうか */
export const isSupabaseEnabled = Boolean(url && anonKey);

export const supabase: SupabaseClient | null = isSupabaseEnabled
  ? createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    })
  : null;

/** レポートを保存する共有テーブル名 */
export const REPORTS_TABLE = 'reports';
