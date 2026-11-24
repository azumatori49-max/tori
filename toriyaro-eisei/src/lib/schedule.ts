/**
 * 年間スケジュール（期間つきの撮影依頼）の純関数。
 * 店舗画面・管理画面で共通に使う。DB には触らない。
 *
 * 写真の番号: 項目を上から順に、各項目が max 枚ぶんの連続した番号を使う
 *   （項目0 が 0〜max0-1、項目1 がその次から）。
 * 提出済みの判定: 全項目で「自分の範囲にある写真の数 >= required」。
 */
import type { Schedule, ScheduleItem, ScheduleVideo, StoreKey, Submission } from '../types';

/** 既存ルールの写真枚数上限（submissions の count / photos は 20 まで） */
export const SCHEDULE_MAX_PHOTOS = 20;
export const SCHEDULE_TITLE_MAX = 60;
export const SCHEDULE_DESCRIPTION_MAX = 200;
export const SCHEDULE_LABEL_MAX = 40;
export const SCHEDULE_NOTE_MAX = 200;
/** 店舗トップに「予定」として出す日数 */
export const SCHEDULE_UPCOMING_DAYS = 30;

/** 参考動画（アップロード）の上限。storage.rules の schedule-media/ と合わせる */
export const SCHEDULE_VIDEO_MAX_BYTES = 100 * 1024 * 1024;
/** これを超えると「店舗の通信量が大きくなる」警告を出す */
export const SCHEDULE_VIDEO_WARN_BYTES = 30 * 1024 * 1024;
export const SCHEDULE_VIDEO_TITLE_MAX = 40;

/**
 * YouTube / Vimeo のURLから動画IDを取り出し、埋め込み用URLにする。
 * 対応: youtube.com/watch?v=ID、youtu.be/ID、youtube.com/shorts/ID、vimeo.com/数字
 * 対応外なら null。
 */
export const parseVideoUrl = (input: string): Pick<ScheduleVideo, 'type' | 'url'> | null => {
  const raw = input.trim();
  if (!raw) return null;
  let u: URL;
  try {
    u = new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`);
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\.|^m\./, '').toLowerCase();
  const ytId = /^[A-Za-z0-9_-]{6,20}$/;
  if (host === 'youtube.com' || host === 'youtube-nocookie.com') {
    let id: string | null = null;
    if (u.pathname === '/watch') id = u.searchParams.get('v');
    else if (u.pathname.startsWith('/shorts/')) id = u.pathname.split('/')[2] ?? null;
    else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/')[2] ?? null;
    if (id && ytId.test(id)) return { type: 'youtube', url: `https://www.youtube-nocookie.com/embed/${id}` };
    return null;
  }
  if (host === 'youtu.be') {
    const id = u.pathname.split('/')[1] ?? '';
    if (ytId.test(id)) return { type: 'youtube', url: `https://www.youtube-nocookie.com/embed/${id}` };
    return null;
  }
  if (host === 'vimeo.com' || host === 'player.vimeo.com') {
    const m = u.pathname.match(/\/(?:video\/)?(\d{5,})(?:\/|$)/);
    if (m) return { type: 'vimeo', url: `https://player.vimeo.com/video/${m[1]}` };
    return null;
  }
  return null;
};

/** 動画設定の形式チェック。問題があればメッセージ */
export const validateVideo = (v: ScheduleVideo | undefined, where: string): string | null => {
  if (!v) return null;
  if (v.type !== 'youtube' && v.type !== 'vimeo' && v.type !== 'upload') return `${where}の動画の種類が不正です`;
  if (typeof v.url !== 'string' || !v.url || v.url.length >= 1024) return `${where}の動画URLが不正です`;
  if (v.path !== undefined && (typeof v.path !== 'string' || v.path.length >= 300)) return `${where}の動画の保存先が不正です`;
  if (v.title !== undefined && (typeof v.title !== 'string' || v.title.length > SCHEDULE_VIDEO_TITLE_MAX)) {
    return `${where}の動画の表示名は${SCHEDULE_VIDEO_TITLE_MAX}文字以内にしてください`;
  }
  if (v.size !== undefined && typeof v.size !== 'number') return `${where}の動画サイズが不正です`;
  return null;
};

/** スケジュール全体か項目のどこかに参考動画があるか */
export const hasAnyVideo = (s: Schedule): boolean =>
  !!s.video || scheduleItems(s).some((it) => !!it.video);

export type ScheduleStatus = 'active' | 'upcoming' | 'ended' | 'archived';
export type ScheduleProgressStatus = 'none' | 'partial' | 'done';

export interface SlotRange {
  /** 先頭の番号 */
  start: number;
  /** 末尾の番号（含まない） */
  end: number;
}

export interface ItemProgress {
  item: ScheduleItem;
  /** 全項目での index */
  index: number;
  range: SlotRange;
  /** 範囲内にある写真の数 */
  count: number;
  done: boolean;
}

export interface ScheduleProgress {
  items: ItemProgress[];
  doneItems: number;
  totalItems: number;
  photoCount: number;
  status: ScheduleProgressStatus;
}

/** items は "0","1",… のオブジェクトか配列。順番どおりの配列に揃える */
export const scheduleItems = (s: Pick<Schedule, 'items'> | null | undefined): ScheduleItem[] => {
  const raw = s?.items;
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((x): x is ScheduleItem => !!x);
  return Object.keys(raw)
    .map((k) => Number(k))
    .filter((n) => Number.isInteger(n) && n >= 0)
    .sort((a, b) => a - b)
    .map((n) => (raw as Record<string, ScheduleItem>)[String(n)])
    .filter((x): x is ScheduleItem => !!x);
};

/** 各項目が使う写真番号の範囲 */
export const slotRanges = (items: ScheduleItem[]): SlotRange[] => {
  const out: SlotRange[] = [];
  let cursor = 0;
  for (const it of items) {
    const max = Math.max(1, Math.floor(Number(it.max) || 1));
    out.push({ start: cursor, end: cursor + max });
    cursor += max;
  }
  return out;
};

export const totalMax = (items: ScheduleItem[]): number =>
  items.reduce((sum, it) => sum + Math.max(1, Math.floor(Number(it.max) || 1)), 0);

/** submissions.photos は配列 or { '0': url, ... } 混在。番号→URL に揃える */
export const photosMap = (raw: unknown): Map<number, string> => {
  const map = new Map<number, string>();
  if (!raw) return map;
  if (Array.isArray(raw)) {
    raw.forEach((v, i) => {
      if (typeof v === 'string' && v.length > 0) map.set(i, v);
    });
    return map;
  }
  if (typeof raw === 'object') {
    Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
      const idx = Number(k);
      if (Number.isInteger(idx) && idx >= 0 && typeof v === 'string' && v.length > 0) {
        map.set(idx, v);
      }
    });
  }
  return map;
};

/** この項目をその店舗に表示するか（item.stores が無ければ全店） */
export const isItemForStore = (item: ScheduleItem, storeKey: StoreKey): boolean =>
  !item.stores || !!item.stores[storeKey];

/**
 * 店舗に表示する項目と、その項目の元の番号（全項目での index）。
 * 番号は全項目で通しなので、店舗ごとに項目を絞っても写真の番号はずれない。
 */
export const itemsForStore = (
  items: ScheduleItem[],
  storeKey: StoreKey,
): Array<{ item: ScheduleItem; index: number }> =>
  items
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => isItemForStore(item, storeKey));

/**
 * 提出状況（未提出／一部提出／提出済み）と項目ごとの枚数。
 * storeKey を渡すと、その店舗に表示する項目だけで判定する（表示しない項目は数えない）。
 */
export const progress = (
  items: ScheduleItem[],
  photosRaw: unknown,
  storeKey?: StoreKey,
): ScheduleProgress => {
  const photos = photosMap(photosRaw);
  const ranges = slotRanges(items);
  const targets = storeKey ? itemsForStore(items, storeKey) : items.map((item, index) => ({ item, index }));
  const perItem: ItemProgress[] = targets.map(({ item, index }) => {
    const range = ranges[index];
    let count = 0;
    for (let n = range.start; n < range.end; n += 1) {
      if (photos.has(n)) count += 1;
    }
    const required = Math.max(1, Math.floor(Number(item.required) || 1));
    return { item, index, range, count, done: count >= required };
  });
  const doneItems = perItem.filter((p) => p.done).length;
  const photoCount = perItem.reduce((s, p) => s + p.count, 0);
  const status: ScheduleProgressStatus =
    perItem.length > 0 && doneItems === perItem.length
      ? 'done'
      : photoCount > 0
        ? 'partial'
        : 'none';
  return { items: perItem, doneItems, totalItems: perItem.length, photoCount, status };
};

/** 状態。todayKey は業務日（getDateKey()） */
export const scheduleStatus = (s: Schedule, todayKey: string): ScheduleStatus => {
  if (s.archived) return 'archived';
  if (todayKey < s.from) return 'upcoming';
  if (todayKey > s.to) return 'ended';
  return 'active';
};

/** 店舗トップに出す「予定」: 今日 < from <= 今日+30日 */
export const isUpcomingSoon = (s: Schedule, todayKey: string, limitKey: string): boolean =>
  !s.archived && todayKey < s.from && s.from <= limitKey;

/** 対象店舗か（stores が無ければ全店）。さらに、その店舗に表示する項目が1つも無ければ対象外 */
export const isStoreTargeted = (s: Schedule, storeKey: StoreKey): boolean => {
  if (s.stores && !s.stores[storeKey]) return false;
  const items = scheduleItems(s);
  if (items.length === 0) return true;
  return items.some((it) => isItemForStore(it, storeKey));
};

/** 対象店舗のキー一覧（stores が無ければ全店。表示する項目が無い店舗は除く） */
export const targetStoreKeys = (s: Schedule, allStoreKeys: StoreKey[]): StoreKey[] =>
  allStoreKeys.filter((k) => isStoreTargeted(s, k));

/** id: 'W' + 開始日 + '-' + 英数6文字（0/O/1/l/I を除く小文字と数字）。作成後は変えない */
const ID_CHARS = 'abcdefghjkmnpqrstuvwxyz23456789';
export const generateScheduleId = (from: string): string => {
  const bytes = new Uint32Array(6);
  crypto.getRandomValues(bytes);
  let suffix = '';
  for (let i = 0; i < 6; i += 1) suffix += ID_CHARS[bytes[i] % ID_CHARS.length];
  return `W${from}-${suffix}`;
};

/** "9/28〜10/4" */
export const formatScheduleRange = (from: string, to: string): string => {
  const f = (k: string) => {
    const [, m, d] = k.split('-');
    return `${Number(m)}/${Number(d)}`;
  };
  return `${f(from)}〜${f(to)}`;
};

export interface ScheduleInput {
  title: string;
  description: string;
  from: string;
  to: string;
  /** null = 全店 */
  stores: StoreKey[] | null;
  items: ScheduleItem[];
  /** スケジュール全体の参考動画（undefined = なし） */
  video?: ScheduleVideo;
}

const isDateKey = (s: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(s);

/** 入力チェック。問題があればメッセージ、無ければ null */
export const validateScheduleInput = (input: ScheduleInput): string | null => {
  const title = input.title.trim();
  if (!title) return 'タイトルを入力してください';
  if (title.length > SCHEDULE_TITLE_MAX) return `タイトルは${SCHEDULE_TITLE_MAX}文字以内にしてください`;
  if (input.description.length > SCHEDULE_DESCRIPTION_MAX) {
    return `説明は${SCHEDULE_DESCRIPTION_MAX}文字以内にしてください`;
  }
  if (!isDateKey(input.from) || !isDateKey(input.to)) return '開始日と終了日を入力してください';
  if (input.from > input.to) return '開始日は終了日より前にしてください';
  if (input.stores && input.stores.length === 0) return '対象店舗を1つ以上選ぶか、全店にしてください';
  const videoErr = validateVideo(input.video, 'スケジュール全体');
  if (videoErr) return videoErr;
  if (input.items.length === 0) return '項目を1つ以上追加してください';
  for (let i = 0; i < input.items.length; i += 1) {
    const it = input.items[i];
    const n = i + 1;
    if (!it.label.trim()) return `${n}番目の項目名を入力してください`;
    if (it.label.trim().length > SCHEDULE_LABEL_MAX) {
      return `${n}番目の項目名は${SCHEDULE_LABEL_MAX}文字以内にしてください`;
    }
    if (!Number.isInteger(it.required) || it.required < 1) return `${n}番目の必要枚数は1以上にしてください`;
    if (!Number.isInteger(it.max) || it.max < it.required) {
      return `${n}番目の上限枚数は必要枚数以上にしてください`;
    }
    if (it.source !== 'camera' && it.source !== 'library' && it.source !== 'video') {
      return `${n}番目の撮影方法を選んでください`;
    }
    if ((it.note ?? '').length > SCHEDULE_NOTE_MAX) {
      return `${n}番目の注意書きは${SCHEDULE_NOTE_MAX}文字以内にしてください`;
    }
    if (it.helpImage !== undefined && (typeof it.helpImage !== 'string' || it.helpImage.length >= 1024)) {
      return `${n}番目の参考画像が不正です`;
    }
    const itemVideoErr = validateVideo(it.video, `${n}番目の項目`);
    if (itemVideoErr) return itemVideoErr;
  }
  if (totalMax(input.items) > SCHEDULE_MAX_PHOTOS) {
    return `上限枚数の合計は${SCHEDULE_MAX_PHOTOS}枚以内にしてください（現在 ${totalMax(input.items)}枚）`;
  }
  return null;
};

/** 撮影方法の表示名 */
export const sourceLabel = (source: ScheduleItem['source']): string =>
  source === 'video' ? '動画（撮影・フォルダ可）' : source === 'library' ? '写真フォルダ可' : '撮影のみ';

/** 項目・枚数・撮影方法が同じか（構造の固定チェック用） */
export const sameStructure = (a: ScheduleItem[], b: ScheduleItem[]): boolean => {
  if (a.length !== b.length) return false;
  return a.every(
    (x, i) =>
      x.required === b[i].required && x.max === b[i].max && x.source === b[i].source,
  );
};

// ============================================================
// 項目ごとの集計（管理画面の「項目別」表示・集計コピー・CSV）
// 枠番号の解釈は progress()（= slotRanges）をそのまま使い、店舗別の判定と食い違わないようにする。
// ============================================================

export interface ItemStat {
  item: ScheduleItem;
  /** 全項目での index（枠番号の元） */
  index: number;
  /** 達成（枚数 >= required。viaLine の記録は全項目達成扱い） */
  done: StoreKey[];
  /** 一部（1枚以上で未達） */
  partial: Array<{ key: StoreKey; count: number; required: number }>;
  /** 未達成（0枚） */
  missing: StoreKey[];
  /** この項目の対象店舗数（分母） */
  targetCount: number;
  photoCount: number;
  /** 店舗あたりの平均枚数 */
  average: number;
  /** 達成率 0〜1 */
  rate: number;
  /** required > max で達成できない */
  unachievable: boolean;
}

export interface StoreStat {
  key: StoreKey;
  status: ScheduleProgressStatus;
  /** 項目ごとの枚数。その店舗に表示しない項目は null */
  counts: Array<number | null>;
}

export interface ScheduleStats {
  items: ItemStat[];
  stores: StoreStat[];
  doneStores: number;
  partialStores: number;
  noneStores: number;
  /** どの項目の枠にも入らない写真（削除・変更された項目の写真）の枚数 */
  retiredPhotoCount: number;
}

export const itemStats = (
  schedule: Pick<Schedule, 'items'>,
  submissionsByStore: Record<StoreKey, Submission | null | undefined>,
  targetStoreKeys: StoreKey[],
): ScheduleStats => {
  const items = scheduleItems(schedule);
  const perItem: ItemStat[] = items.map((item, index) => ({
    item,
    index,
    done: [],
    partial: [],
    missing: [],
    targetCount: 0,
    photoCount: 0,
    average: 0,
    rate: 0,
    unachievable:
      Math.max(1, Math.floor(Number(item.required) || 1)) > Math.max(1, Math.floor(Number(item.max) || 1)),
  }));
  let retiredPhotoCount = 0;
  const stores: StoreStat[] = targetStoreKeys.map((key) => {
    const sub = submissionsByStore[key] ?? null;
    const p = progress(items, sub?.photos, key);
    const viaLine = !!sub?.viaLine;
    const counts: Array<number | null> = items.map(() => null);
    let counted = 0;
    p.items.forEach((ip) => {
      const stat = perItem[ip.index];
      counts[stat.index] = ip.count;
      counted += ip.count;
      stat.targetCount += 1;
      stat.photoCount += ip.count;
      if (ip.done || viaLine) stat.done.push(key);
      else if (ip.count > 0) {
        stat.partial.push({ key, count: ip.count, required: Math.max(1, Math.floor(Number(ip.item.required) || 1)) });
      } else stat.missing.push(key);
    });
    retiredPhotoCount += photosMap(sub?.photos).size - counted;
    return { key, status: viaLine ? 'done' : p.status, counts };
  });
  perItem.forEach((s) => {
    s.average = s.targetCount > 0 ? s.photoCount / s.targetCount : 0;
    s.rate = s.targetCount > 0 ? s.done.length / s.targetCount : 0;
  });
  return {
    items: perItem,
    stores,
    doneStores: stores.filter((s) => s.status === 'done').length,
    partialStores: stores.filter((s) => s.status === 'partial').length,
    noneStores: stores.filter((s) => s.status === 'none').length,
    retiredPhotoCount,
  };
};

export const PROGRESS_STATUS_LABEL: Record<ScheduleProgressStatus, string> = {
  done: '提出済み',
  partial: '一部提出',
  none: '未提出',
};

/** 「未達成の店舗をコピー」の文面。未達成も一部も無ければ null */
export const missingStoresText = (
  scheduleTitle: string,
  stat: ItemStat,
  storeName: (key: StoreKey) => string,
): string | null => {
  if (stat.missing.length === 0 && stat.partial.length === 0) return null;
  const lines = [`【${scheduleTitle}／${stat.item.label} 未提出のお知らせ】`];
  if (stat.missing.length > 0) {
    lines.push(`■未提出（${stat.missing.length}店舗）`, ...stat.missing.map(storeName));
  }
  if (stat.partial.length > 0) {
    lines.push(
      `■一部（${stat.partial.length}店舗）`,
      ...stat.partial.map((p) => `${storeName(p.key)}（${p.count}/${p.required}枚）`),
    );
  }
  lines.push('お手数ですが、提出をお願いします。');
  return lines.join('\n');
};

/**
 * 店舗×項目の表。1行目が見出し、各行が店舗、最終行が項目ごとの達成店舗数。
 * 店舗に表示しない項目は '-'
 */
export const statsTable = (stats: ScheduleStats, storeName: (key: StoreKey) => string): string[][] => {
  const header = ['店舗名', ...stats.items.map((s) => s.item.label), '状態'];
  const rows = stats.stores.map((s) => [
    storeName(s.key),
    ...s.counts.map((c) => (c === null ? '-' : String(c))),
    PROGRESS_STATUS_LABEL[s.status],
  ]);
  const footer = ['達成店舗数', ...stats.items.map((s) => `${s.done.length}/${s.targetCount}`), ''];
  return [header, ...rows, footer];
};

/** タブ区切り（Excel／スプレッドシートに貼る用）。タブ・改行は空白に */
export const toTsv = (table: string[][]): string =>
  table.map((row) => row.map((v) => v.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');

const csvCell = (v: string): string => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** CSV（BOM つき UTF-8、CRLF）。Excel で文字化けしないようにする */
export const toCsv = (table: string[][]): string =>
  '﻿' + table.map((row) => row.map(csvCell).join(',')).join('\r\n') + '\r\n';

/** 「スケジュール名_集計_YYYYMMDD.csv」。ファイル名に使えない文字は _ に */
export const csvFileName = (title: string, todayKey: string): string =>
  `${title.replace(/[\\/:*?"<>|\r\n]/g, '_')}_集計_${todayKey.replace(/-/g, '')}.csv`;
