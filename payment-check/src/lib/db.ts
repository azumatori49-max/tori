// SQLite / PostgreSQL 両対応の薄いクエリアダプタ。
// クエリは `?` プレースホルダで書き、Postgres側で $n に変換する。
export interface DB {
  all<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<void>;
  transaction<T>(fn: (tx: DB) => Promise<T>): Promise<T>;
}

let dbPromise: Promise<DB> | null = null;

export function getDb(): Promise<DB> {
  if (!dbPromise) {
    const url = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;
    dbPromise = (
      url
        ? import("./postgres-adapter").then((m) => m.createPostgresDb(url))
        : import("./sqlite-adapter").then((m) => m.createSqliteDb())
    ).then(async (db) => {
      const { initSchema } = await import("./schema");
      await initSchema(db);
      return db;
    });
  }
  return dbPromise;
}
