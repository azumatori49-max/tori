// ============================================================
// Supabase Database 型定義
// 設計書3-1 / books テーブル
//
// NOTE: Supabase の内部型 GenericTable は
// `Row extends Record<string, unknown>` を条件型でチェックする。
// TypeScript の仕様上、`interface` 型はこのチェックで false になるため、
// Row / Insert / Update はすべて `type` (オブジェクト型リテラル) で定義する。
// ============================================================

export type ReadingStatus = 'unread' | 'reading' | 'completed' | 'paused';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ---------------------------------------------------------------
// Supabase クライアント用ジェネリック型
// ---------------------------------------------------------------
export type Database = {
  public: {
    Tables: {
      books: {
        Row: Book;
        Insert: BookInsert;
        Update: BookUpdate;
        Relationships: [];
      };
    };
    Views: Record<never, never>;
    Functions: Record<never, never>;
    Enums: {
      reading_status: ReadingStatus;
    };
    CompositeTypes: Record<never, never>;
  };
};

// ---------------------------------------------------------------
// Row: booksテーブルの完全な行型（SELECT結果）
// interface ではなく type を使うこと（Supabase GenericTable との互換性）
// ---------------------------------------------------------------
export type Book = {
  id: string;
  user_id: string;
  isbn: string | null;
  title: string;
  author: string | null;
  publisher: string | null;
  published_at: string | null;  // ISO 8601 date string (YYYY-MM-DD)
  cover_url: string | null;
  total_pages: number | null;
  current_page: number | null;
  reading_status: ReadingStatus;
  rating: number | null;        // 1–5
  memo: string | null;
  tags: string[];
  created_at: string;           // ISO 8601 datetime string
  updated_at: string;           // ISO 8601 datetime string
};

// ---------------------------------------------------------------
// Insert: INSERT時の型
// id / created_at / updated_at はDBが自動生成するためoptional
// user_id は必須（RLSの主体）
// ---------------------------------------------------------------
export type BookInsert = {
  id?: string;
  user_id: string;
  isbn?: string | null;
  title: string;
  author?: string | null;
  publisher?: string | null;
  published_at?: string | null;
  cover_url?: string | null;
  total_pages?: number | null;
  current_page?: number | null;
  reading_status?: ReadingStatus;
  rating?: number | null;
  memo?: string | null;
  tags?: string[];
};

// ---------------------------------------------------------------
// Update: UPDATE時の型
// サーバー管理フィールド（id / user_id / created_at / updated_at）は除外
// ---------------------------------------------------------------
export type BookUpdate = Partial<Omit<BookInsert, 'id' | 'user_id'>>;

// ---------------------------------------------------------------
// ヘルパー型
// ---------------------------------------------------------------

/** ステータス別フィルタリング用 */
export type BookFilters = {
  status?: ReadingStatus;
  tags?: string[];
  query?: string;  // title / author の部分一致
};

/** ページ進捗（0.0〜1.0） */
export type ReadingProgress = number & { readonly __brand: 'ReadingProgress' };

export function calcReadingProgress(book: Book): ReadingProgress | null {
  if (book.total_pages == null || book.current_page == null || book.total_pages === 0) {
    return null;
  }
  const ratio = book.current_page / book.total_pages;
  return Math.min(1, Math.max(0, ratio)) as ReadingProgress;
}
