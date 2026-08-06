/**
 * 請求用CSVのダウンロード（Webのみ）。
 * Excelで文字化けしないよう BOM 付き UTF-8 で出力する。
 */
import { Platform } from 'react-native';

import { calcBilling } from '@/lib/billing';
import { formatWorkDate } from '@/lib/format';
import type { MaintenanceReport } from '@/types/report';

function csvCell(v: string | number): string {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function downloadReportsCsv(
  reports: MaintenanceReport[],
  fileName: string,
): { ok: boolean; message?: string } {
  if (Platform.OS !== 'web' || typeof document === 'undefined') {
    return { ok: false, message: 'CSVダウンロードはWeb版でご利用ください。' };
  }
  const header = [
    '施工日',
    '会社名',
    '店舗名',
    '契約プラン',
    '種類',
    '施工担当者',
    '小計（税抜）',
    '消費税',
    '請求額（税込）',
    '請求対応済',
  ];
  const rows = reports.map((r) => {
    const b = calcBilling(r);
    return [
      formatWorkDate(r.workDate),
      r.company,
      r.storeName,
      r.contractPlan,
      r.reportType === 'order' ? 'オーダー工事' : 'メンテナンス',
      r.technician,
      b.taxExcluded,
      b.tax,
      b.taxIncluded,
      r.billingDone ? '済' : '',
    ];
  });
  const csv =
    '﻿' +
    [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return { ok: true };
}
