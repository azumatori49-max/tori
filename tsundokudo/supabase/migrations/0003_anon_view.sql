-- ログイン不要の閲覧モード用: 未ログイン(anon)にも reports の閲覧を許可する
-- Supabase の SQL Editor に貼り付けて実行してください。
--
-- 注意:
--   これを実行すると「アプリのURLを知っている人は誰でも閲覧できる」状態に
--   なります（書き込みは引き続きログイン済み担当者のみ）。
--   閲覧も制限したくなった場合はこのポリシーを削除してください:
--     drop policy if exists "reports_select_anon" on public.reports;
--
-- ※ 0002 の「閲覧コード用アカウント（tencho-viewer@...）」方式は不要に
--    なりました。作成済みなら Authentication から削除して構いません。

drop policy if exists "reports_select_anon" on public.reports;
create policy "reports_select_anon" on public.reports
  for select to anon using (true);
