// 依存なしの簡易CSVパーサ（ダブルクォート・CRLF・BOM対応）
export function parseCsv(text: string): string[][] {
  const src = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.length > 1 || row[0] !== "") rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== "") rows.push(row);
  }
  return rows;
}

export function looksLikeHeader(row: string[]): boolean {
  // 全セルが日付にも数値にも見えなければヘッダとみなす
  return row.every((cell) => !parseDate(cell) && parseAmount(cell) === null);
}

// "2026/04/07" "2026-04-07" "2026年4月7日" → "2026-04-07"
export function parseDate(value: string): string | null {
  const s = value.trim();
  let m = s.match(/^(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})/);
  if (!m) m = s.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

// "¥101,000" "101000" "-3,000" → number / 解釈不能ならnull
export function parseAmount(value: string): number | null {
  const s = value.trim().replace(/[¥￥,\s"]/g, "");
  if (s === "" || !/^-?\d+(\.\d+)?$/.test(s)) return null;
  return Math.round(Number(s));
}

const DATE_HEADER = /日付|取引日|営業日|年月日|入金日|date/i;
const AMOUNT_HEADER = /入金額|金額|入金|amount/i;
const CODE_HEADER = /店舗コード|コード|店舗ID|code/i;
const CASH_HEADER = /現金売上|現金|cash/i;
const CARD_HEADER = /カード売上|カード|card/i;

export function autoDetectColumns(
  headers: string[],
  kind: "mf" | "pos"
): Record<string, number> {
  const find = (re: RegExp, exclude: number[] = []) =>
    headers.findIndex((h, i) => !exclude.includes(i) && re.test(h));

  if (kind === "mf") {
    const date = find(DATE_HEADER);
    const amount = find(AMOUNT_HEADER, [date]);
    const code = find(CODE_HEADER, [date, amount]);
    return { date, amount, code };
  }
  const date = find(DATE_HEADER);
  const code = find(CODE_HEADER, [date]);
  const cash = find(CASH_HEADER, [date, code]);
  const card = find(CARD_HEADER, [date, code, cash]);
  return { date, code, cash, card };
}
