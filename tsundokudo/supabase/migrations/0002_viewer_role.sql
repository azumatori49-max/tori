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

-- ── ロール付与（店長アカウントを閲覧専用にする） ──────────────
-- メールアドレスを店長のものに書き換えて実行:
--
-- update auth.users
--   set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb)
--     || '{"role":"viewer"}'::jsonb
--   where email = 'tencho@example.com';
--
-- ── ロール解除（フル編集に戻す） ──────────────────────────────
-- update auth.users
--   set raw_app_meta_data = raw_app_meta_data - 'role'
--   where email = 'tencho@example.com';
