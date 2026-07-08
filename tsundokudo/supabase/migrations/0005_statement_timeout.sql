-- ============================================================
-- 保存タイムアウト対策
-- Supabase の SQL Editor に貼り付けて実行してください。
--
-- 写真（base64）を含むレポートは1件のデータが大きく、
-- 標準の処理時間制限（8秒）を超えて
-- "canceling statement due to statement timeout" で
-- 保存に失敗することがある。
-- ログイン利用者(authenticated)・閲覧リンク(anon)の
-- 制限時間を延ばして保存・読み込みを通す。
-- ============================================================

alter role authenticated set statement_timeout = '30s';
alter role anon set statement_timeout = '30s';

-- 反映（PostgRESTの接続プールに新設定を読ませる）
notify pgrst, 'reload config';
