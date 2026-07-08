/** 表示用フォーマット関数 */

/**
 * 施工日を「M/D」表記にする（スプレッドシート踏襲）。
 * 入力は "YYYY-MM-DD"、"M/D"、空文字いずれも許容。
 */
export function formatWorkDate(value: string): string {
  if (!value) return '';
  // すでに M/D 形式ならそのまま
  if (/^\d{1,2}\/\d{1,2}$/.test(value)) return value;
  const m = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) {
    return `${Number(m[2])}/${Number(m[3])}`;
  }
  return value;
}

/** 入力欄向け: 自由入力された日付文字列をそのまま保持（バリデーションは緩め） */
export function normalizeDateInput(value: string): string {
  return value.trim();
}
