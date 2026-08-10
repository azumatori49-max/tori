/**
 * レポートのPDF出力・共有
 *
 * - ネイティブ: expo-print でPDFを生成し、expo-sharing で共有シートを開く
 * - Web: 別ウィンドウを開いてテンプレートHTMLを印刷ダイアログで「PDFに保存」
 *   （expo-print.printAsync を Web で呼ぶと、テンプレートではなく
 *    現在表示中のページが印刷されてしまうため独自実装）
 */
import { Platform } from 'react-native';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { buildReportHtml, buildReportsHtml, reportFileName } from '@/lib/reportHtml';
import { officialStoreName } from '@/lib/storeNames';
import { useReportStore } from '@/store/reportStore';
import type { MaintenanceReport, MaintenanceReportInsert } from '@/types/report';

type ReportLike = MaintenanceReport | MaintenanceReportInsert;

/** 店舗マスタの正式名称（例: 鶏ヤロー　柏店）にそろえてから出力する */
function withOfficialName<T extends ReportLike>(report: T): T {
  const master = useReportStore.getState().settings.stores;
  return { ...report, storeName: officialStoreName(report.storeName, master) };
}

export interface ExportResult {
  ok: boolean;
  message?: string;
}

/** Webで別ウィンドウを開いて印刷ダイアログを呼ぶ */
function printOnWeb(html: string, fileName: string): ExportResult {
  if (typeof window === 'undefined') {
    return { ok: false, message: 'この環境では印刷できません。' };
  }
  const w = window.open('', '_blank');
  if (!w) {
    return {
      ok: false,
      message:
        'ポップアップがブロックされました。ブラウザのアドレスバーから「ポップアップを許可」してください。',
    };
  }
  // 印刷ダイアログのデフォルトファイル名に使われる
  const titledHtml = html.replace(
    '<head>',
    `<head><title>${fileName}</title>`,
  );
  w.document.open();
  w.document.write(titledHtml);
  w.document.close();
  // 画像・フォント読み込みを待ってから印刷
  w.addEventListener('load', () => {
    setTimeout(() => {
      w.focus();
      w.print();
    }, 500);
  });
  // スマホは「PDFに保存→共有」の手順が分かりにくいため案内を返す
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone|iPad|Android/i.test(ua)) {
    return {
      ok: true,
      message:
        'PDFの共有方法\n\n' +
        '【iPhone】開いた印刷画面でプレビュー（小さいページ画像）をタップ → 右上の共有ボタンから LINE・メールなどに送れます。\n\n' +
        '【Android】印刷画面で「PDF形式で保存」を選んで保存 → ファイルから共有できます。\n\n' +
        '※ 相手に見せるだけなら、設定タブの「閲覧用リンクを共有」が一番かんたんです。',
    };
  }
  return { ok: true };
}

/** 複数レポートを1つのPDFにまとめて出力（請求書作成用） */
export async function exportReportsPdf(
  reports: ReportLike[],
  fileName: string,
): Promise<ExportResult> {
  if (reports.length === 0) return { ok: false, message: '対象のレポートがありません。' };
  const html = buildReportsHtml(reports.map(withOfficialName));

  if (Platform.OS === 'web') {
    return printOnWeb(html, fileName);
  }

  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: fileName,
      UTI: 'com.adobe.pdf',
    });
    return { ok: true };
  }
  return { ok: true, message: `PDFを作成しました: ${uri}` };
}

export async function exportReportPdf(rawReport: ReportLike): Promise<ExportResult> {
  const report = withOfficialName(rawReport);
  const html = buildReportHtml(report);
  const fileName = reportFileName(report);

  if (Platform.OS === 'web') {
    return printOnWeb(html, fileName);
  }

  const { uri } = await Print.printToFileAsync({ html });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: fileName,
      UTI: 'com.adobe.pdf',
    });
    return { ok: true };
  }

  return { ok: true, message: `PDFを作成しました: ${uri}` };
}
