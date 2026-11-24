/**
 * 写真のダウンロード（管理画面）。個別保存と zip のまとめ保存。
 * DB には触らない。zip 用の fflate は必要になったときだけ読み込む。
 */

const PART_MAX = 40;
const NAME_MAX = 120;

/** ファイル名の1要素を安全にする。禁止文字は全角に、制御文字は _ に */
const FORBIDDEN: Record<string, string> = {
  '/': '／',
  '\\': '＼',
  ':': '：',
  '*': '＊',
  '?': '？',
  '"': '”',
  '<': '＜',
  '>': '＞',
  '|': '｜',
};

export const sanitizeFileName = (s: string): string =>
  s
    .replace(/[/\\:*?"<>|]/g, (c) => FORBIDDEN[c])
    .replace(/\s+/g, ' ')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001f\u007f]/g, '_')
    .replace(/^[\s.]+|[\s.]+$/g, '')
    .slice(0, PART_MAX);

export interface PhotoNameParts {
  storeName: string;
  /** 項目名（スケジュール名がある場合は「スケジュール名-項目名」、定期なら「デイリー-項目名」など） */
  label: string;
  /** YYYYMMDD または YYYYMM */
  dateLabel: string;
  /** 同じ項目の複数枚の連番（1から） */
  index: number;
  ext: string;
}

/** 「{店舗名}_{ラベル}_{日付}_{番号}.{拡張子}」。全体（拡張子を除く）が120文字を超えたら末尾の要素から切る */
export const buildPhotoFileName = ({ storeName, label, dateLabel, index, ext }: PhotoNameParts): string => {
  const parts = [storeName, label, dateLabel, String(index)].map(sanitizeFileName).filter(Boolean);
  let name = parts.join('_');
  for (let i = parts.length - 2; name.length > NAME_MAX && i >= 0; i -= 1) {
    const over = name.length - NAME_MAX;
    parts[i] = parts[i].slice(0, Math.max(1, parts[i].length - over));
    name = parts.join('_');
  }
  return `${name}.${ext}`;
};

/** 同名があれば (2), (3) を付けて一意にする（拡張子の前に付ける） */
export const uniqueFileNames = (names: string[]): string[] => {
  const seen = new Map<string, number>();
  return names.map((n) => {
    const count = (seen.get(n) ?? 0) + 1;
    seen.set(n, count);
    if (count === 1) return n;
    const dot = n.lastIndexOf('.');
    return dot > 0 ? `${n.slice(0, dot)} (${count})${n.slice(dot)}` : `${n} (${count})`;
  });
};

/** Content-Type から拡張子。不明なら jpg */
export const extFromContentType = (ct: string | null | undefined): string => {
  const t = (ct ?? '').split(';')[0].trim().toLowerCase();
  if (t === 'image/png') return 'png';
  if (t === 'image/webp') return 'webp';
  if (t === 'image/gif') return 'gif';
  if (t === 'image/heic') return 'heic';
  if (t === 'video/mp4') return 'mp4';
  if (t === 'video/quicktime') return 'mov';
  if (t === 'video/webm') return 'webm';
  return 'jpg';
};

/** fetch して Blob を返す。ネットワーク・CORS・404 は例外 */
export const fetchPhotoBlob = async (url: string, signal?: AbortSignal): Promise<Blob> => {
  const res = await fetch(url, { signal, mode: 'cors' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.blob();
};

export const saveBlob = (blob: Blob, fileName: string): void => {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(href), 1000);
};

/** 1枚を取得して保存。baseName に拡張子を付けたファイル名になる */
export const savePhoto = async (url: string, nameWithExt: (ext: string) => string): Promise<void> => {
  const blob = await fetchPhotoBlob(url);
  saveBlob(blob, nameWithExt(extFromContentType(blob.type)));
};

export interface ZipEntry {
  url: string;
  /** 拡張子を除いたファイル名の作り方 */
  nameWithExt: (ext: string) => string;
}

export interface ZipResult {
  saved: number;
  failed: ZipEntry[];
  cancelled: boolean;
}

const CONCURRENCY = 4;

/**
 * 複数の写真を取得して zip で保存する（圧縮なし）。同時取得は最大4件。
 * 取得できなかった分は failed に返し、呼び出し側でやり直せるようにする。
 */
export const saveZip = async (
  entries: ZipEntry[],
  zipName: string,
  opts: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal } = {},
): Promise<ZipResult> => {
  const total = entries.length;
  const results: Array<{ name: string; data: Uint8Array } | null> = new Array(total).fill(null);
  const failed: ZipEntry[] = [];
  let done = 0;
  let next = 0;
  const worker = async () => {
    while (next < total && !opts.signal?.aborted) {
      const i = next;
      next += 1;
      const e = entries[i];
      try {
        const blob = await fetchPhotoBlob(e.url, opts.signal);
        results[i] = {
          name: e.nameWithExt(extFromContentType(blob.type)),
          data: new Uint8Array(await blob.arrayBuffer()),
        };
      } catch {
        failed.push(e);
      }
      done += 1;
      opts.onProgress?.(done, total);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
  if (opts.signal?.aborted) return { saved: 0, failed: [], cancelled: true };
  const got = results.filter((r): r is { name: string; data: Uint8Array } => !!r);
  if (got.length === 0) return { saved: 0, failed, cancelled: false };

  const { zipSync } = await import('fflate');
  const names = uniqueFileNames(got.map((r) => r.name));
  const files: Record<string, [Uint8Array, { level: 0 }]> = {};
  got.forEach((r, i) => {
    files[names[i]] = [r.data, { level: 0 }];
  });
  const zipped = zipSync(files);
  saveBlob(new Blob([zipped], { type: 'application/zip' }), zipName);
  return { saved: got.length, failed, cancelled: false };
};
