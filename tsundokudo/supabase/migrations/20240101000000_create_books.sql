-- ============================================================
-- Migration: 001 - Create books table
-- Design doc: 3-1
-- ============================================================

-- 読書ステータスの enum 型
CREATE TYPE reading_status AS ENUM (
  'unread',     -- 未読
  'reading',    -- 読書中
  'completed',  -- 読了
  'paused'      -- 一時停止
);

-- books テーブル
CREATE TABLE IF NOT EXISTS books (
  id            UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID            NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  isbn          VARCHAR(20)     NULL,
  title         TEXT            NOT NULL,
  author        TEXT            NULL,
  publisher     TEXT            NULL,
  published_at  DATE            NULL,
  cover_url     TEXT            NULL,
  total_pages   INTEGER         NULL CHECK (total_pages > 0),
  current_page  INTEGER         NULL CHECK (current_page >= 0),
  reading_status reading_status NOT NULL DEFAULT 'unread',
  rating        SMALLINT        NULL CHECK (rating BETWEEN 1 AND 5),
  memo          TEXT            NULL,
  tags          TEXT[]          NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ     NOT NULL DEFAULT now(),

  -- current_page は total_pages を超えない
  CONSTRAINT current_page_within_total
    CHECK (current_page IS NULL OR total_pages IS NULL OR current_page <= total_pages)
);

-- インデックス
CREATE INDEX idx_books_user_id         ON books (user_id);
CREATE INDEX idx_books_reading_status  ON books (user_id, reading_status);
CREATE INDEX idx_books_created_at      ON books (user_id, created_at DESC);
CREATE INDEX idx_books_isbn            ON books (isbn) WHERE isbn IS NOT NULL;
CREATE INDEX idx_books_tags            ON books USING GIN (tags);

-- updated_at を自動更新するトリガー
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER books_updated_at
  BEFORE UPDATE ON books
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- Row Level Security (RLS)
-- ============================================================
ALTER TABLE books ENABLE ROW LEVEL SECURITY;

-- 自分のレコードのみ SELECT 可
CREATE POLICY "books_select_own" ON books
  FOR SELECT USING (auth.uid() = user_id);

-- 自分のレコードとして INSERT 可
CREATE POLICY "books_insert_own" ON books
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 自分のレコードのみ UPDATE 可
CREATE POLICY "books_update_own" ON books
  FOR UPDATE USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 自分のレコードのみ DELETE 可
CREATE POLICY "books_delete_own" ON books
  FOR DELETE USING (auth.uid() = user_id);

-- ============================================================
-- コメント
-- ============================================================
COMMENT ON TABLE  books                IS '積読・読書管理テーブル';
COMMENT ON COLUMN books.id             IS 'UUID主キー (auto-generated)';
COMMENT ON COLUMN books.user_id        IS 'Supabase Authのユーザーid (FK)';
COMMENT ON COLUMN books.isbn           IS 'ISBN-10またはISBN-13';
COMMENT ON COLUMN books.title          IS '書籍タイトル';
COMMENT ON COLUMN books.author         IS '著者名';
COMMENT ON COLUMN books.publisher      IS '出版社';
COMMENT ON COLUMN books.published_at   IS '出版日';
COMMENT ON COLUMN books.cover_url      IS '表紙画像URL';
COMMENT ON COLUMN books.total_pages    IS '総ページ数';
COMMENT ON COLUMN books.current_page   IS '現在のページ数';
COMMENT ON COLUMN books.reading_status IS '読書ステータス (unread/reading/completed/paused)';
COMMENT ON COLUMN books.rating         IS '評価 (1-5)';
COMMENT ON COLUMN books.memo           IS'読書メモ・感想';
COMMENT ON COLUMN books.tags           IS 'タグ配列';
COMMENT ON COLUMN books.created_at     IS '作成日時';
COMMENT ON COLUMN books.updated_at     IS '更新日時 (トリガーにより自動更新)';
