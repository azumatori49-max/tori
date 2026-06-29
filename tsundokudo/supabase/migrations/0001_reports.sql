-- 衛生管理メンテナンスレポート: 共有テーブル
-- Supabase の SQL Editor に貼り付けて実行してください。
--
-- 設計:
--   - レポート本体は data(jsonb) にまるごと保存（ネスト構造・写真base64も含む）
--   - ログイン済みユーザー全員が同じデータを共有・編集できる「チーム共有」方式
--   - 未ログインユーザーは一切アクセス不可（RLS）

create extension if not exists "pgcrypto";

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reports_created_at_idx on public.reports (created_at desc);

alter table public.reports enable row level security;

-- ログイン済み(authenticated)なら全レポートを読み書き可能（チーム共有）
drop policy if exists "reports_select" on public.reports;
create policy "reports_select" on public.reports
  for select to authenticated using (true);

drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports
  for insert to authenticated with check (true);

drop policy if exists "reports_update" on public.reports;
create policy "reports_update" on public.reports
  for update to authenticated using (true) with check (true);

drop policy if exists "reports_delete" on public.reports;
create policy "reports_delete" on public.reports
  for delete to authenticated using (true);
