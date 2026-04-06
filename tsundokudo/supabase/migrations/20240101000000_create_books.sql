-- ============================================================
-- Migration: 001 - Create books table
-- Design doc: 3-1
-- ============================================================

-- reading_status enum（冪等: 既存なら作成しない）
DO $$ BEGIN
  CREATE TYPE reading_status AS ENUM (
    'unread',     -- 未読
    'reading',    -- 読書中
    'completed',  -- 読了
    'paused'      -- 一時停止
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- books テーブル
-- ============================================================
CREATE TABLE IF NOT EXISTS books (
  id             UUID            NOT NULL DEFAULT gen_random_uuid(),
  user_id        UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  isbn           VARCHAR(20)     NULL,
  title          TEXT            NOT NULL CHECK (char_length(title) BETWEEN 1 AND 500),
  author         TEXT            NULL,
  publisher      TEXT            NULL,
  published_at   DATE            NULL,
  cover_url      TEXT            NULL,
  total_pages    INTEGER         NULL CHECK (total_pages > 0),
  current_page   INTEGER         NULL CHECK (current_page >= 0),
  reading_status reading_status  NOT NULL DEFAULT 'unread',
  rating         SMALLINT        NULL CHECK (rating BETWEEN 1 AND 5),
  memo           TEXT            NULL,
  tags           TEXT[]          NOT NULL DEFAULT '{}',
  created_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ     NOT NULL DEFAULT now(),

  CONSTRAINT books_pkey
    PRIMARY KEY (id),

  -- current_page は total_pages を超えない
  CONSTRAINT books_current_page_within_total
    CHECK (current_page IS NULL OR total_pages IS NULL OR current_page <= total_pages)
);

-- ============================================================
-- インデックス
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_books_user_id
  ON books (user_id);

CREATE INDEX IF NOT EXISTS idx_books_user_status
  ON books (user_id, reading_status);

CREATE INDEX IF NOT EXISTS idx_books_user_created
  ON books (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_books_isbn
  ON books (isbn)
  WHERE isbn IS NOT NULL;

-- tags の全文検索用 GIN インデックス
CREATE INDEX IF NOT EXISTS idx_books_tags
  ON books USING GIN (tags);

-- ============================================================
-- updated_at 自動更新トリガー
-- ============================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS books_set_updated_at ON books;
CREATE TRIGGER books_set_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- 既存ポリシーを削除してから再作成（冪等）
DROP POLICY IF EXISTS "books_select_own" ON books;
DROP POLICY IF EXISTS "books_insert_own" ON books;
DROP POLICY IF EXISTS "books_update_own" ON books;
DROP POLICY IF EXISTS "books_delete_own" ON books;

CREATE POLICY "books_select_own" ON books
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "books_insert_own" ON books
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "books_update_own" ON books
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "books_delete_own" ON books
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================
-- テーブル・カラムコメント
-- ============================================================
COMMENT ON TABLE  books                IS '積読・読書管理テーブル (設計書3-1)';
COMMENT ON COLUMN books.id             IS 'UUID主キー';
COMMENT ON COLUMN books.user_id        IS 'Supabase auth.usersへのFK。RLSにより自分のレコードのみ操作可';
COMMENT ON COLUMN books.isbn           IS 'ISBN-10またはISBN-13（ハイフンなし）';
COMMENT ON COLUMN books.title          IS '書籍タイトル（1-500文字）';
COMMENT ON COLUMN books.author         IS '著者名';
COMMENT ON COLUMN books.publisher      IS '出版社名';
COMMENT ON COLUMN books.published_at   IS '出版日';
COMMENT ON COLUMN books.cover_url      IS '表紙画像URL（Storage or 外部URL）';
COMMENT ON COLUMN books.total_pages    IS '総ページ数（正の整数）';
COMMENT ON COLUMN books.current_page   IS '現在のページ（0以上 total_pages以下）';
COMMENT ON COLUMN books.reading_status IS '読書ステータス: unread/reading/completed/paused';
COMMENT ON COLUMN books.rating         IS '5段階評価（1-5）';
COMMENT ON COLUMN books.memo           IS '読書メモ・感想';
COMMENT ON COLUMN books.tags           IS 'タグ配列（GINインデックス付き）';
COMMENT ON COLUMN books.created_at     IS '作成日時（UTC）';
COMMENT ON COLUMN books.updated_at     IS '更新日時（UTC）。トリガーにより自動セット';
