-- 閲覧専用（viewer）ロールの導入
-- Supabase の SQL Editor に貼り付けて実行してください。
--
-- 仕組み:
--   - ユーザーの app_metadata.role = 'viewer' の場合、reports への
--     追加・更新・削除を拒否する（閲覧 select は全ログインユーザー可のまま）
--   - viewer 付与は下の「ロール付与」を実行（メールアドレスを書き換えて使用）
--   - 付与/解除後は、そのユーザーが再ログインすると反映される

-- 書き込み系ポリシーを viewer 除外つきに置き換え
drop policy if exists "reports_insert" on public.reports;
create policy "reports_insert" on public.reports
  for insert to authenticated
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'viewer');

drop policy if exists "reports_update" on public.reports;
create policy "reports_update" on public.reports
  for update to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'viewer')
  with check (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'viewer');

drop policy if exists "reports_delete" on public.reports;
create policy "reports_delete" on public.reports
  for delete to authenticated
  using (coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') <> 'viewer');

-- ── 閲覧コードの仕組み ─────────────────────────────────────────
-- 店長はメールアドレス不要。アプリの「閲覧（店長）」タブで
-- 閲覧コード（合言葉）を入力すると、内部的に下記の共通アカウントで
-- ログインする（store/authStore.ts の VIEWER_LOGIN_EMAIL と一致させること）。
--
-- 手順:
--   1. Authentication → Add user で
--        Email:    tencho-viewer@example.com
--        Password: （閲覧コードにしたい文字列。6文字以上）
--      を作成し「Auto Confirm User」にチェック
--   2. 下記を実行して閲覧専用ロールを付与:
--
-- update auth.users
--   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--     || '{"role":"viewer"}'::jsonb
--   where email = 'tencho-viewer@example.com';
--
-- 閲覧コードの変更: Authentication → 該当ユーザー → Reset password
-- ── ロール解除（フル編集に戻す） ──────────────────────────────
-- update auth.users
--   set raw_app_meta_data = raw_app_meta_data - 'role'
--   where email = 'tencho-viewer@example.com';
