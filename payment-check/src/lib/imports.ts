import type { DB } from "./db";
import type { Store, StoreCsvCode } from "./types";
import { newId, nowString } from "./config";
import { autoDetectColumns, looksLikeHeader, parseAmount, parseCsv, parseDate } from "./csv";

export type Mapping = Record<string, number>; // 列名 → 列index (-1 = 未選択)

export type PreviewRow = {
  index: number;
  date: string | null;
  amount: number | null; // MF: 入金額 / POS: 現金売上
  cardAmount: number | null;
  code: string;
  storeId: string | null;
  storeName: string | null;
  matchedVia: "code" | "csv_code" | "assigned" | null;
  status:
    | "ok"
    | "unmatched"
    | "dup"
    | "excluded" // MF: 出金行 / POS: 未登録コード除外
    | "error"
    | "overwrite";
};

export type PreviewResult = {
  headers: string[];
  hasHeader: boolean;
  rowCount: number;
  mapping: Mapping;
  rows: PreviewRow[]; // 全行（クライアントで先頭10行表示）
  counts: {
    ok: number;
    unmatched: number;
    dup: number;
    excluded: number;
    error: number;
    overwrite: number;
  };
  unmatchedCodes: string[];
};

async function loadMatchers(db: DB, kind: "mf" | "pos") {
  const stores = await db.all<Store>(`SELECT * FROM stores WHERE active = 1`);
  const codes = await db.all<StoreCsvCode>(
    `SELECT * FROM store_csv_codes WHERE kind = ?`,
    [kind]
  );
  const byCsvCode = new Map<string, Store>();
  for (const c of codes) {
    const store = stores.find((s) => s.id === c.store_id);
    if (store) byCsvCode.set(c.code, store);
  }
  const byStoreCode = new Map<string, Store>(stores.map((s) => [s.code, s]));
  return { byCsvCode, byStoreCode };
}

export async function buildPreview(
  db: DB,
  kind: "mf" | "pos",
  text: string,
  mappingOverride: Mapping | null,
  overwrite: boolean,
  assignments: Record<string, string> // 未特定コード → store_id (MFの手動割当)
): Promise<PreviewResult> {
  const parsed = parseCsv(text);
  if (parsed.length === 0) {
    return {
      headers: [],
      hasHeader: false,
      rowCount: 0,
      mapping: {},
      rows: [],
      counts: { ok: 0, unmatched: 0, dup: 0, excluded: 0, error: 0, overwrite: 0 },
      unmatchedCodes: [],
    };
  }

  const hasHeader = looksLikeHeader(parsed[0]);
  const headers = hasHeader
    ? parsed[0]
    : parsed[0].map((_, i) => `列${i + 1}`);
  const dataRows = hasHeader ? parsed.slice(1) : parsed;

  const mapping =
    mappingOverride ?? autoDetectColumns(headers, kind);

  const { byCsvCode, byStoreCode } = await loadMatchers(db, kind);
  const stores = await db.all<Store>(`SELECT * FROM stores`);

  const rows: PreviewRow[] = [];
  const unmatchedCodes = new Set<string>();

  for (let i = 0; i < dataRows.length; i++) {
    const raw = dataRows[i];
    const cell = (idx: number | undefined) =>
      idx !== undefined && idx >= 0 ? (raw[idx] ?? "") : "";

    const date = parseDate(cell(mapping.date));
    const code = cell(mapping.code).trim();
    const amount =
      kind === "mf" ? parseAmount(cell(mapping.amount)) : parseAmount(cell(mapping.cash));
    const cardAmount = kind === "pos" ? parseAmount(cell(mapping.card)) : null;

    const row: PreviewRow = {
      index: i,
      date,
      amount,
      cardAmount,
      code,
      storeId: null,
      storeName: null,
      matchedVia: null,
      status: "ok",
    };

    if (!date || amount === null) {
      row.status = "error";
      rows.push(row);
      continue;
    }
    if (kind === "mf" && amount <= 0) {
      row.status = "excluded"; // 出金行スキップ
      rows.push(row);
      continue;
    }

    // 店舗特定: CSVコード → 店舗コード → 手動割当
    let store = byCsvCode.get(code) ?? null;
    if (store) {
      row.matchedVia = "csv_code";
    } else {
      store = byStoreCode.get(code) ?? null;
      if (store) row.matchedVia = "code";
    }
    if (!store && assignments[code]) {
      store = stores.find((s) => s.id === assignments[code]) ?? null;
      if (store) row.matchedVia = "assigned";
    }

    if (!store) {
      row.status = "unmatched";
      unmatchedCodes.add(code);
      rows.push(row);
      continue;
    }
    row.storeId = store.id;
    row.storeName = store.name;

    // 重複判定（既存CSVデータの有無）
    const existing =
      kind === "mf"
        ? await db.get(
            `SELECT id FROM mf_deposits WHERE store_id = ? AND date = ? AND source = 'csv' LIMIT 1`,
            [store.id, date]
          )
        : await db.get(
            `SELECT id FROM pos_sales WHERE store_id = ? AND date = ? LIMIT 1`,
            [store.id, date]
          );
    if (existing) {
      row.status = overwrite ? "overwrite" : "dup";
    }
    rows.push(row);
  }

  // 同一CSV内の同日・同店舗もoverwrite以外では重複扱い（2行目以降）
  const seen = new Set<string>();
  for (const row of rows) {
    if (row.status !== "ok" && row.status !== "overwrite") continue;
    const key = `${row.storeId}:${row.date}`;
    if (kind === "pos" && seen.has(key)) {
      row.status = "dup";
    }
    seen.add(key);
  }

  const counts = {
    ok: rows.filter((r) => r.status === "ok").length,
    unmatched: rows.filter((r) => r.status === "unmatched").length,
    dup: rows.filter((r) => r.status === "dup").length,
    excluded: rows.filter((r) => r.status === "excluded").length,
    error: rows.filter((r) => r.status === "error").length,
    overwrite: rows.filter((r) => r.status === "overwrite").length,
  };

  return {
    headers,
    hasHeader,
    rowCount: dataRows.length,
    mapping,
    rows,
    counts,
    unmatchedCodes: [...unmatchedCodes],
  };
}

export async function executeImport(
  db: DB,
  kind: "mf" | "pos",
  fileName: string,
  preview: PreviewResult,
  overwrite: boolean,
  assignments: Record<string, string>,
  userId: string
): Promise<{ importId: string; imported: number; overwritten: number }> {
  const importId = newId();
  const now = nowString();
  const importable = preview.rows.filter(
    (r) => r.status === "ok" || r.status === "overwrite"
  );

  await db.transaction(async (tx) => {
    // 手動割当コードを副コードとして学習させる（次回以降の自動マッチ用）
    for (const [code, storeId] of Object.entries(assignments)) {
      const exists = await tx.get(
        `SELECT id FROM store_csv_codes WHERE kind = ? AND code = ?`,
        [kind, code]
      );
      if (!exists) {
        await tx.run(
          `INSERT INTO store_csv_codes (id, store_id, kind, code, is_primary) VALUES (?, ?, ?, ?, 0)`,
          [newId(), storeId, kind, code]
        );
      }
    }

    // overwrite: 対象の同日・同店舗の既存CSVデータを先に削除
    if (overwrite) {
      const targets = new Set(
        importable
          .filter((r) => r.status === "overwrite")
          .map((r) => `${r.storeId}:${r.date}`)
      );
      for (const key of targets) {
        const [storeId, date] = key.split(":");
        if (kind === "mf") {
          await tx.run(
            `DELETE FROM mf_deposits WHERE store_id = ? AND date = ? AND source = 'csv'`,
            [storeId, date]
          );
        } else {
          await tx.run(
            `DELETE FROM pos_sales WHERE store_id = ? AND date = ? AND source = 'csv'`,
            [storeId, date]
          );
        }
      }
    }

    for (const row of importable) {
      if (kind === "mf") {
        await tx.run(
          `INSERT INTO mf_deposits (id, store_id, date, amount, source, import_id) VALUES (?, ?, ?, ?, 'csv', ?)`,
          [newId(), row.storeId, row.date, row.amount, importId]
        );
      } else {
        // POSは同日・同店舗1行（overwrite時は上で削除済み、手動行は残す）
        const existing = await tx.get<{ id: string; source: string }>(
          `SELECT id, source FROM pos_sales WHERE store_id = ? AND date = ? LIMIT 1`,
          [row.storeId, row.date]
        );
        if (existing) continue;
        await tx.run(
          `INSERT INTO pos_sales (id, store_id, date, cash_amount, card_amount, source, import_id) VALUES (?, ?, ?, ?, ?, 'csv', ?)`,
          [newId(), row.storeId, row.date, row.amount, row.cardAmount ?? 0, importId]
        );
      }
    }

    await tx.run(
      `INSERT INTO csv_imports (id, kind, file_name, imported_by, imported_at, mode, status, total_rows, matched, dup_skipped, unmatched, excluded, overwritten, mapping_json)
       VALUES (?, ?, ?, ?, ?, ?, 'completed', ?, ?, ?, ?, ?, ?, ?)`,
      [
        importId,
        kind,
        fileName,
        userId,
        now,
        overwrite ? "overwrite" : "normal",
        preview.rowCount,
        importable.length,
        preview.counts.dup,
        preview.counts.unmatched,
        preview.counts.excluded + preview.counts.error,
        preview.counts.overwrite,
        JSON.stringify(preview.mapping),
      ]
    );
  });

  return {
    importId,
    imported: importable.length,
    overwritten: preview.counts.overwrite,
  };
}

export async function rollbackImport(
  db: DB,
  importId: string
): Promise<{ ok: boolean; error?: string }> {
  const imp = await db.get<{ id: string; kind: string; status: string }>(
    `SELECT id, kind, status FROM csv_imports WHERE id = ?`,
    [importId]
  );
  if (!imp) return { ok: false, error: "取込が見つかりません" };
  if (imp.status !== "completed")
    return { ok: false, error: "この取込は取り消せません" };

  await db.transaction(async (tx) => {
    if (imp.kind === "mf") {
      await tx.run(`DELETE FROM mf_deposits WHERE import_id = ?`, [importId]);
    } else {
      await tx.run(`DELETE FROM pos_sales WHERE import_id = ?`, [importId]);
    }
    await tx.run(`UPDATE csv_imports SET status = 'rolled_back' WHERE id = ?`, [
      importId,
    ]);
  });
  return { ok: true };
}
