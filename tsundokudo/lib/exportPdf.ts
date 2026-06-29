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

import { buildReportHtml, reportFileName } from '@/lib/reportHtml';
import type { MaintenanceReport, MaintenanceReportInsert } from '@/types/report';

type ReportLike = MaintenanceReport | MaintenanceReportInsert;

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
  return { ok: true };
}

export async function exportReportPdf(report: ReportLike): Promise<ExportResult> {
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
