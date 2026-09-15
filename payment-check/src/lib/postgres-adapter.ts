import postgres from "postgres";
import type { DB } from "./db";

function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

type Sql = ReturnType<typeof postgres>;

function wrap(sql: Sql): DB {
  const db: DB = {
    async all<T>(query: string, params: unknown[] = []) {
      return (await sql.unsafe(toPg(query), params as never[])) as unknown as T[];
    },
    async get<T>(query: string, params: unknown[] = []) {
      const rows = (await sql.unsafe(
        toPg(query),
        params as never[]
      )) as unknown as T[];
      return rows[0];
    },
    async run(query: string, params: unknown[] = []) {
      await sql.unsafe(toPg(query), params as never[]);
    },
    async transaction<T>(fn: (tx: DB) => Promise<T>) {
      return (await sql.begin(async (tx) =>
        fn(wrap(tx as unknown as Sql))
      )) as T;
    },
  };
  return db;
}

export async function createPostgresDb(url: string): Promise<DB> {
  // prepare: false でpgbouncer(トランザクションプーリング)互換にする。
  // サーバーレスでは同時実行ごとにプロセスが立つので、接続数は小さく・アイドルは早めに切る
  const sql = postgres(url, {
    prepare: false,
    onnotice: () => {},
    max: 3,
    idle_timeout: 20,
    connect_timeout: 10,
  });
  return wrap(sql);
}
