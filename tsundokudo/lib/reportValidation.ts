/**
 * レポートの完成チェック。
 *
 * 保存はいつでも可能（一時保存）。
 * PDF出力（提出）の時点で、必須の写真・選択が揃っているかを検査する。
 */
import { OPTIONAL_PHOTO_CHECK_NAMES } from '@/constants/hygiene';
import type { MaintenanceReportInsert } from '@/types/report';

/**
 * PDF出力できない理由を返す（問題なければ null）。
 * トッピングを除く各セクションの写真と、害虫の状況の選択が必須。
 */
export function pdfBlockReason(r: MaintenanceReportInsert): string | null {
  if (!r.pestControl.presence) {
    return '害虫駆除の「多い・少ない・見ない」を選択してください。';
  }
  if (r.photos.length === 0) {
    return '「写真」欄（店舗外観など）に写真を1枚以上添付してください。';
  }
  const noPhotoCheck = r.checklist.find(
    (c) => c.photos.length === 0 && !OPTIONAL_PHOTO_CHECK_NAMES.includes(c.name),
  );
  if (noPhotoCheck) {
    return `定期点検「${noPhotoCheck.name}」に写真を添付してください。`;
  }
  if (r.pestControl.photos.length === 0) {
    return '害虫駆除の欄に写真を1枚以上添付してください。';
  }
  const noPhotoDiy = r.diy.find((d) => d.photos.length === 0);
  if (noPhotoDiy) {
    return `プチDIY「${noPhotoDiy.name.trim() || '追加した項目'}」に写真を添付してください。`;
  }
  const annual = r.annualSchedule;
  if ((annual.comment.trim() || annual.fee > 0) && annual.photos.length === 0) {
    return '年間スケジュールを入力した場合は写真を添付してください。';
  }
  return null;
}
