export type ReadingStatus = 'unread' | 'reading' | 'completed' | 'paused';

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      books: {
        Row: Book;
        Insert: BookInsert;
        Update: BookUpdate;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: {
      reading_status: ReadingStatus;
    };
  };
}

/** booksテーブルの完全な行型 */
export interface Book {
  id: string;
  user_id: string;
  isbn: string | null;
  title: string;
  author: string | null;
  publisher: string | null;
  published_at: string | null;
  cover_url: string | null;
  total_pages: number | null;
  current_page: number | null;
  reading_status: ReadingStatus;
  rating: number | null;
  memo: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

/** INSERT時の型（id, created_at, updated_atは自動生成） */
export interface BookInsert {
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
  created_at?: string;
  updated_at?: string;
}

/** UPDATE時の型（すべてoptional） */
export type BookUpdate = Partial<BookInsert>;
