/**
 * ネズミ駆除サービスのデータモデル
 *
 * 店舗ごとに年間契約を管理し、毎月の点検を履歴として残す。
 */
import type { PestPresence, ReportPhoto } from './report';

/** 毎月の点検1回分 */
export interface RatVisit {
  id: string;
  /** 点検日（YYYY-MM-DD） */
  date: string;
  /** 作業内容（ベイト交換・トラップ設置・侵入口チェックなど） */
  work: string;
  /** 発生状況（多い/少ない/見ない） */
  presence: PestPresence | '';
  /** 写真（枚数無制限） */
  photos: ReportPhoto[];
}

/** 契約更新の記録 */
export interface RatRenewal {
  /** 更新した日 */
  date: string;
  /** 延長した期間（月） */
  months: number;
}

/** 店舗ごとのネズミ駆除契約 */
export interface RatContract {
  id: string;
  /** 店舗名 */
  storeName: string;
  /** 坪数 */
  tsubo: number;
  /** 初回施工費（円・税抜）。既定は料金表、契約ごとに変更できる */
  initialFee: number;
  /** 月額料金（円・税抜）。既定は料金表、契約ごとに変更できる */
  monthlyFee: number;
  /** 契約開始日（YYYY-MM-DD） */
  startDate: string;
  /** 契約満了日（開始日の1年後。更新で延長される） */
  endDate: string;
  /** 更新履歴 */
  renewals: RatRenewal[];
  /** メモ（侵入口の場所など） */
  note: string;
  /** 点検履歴（新しい順に表示） */
  visits: RatVisit[];
  createdAt: string;
  updatedAt: string;
}

/** 新規作成用 */
export type RatContractInsert = Omit<RatContract, 'id' | 'createdAt' | 'updatedAt'>;
