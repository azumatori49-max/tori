/**
 * メンテナンスレポートを「スプレッドシート体裁」のHTMLに変換する。
 * expo-print に渡してPDF化／印刷する。
 */
import { calcBilling, supplyAmount, yen } from '@/lib/billing';
import { formatWorkDate } from '@/lib/format';
import type { MaintenanceReport, MaintenanceReportInsert } from '@/types/report';

/** HTMLエスケープ（XSS / 体裁崩れ防止） */
function esc(s: string): string {
  return (s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/\n/g, '<br/>');
}

type ReportLike = MaintenanceReport | MaintenanceReportInsert;

/** 写真グリッドのHTML（分類バッジ＋メモ付き） */
function photosHtml(photos: { uri: string; category: string; caption: string }[]): string {
  if (!photos.length) return '';
  return `<div class="photos">
    ${photos
      .map(
        (p) => `
      <div class="photo">
        <img src="${p.uri}" />
        <div class="photo-cap"><span class="badge">${esc(p.category)}</span>${esc(p.caption)}</div>
      </div>`,
      )
      .join('')}
  </div>`;
}

export function buildReportHtml(report: ReportLike): string {
  const b = calcBilling(report);

  const checklistRows = report.checklist
    .map(
      (c) => `
      <tr>
        <td class="name">${esc(c.name)}</td>
        <td class="center">${c.checked ? '✓' : ''}</td>
        <td>${esc(c.condition)}</td>
        <td>${esc(c.note)}</td>
        <td class="center">${esc(formatWorkDate(c.nextDate))}</td>
      </tr>`,
    )
    .join('');

  const pest = report.pestControl;
  const pestText = [
    pest.basic ? '基本駆除' : '',
    pest.antiDrug ? '対抗薬剤使用' : '',
    pest.strongPesticide ? '強殺虫剤' : '',
  ]
    .filter(Boolean)
    .join('　/　');

  const toppings = report.toppings.filter((t) => t.checked);
  const toppingRows = toppings.length
    ? toppings
        .map(
          (t) => `
      <tr>
        <td class="name">${esc(t.name)}</td>
        <td>${esc(t.comment)}</td>
        <td class="right">${t.fee ? '¥' + yen(t.fee) : ''}</td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="3" class="muted">なし</td></tr>';

  const diy = report.diy.filter((d) => d.checked);
  const diyBlock = diy.length
    ? diy
        .map(
          (d) => `
      <div class="block">
        <div class="block-head">
          <span class="block-name">${esc(d.name)}</span>
          ${d.fee ? `<span class="fee">追加費用 ¥${yen(d.fee)}</span>` : ''}
        </div>
        ${d.comment ? `<div class="block-body">${esc(d.comment)}</div>` : ''}
        ${photosHtml(d.photos)}
      </div>`,
        )
        .join('')
    : '';

  const annual = report.annualSchedule;
  const hasAnnual = annual && (annual.comment || annual.fee || annual.photos.length);
  const annualBlock = hasAnnual
    ? `<div class="section-title">年間スケジュール</div>
       <div class="block">
         ${annual.fee ? `<div class="block-head"><span></span><span class="fee">追加費用 ¥${yen(annual.fee)}</span></div>` : ''}
         ${annual.comment ? `<div class="block-body">${esc(annual.comment)}</div>` : ''}
         ${photosHtml(annual.photos)}
       </div>`
    : '';

  const supplyRows = report.supplies.length
    ? report.supplies
        .map(
          (s) => `
      <tr>
        <td class="name">${esc(s.name)}</td>
        <td class="right">¥${yen(s.unitPrice)}</td>
        <td class="center">${s.qty}</td>
        <td class="right">¥${yen(supplyAmount(s))}</td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="muted">なし</td></tr>';

  const photoBlock = report.photos.length
    ? `<div class="section-title">写真</div>${photosHtml(report.photos)}`
    : '';

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Hiragino Kaku Gothic ProN", "Yu Gothic", "Noto Sans JP", sans-serif;
    color: #0f172a; margin: 0; padding: 24px; font-size: 12px;
  }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #0E9488; padding-bottom: 10px; margin-bottom: 14px; }
  .head h1 { font-size: 20px; margin: 0; color: #0B7268; }
  .head .sub { font-size: 11px; color: #64748b; margin-top: 4px; }
  .bill-box { text-align: right; }
  .bill-box .total { font-size: 22px; font-weight: 800; color: #0B7268; }
  .bill-box .total small { font-size: 11px; color: #64748b; font-weight: 600; }
  .info { width: 100%; border-collapse: collapse; margin-bottom: 14px; }
  .info td { border: 1px solid #cbd5e1; padding: 6px 8px; vertical-align: top; }
  .info td.label { background: #ECFDF8; font-weight: 700; width: 110px; color: #0B7268; white-space: nowrap; }
  .section-title { font-size: 14px; font-weight: 800; color: #0B7268; border-left: 4px solid #0E9488; padding-left: 8px; margin: 16px 0 6px; }
  table.grid { width: 100%; border-collapse: collapse; margin-bottom: 8px; }
  table.grid th { background: #0E9488; color: #fff; font-weight: 700; padding: 6px 8px; border: 1px solid #0E9488; text-align: left; font-size: 11px; }
  table.grid td { border: 1px solid #cbd5e1; padding: 6px 8px; }
  table.grid td.name { font-weight: 600; }
  table.grid td.center, table.grid th.center { text-align: center; }
  table.grid td.right, table.grid th.right { text-align: right; }
  table.grid tr:nth-child(even) td { background: #F7FBFB; }
  .muted { color: #94a3b8; text-align: center; }
  .bill-breakdown { width: 280px; margin-left: auto; border-collapse: collapse; margin-top: 8px; }
  .bill-breakdown td { padding: 4px 8px; border-bottom: 1px solid #e2e8f0; }
  .bill-breakdown td.right { text-align: right; font-weight: 600; }
  .bill-breakdown tr.grand td { border-top: 2px solid #0E9488; border-bottom: none; font-size: 15px; color: #0B7268; font-weight: 800; padding-top: 6px; }
  .pest { padding: 6px 8px; border: 1px solid #cbd5e1; }
  .comment { padding: 8px; border: 1px solid #cbd5e1; min-height: 40px; white-space: pre-wrap; }
  .block { border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 10px; margin-bottom: 8px; }
  .block-head { display: flex; justify-content: space-between; align-items: center; }
  .block-name { font-weight: 700; }
  .fee { color: #0B7268; font-weight: 700; }
  .block-body { margin-top: 4px; white-space: pre-wrap; color: #334155; }
  .block .photos { margin-top: 6px; }
  .photos { display: flex; flex-wrap: wrap; gap: 10px; }
  .photo { width: 31%; border: 1px solid #e2e8f0; border-radius: 6px; overflow: hidden; }
  .photo img { width: 100%; height: 140px; object-fit: cover; display: block; }
  .photo-cap { padding: 5px 6px; font-size: 10px; color: #475569; }
  .badge { display: inline-block; background: #D6F2EE; color: #0B7268; border-radius: 8px; padding: 1px 6px; margin-right: 5px; font-weight: 700; }
  .footer { margin-top: 18px; text-align: center; color: #94a3b8; font-size: 10px; }
</style>
</head>
<body>
  <div class="head">
    <div>
      <h1>メンテナンスレポート</h1>
      <div class="sub">${esc(report.contractPlan)}プラン</div>
    </div>
    <div class="bill-box">
      <div class="total"><small>請求額（税込）</small><br/>¥${yen(b.taxIncluded)}</div>
    </div>
  </div>

  <table class="info">
    <tr>
      <td class="label">作業店舗</td><td>${esc(report.storeName)}</td>
      <td class="label">作業日</td><td>${esc(formatWorkDate(report.workDate))}</td>
    </tr>
    <tr>
      <td class="label">契約プラン</td><td>${esc(report.contractPlan)}</td>
      <td class="label">施工担当者</td><td>${esc(report.technician)}</td>
    </tr>
    <tr>
      <td class="label">御請求先</td><td colspan="3">${esc(report.billingTo)}</td>
    </tr>
  </table>

  <div class="section-title">定期点検</div>
  <table class="grid">
    <thead>
      <tr>
        <th style="width:24%">項目</th>
        <th class="center" style="width:8%">作業<br/>チェック</th>
        <th style="width:18%">状況</th>
        <th>備考</th>
        <th class="center" style="width:12%">次回作業<br/>予定日</th>
      </tr>
    </thead>
    <tbody>${checklistRows}</tbody>
  </table>

  <div class="section-title">害虫駆除</div>
  <div class="pest">${pestText || '<span class="muted">実施なし</span>'}</div>

  <div class="section-title">トッピング（追加作業）</div>
  <table class="grid">
    <thead><tr><th style="width:32%">品目</th><th>コメント</th><th class="right" style="width:18%">追加費用</th></tr></thead>
    <tbody>${toppingRows}</tbody>
  </table>

  ${diyBlock ? '<div class="section-title">プチDIY</div>' + diyBlock : ''}

  <div class="section-title">使用備品資材</div>
  <table class="grid">
    <thead><tr><th>品目</th><th class="right" style="width:16%">単価</th><th class="center" style="width:12%">数量</th><th class="right" style="width:18%">金額</th></tr></thead>
    <tbody>${supplyRows}</tbody>
  </table>

  <table class="bill-breakdown">
    <tr><td>メンテナンス</td><td class="right">¥${yen(b.maintenance)}</td></tr>
    <tr><td>トッピング</td><td class="right">¥${yen(b.toppings)}</td></tr>
    <tr><td>プチDIY</td><td class="right">¥${yen(b.diy)}</td></tr>
    <tr><td>年間スケジュール</td><td class="right">¥${yen(b.annual)}</td></tr>
    <tr><td>備品 資材 廃棄</td><td class="right">¥${yen(b.supplies)}</td></tr>
    <tr><td>税抜き</td><td class="right">¥${yen(b.taxExcluded)}</td></tr>
    <tr><td>消費税</td><td class="right">¥${yen(b.tax)}</td></tr>
    <tr class="grand"><td>請求額（税込）</td><td class="right">¥${yen(b.taxIncluded)}</td></tr>
  </table>

  <div class="section-title">コメント・提案</div>
  <div class="comment">${esc(report.comment) || '<span class="muted">—</span>'}</div>

  ${annualBlock}

  ${photoBlock}

  <div class="footer">衛生管理レポート</div>
</body>
</html>`;
}

/** 共有時のファイル名（例: メンテナンスレポート_まる助東松山駅前店_5-15） */
export function reportFileName(report: ReportLike): string {
  const date = formatWorkDate(report.workDate).replace(/\//g, '-');
  const store = report.storeName || '店舗未設定';
  return `メンテナンスレポート_${store}${date ? '_' + date : ''}`;
}
