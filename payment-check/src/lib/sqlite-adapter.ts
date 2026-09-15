import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import type { DB } from "./db";

const DATA_DIR = path.join(process.cwd(), "data");
const DB_PATH = path.join(DATA_DIR, "payment-check.db");

export async function createSqliteDb(): Promise<DB> {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const raw = new Database(DB_PATH);
  raw.pragma("journal_mode = WAL");
  raw.pragma("foreign_keys = ON");

  const db: DB = {
    async all<T>(sql: string, params: unknown[] = []) {
      return raw.prepare(sql).all(...params) as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      return raw.prepare(sql).get(...params) as T | undefined;
    },
    async run(sql: string, params: unknown[] = []) {
      raw.prepare(sql).run(...params);
    },
    async transaction<T>(fn: (tx: DB) => Promise<T>) {
      raw.exec("BEGIN");
      try {
        const result = await fn(db);
        raw.exec("COMMIT");
        return result;
      } catch (e) {
        raw.exec("ROLLBACK");
        throw e;
      }
    },
  };
  return db;
}
