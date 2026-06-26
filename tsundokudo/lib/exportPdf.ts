/**
 * レポートのPDF出力・共有
 *
 * - ネイティブ: expo-print でPDFを生成し、expo-sharing で共有シートを開く
 * - Web: ブラウザの印刷ダイアログ（「PDFに保存」で出力可能）
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

export async function exportReportPdf(report: ReportLike): Promise<ExportResult> {
  const html = buildReportHtml(report);

  if (Platform.OS === 'web') {
    // Web では印刷ダイアログを開く（ユーザーが「PDFに保存」を選択）
    await Print.printAsync({ html });
    return { ok: true };
  }

  const { uri } = await Print.printToFileAsync({ html });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: reportFileName(report),
      UTI: 'com.adobe.pdf',
    });
    return { ok: true };
  }

  return { ok: true, message: `PDFを作成しました: ${uri}` };
}
