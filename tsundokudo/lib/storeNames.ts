/**
 * 店舗の正式名称の解決。
 *
 * 店舗マスタに「鶏ヤロー　柏店」のような正式名称を登録しておくと、
 * レポートの店舗名が略称（例: 柏店）でも、PDF出力時に正式名称へ変換する。
 */

function compact(s: string): string {
  return s.replace(/[\s　]/g, '');
}

/**
 * 店舗名を正式名称に解決する。
 * - マスタに完全一致があればそのまま
 * - 「マスタ名の末尾が入力名と一致」する店舗がちょうど1件ならその正式名称
 * - それ以外（該当なし・複数該当）は入力のまま返す
 */
export function officialStoreName(name: string, master: string[]): string {
  const n = compact(name);
  if (!n) return name;
  // 正式名称（末尾が一致するより長い名前）が1件に定まるならそれを優先する。
  // （略称がマスタに自動追加されていても、正式名称へ寄せられるように）
  const hits = master.filter((m) => {
    const c = compact(m);
    return c.length > n.length && c.endsWith(n);
  });
  if (hits.length === 1 && hits[0]) return hits[0];
  return master.find((m) => compact(m) === n) ?? name;
}

/**
 * スプレッドシート等から貼り付けた店舗リストを行・タブで分解して正規化する。
 * 空セル・重複は除去し、連続空白は全角スペース1つにまとめる。
 */
export function parseStoreList(text: string): string[] {
  const out: string[] = [];
  for (const line of text.split(/\r?\n/)) {
    for (const cell of line.split('\t')) {
      const v = cell.trim().replace(/[\s　]+/g, '　');
      if (v && !out.includes(v)) out.push(v);
    }
  }
  return out;
}
