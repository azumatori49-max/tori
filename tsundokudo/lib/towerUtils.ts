/**
 * towerUtils – 積読タワー 高さ計算ロジック
 *
 * 設計書 5章 / 5-2 仕様
 * ─ スケール ──────────────────────────────
 *  ページ数 × 0.1mm = 本の厚み
 *  PX_PER_MM px = 1mm の画面上スケール
 */

import type { Book } from '@/types/database';

// ─── スケール定数 ─────────────────────────────────────────────
/** 1ページあたりの厚み (mm) */
export const MM_PER_PAGE = 0.1;

/** 画面上の 1mm あたりのピクセル数 */
export const PX_PER_MM = 2;

/** 表示上の最小本厚み (px) — 薄い本でも認識できるように */
export const BOOK_MIN_PX = 14;

/** 本の表示幅 (px) — タワー左カラムを満たす */
export const BOOK_DISPLAY_WIDTH_RATIO = 0.62;

// ─── 比較オブジェクト型 (設計書 5-2) ──────────────────────────
export type ComparisonObject = {
  /** 一意識別子 */
  id: string;
  /** 名称 */
  label: string;
  /** 補足説明 */
  description: string;
  /** 実寸の高さ (mm) */
  heightMm: number;
  /** 絵文字アイコン */
  emoji: string;
  /** シルエット表示色 */
  color: string;
  /**
   * SVG viewBox の自然な幅 (mm 単位)。
   * 高さは heightMm、幅はこの値を基準にレンダリング時に proportional scale。
   */
  naturalWidthMm: number;
};

// ─── 比較オブジェクト一覧 (設計書 5-2) ───────────────────────
/** 積読タワーと比較するオブジェクト。heightMm 昇順 */
export const COMPARISON_MILESTONES: ComparisonObject[] = [
  {
    id: 'hamster',
    label: 'ハムスター',
    description: 'ゴールデンハムスターが直立した高さ',
    heightMm: 100,
    emoji: '🐹',
    color: '#C8956C',
    naturalWidthMm: 80,
  },
  {
    id: 'petbottle',
    label: 'ペットボトル 500ml',
    description: '一般的な 500ml ペットボトルの高さ',
    heightMm: 200,
    emoji: '🍶',
    color: '#60A5FA',
    naturalWidthMm: 65,
  },
  {
    id: 'cat',
    label: '猫（立ち上がり）',
    description: '猫が後ろ足で立ったときの高さ',
    heightMm: 500,
    emoji: '🐱',
    color: '#9CA3AF',
    naturalWidthMm: 200,
  },
  {
    id: 'child',
    label: '小学1年生',
    description: '6歳の平均身長',
    heightMm: 1160,
    emoji: '🧒',
    color: '#34D399',
    naturalWidthMm: 300,
  },
  {
    id: 'adult',
    label: '成人男性',
    description: '日本人成人男性の平均身長',
    heightMm: 1710,
    emoji: '🧍',
    color: '#818CF8',
    naturalWidthMm: 450,
  },
  {
    id: 'door',
    label: '玄関ドア',
    description: '一般的な室内ドアの高さ',
    heightMm: 2000,
    emoji: '🚪',
    color: '#A78BFA',
    naturalWidthMm: 900,
  },
  {
    id: 'giraffe',
    label: 'キリン',
    description: 'キリンの平均的な全高',
    heightMm: 5500,
    emoji: '🦒',
    color: '#FCD34D',
    naturalWidthMm: 2400,
  },
  {
    id: 'building',
    label: '10階建てビル',
    description: '1フロア 3m × 10階 = 30m',
    heightMm: 30000,
    emoji: '🏢',
    color: '#94A3B8',
    naturalWidthMm: 15000,
  },
];

// ─── 計算ヘルパー ─────────────────────────────────────────────

/** 1冊の厚み (mm) */
export function bookThicknessMm(totalPages: number | null): number {
  return (totalPages ?? 0) * MM_PER_PAGE;
}

/** 本リストの合計高さ (mm) */
export function totalHeightMm(books: Book[]): number {
  return books.reduce((sum, b) => sum + bookThicknessMm(b.total_pages), 0);
}

/** mm → 画面ピクセル変換 */
export function mmToPx(mm: number): number {
  return mm * PX_PER_MM;
}

/** 1冊の表示高さ (px)。最小値保証あり */
export function bookDisplayPx(totalPages: number | null): number {
  return Math.max(BOOK_MIN_PX, mmToPx(bookThicknessMm(totalPages)));
}

/**
 * 高さを人間が読みやすい文字列にフォーマット
 * @example 52.5 → "5.3cm", 1750 → "1.75m"
 */
export function formatHeight(mm: number): string {
  if (mm < 10) return `${mm.toFixed(1)} mm`;
  if (mm < 1000) return `${(mm / 10).toFixed(1)} cm`;
  return `${(mm / 1000).toFixed(2)} m`;
}

/**
 * 現在の高さに対して「達成済みの最上位マイルストーン」を返す。
 * ひとつも達成していなければ null。
 */
export function getAchievedMilestone(heightMm: number): ComparisonObject | null {
  const achieved = COMPARISON_MILESTONES.filter((m) => m.heightMm <= heightMm);
  return achieved.at(-1) ?? null;
}

/**
 * 次に達成すべきマイルストーンを返す。
 * すべて達成済みなら null。
 */
export function getNextMilestone(heightMm: number): ComparisonObject | null {
  return COMPARISON_MILESTONES.find((m) => m.heightMm > heightMm) ?? null;
}

/**
 * 現在のマイルストーンから次のマイルストーンへの進捗 (0.0 – 1.0)
 */
export function milestoneProgress(heightMm: number): number {
  const achieved = getAchievedMilestone(heightMm);
  const next = getNextMilestone(heightMm);
  if (!next) return 1.0;
  const fromMm = achieved?.heightMm ?? 0;
  return Math.min(1, (heightMm - fromMm) / (next.heightMm - fromMm));
}

/**
 * 比較オブジェクトの表示高さ (px) — mmToPx と同等だが明示的なエントリーポイント
 */
export function comparisonDisplayPx(obj: ComparisonObject): number {
  return mmToPx(obj.heightMm);
}
