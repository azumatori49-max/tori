// Vercel上でDATABASE_URL未設定のときは、データが保存されないことを画面で知らせる
export function DbWarningBanner() {
  const onVercel = !!process.env.VERCEL;
  const hasDb = !!(process.env.DATABASE_URL || process.env.POSTGRES_URL);
  if (!onVercel || hasDb) return null;

  return (
    <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-center text-xs text-red-700">
      データベースが設定されていないため、入力したデータは保存されず、しばらくすると初期状態に戻ります。
      Vercelの Settings → Environment Variables に <code className="font-mono">DATABASE_URL</code>
      （PostgreSQLの接続文字列）を追加して Redeploy してください。
    </div>
  );
}
