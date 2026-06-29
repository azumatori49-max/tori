/**
 * メンテナンスレポートをPDF用HTMLに変換する。
 * expo-print に渡してPDF化／印刷する。
 *
 * デザインは「サービス報告書 / 請求書」スタイル（画面の入力フォームとは別物）。
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

/** 状況をモノクロのピルで表示。「できてない」のみ塗りで強調 */
function conditionPill(c: string): string {
  if (!c) return '<span class="muted-sm">—</span>';
  if (c === 'できてない') {
    return `<span class="pill pill-alert">${esc(c)}</span>`;
  }
  return `<span class="pill pill-ok">${esc(c)}</span>`;
}

/** 小サイズの写真グリッド（DIY/年間スケジュール内のインライン用） */
function photosHtml(photos: { uri: string; category: string; caption: string }[]): string {
  if (!photos.length) return '';
  return `<div class="photos">
    ${photos
      .map(
        (p) => `
      <figure class="photo">
        <img src="${p.uri}" />
        <figcaption><span class="badge">${esc(p.category)}</span>${esc(p.caption)}</figcaption>
      </figure>`,
      )
      .join('')}
  </div>`;
}

/** 作業写真のコンタクトシート（ラベルを写真の上に表示する3列グリッド・専用ページ） */
function photoSheet(photos: { uri: string; category: string; caption: string }[]): string {
  if (!photos.length) return '';
  const cells = photos
    .map(
      (p) => `
      <div class="sheet-cell">
        <div class="sheet-lbl">${esc(p.caption || p.category)}</div>
        <img src="${p.uri}" />
      </div>`,
    )
    .join('');
  return `<section class="photo-page">
    <div class="sec-label">作業写真</div>
    <div class="sheet">${cells}</div>
  </section>`;
}

export function buildReportHtml(report: ReportLike): string {
  const b = calcBilling(report);
  const doneCount = report.checklist.filter((c) => c.checked).length;

  const checklistRows = report.checklist
    .map(
      (c) => `
      <tr>
        <td class="c-name">${esc(c.name)}</td>
        <td class="c-center">${
          c.checked
            ? '<span class="tick">✓</span>'
            : '<span class="tick-off"></span>'
        }</td>
        <td>${conditionPill(c.condition)}</td>
        <td class="c-note">${esc(c.note) || '<span class="muted-sm">—</span>'}</td>
        <td class="c-center c-date">${esc(formatWorkDate(c.nextDate)) || '<span class="muted-sm">—</span>'}</td>
      </tr>`,
    )
    .join('');

  const pest = report.pestControl;
  const pestTags = [
    pest.basic ? '基本駆除' : '',
    pest.antiDrug ? '対抗薬剤使用' : '',
    pest.strongPesticide ? '強殺虫剤' : '',
  ].filter(Boolean);
  const pestHtml = pestTags.length
    ? pestTags.map((t) => `<span class="tag">${esc(t)}</span>`).join('')
    : '<span class="muted-sm">実施なし</span>';

  const toppings = report.toppings.filter((t) => t.checked);
  const toppingRows = toppings.length
    ? toppings
        .map(
          (t) => `
      <tr>
        <td class="c-name">${esc(t.name)}</td>
        <td>${esc(t.comment) || '<span class="muted-sm">—</span>'}</td>
        <td class="c-right">${t.fee ? '¥' + yen(t.fee) : '<span class="muted-sm">—</span>'}</td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="3" class="c-empty">なし</td></tr>';

  const diy = report.diy.filter((d) => d.checked);
  const diyBlock = diy.length
    ? `<div class="sec-label">プチDIY</div>` +
      diy
        .map(
          (d) => `
      <div class="panel">
        <div class="panel-head">
          <span class="panel-name">${esc(d.name)}</span>
          ${d.fee ? `<span class="fee">追加費用 ¥${yen(d.fee)}</span>` : ''}
        </div>
        ${d.comment ? `<div class="panel-body">${esc(d.comment)}</div>` : ''}
        ${photosHtml(d.photos)}
      </div>`,
        )
        .join('')
    : '';

  const annual = report.annualSchedule;
  const hasAnnual = annual && (annual.comment || annual.fee || annual.photos.length);
  const annualBlock = hasAnnual
    ? `<div class="sec-label">年間スケジュール</div>
       <div class="panel">
         ${annual.fee ? `<div class="panel-head"><span></span><span class="fee">追加費用 ¥${yen(annual.fee)}</span></div>` : ''}
         ${annual.comment ? `<div class="panel-body">${esc(annual.comment)}</div>` : ''}
         ${photosHtml(annual.photos)}
       </div>`
    : '';

  const supplyRows = report.supplies.length
    ? report.supplies
        .map(
          (s) => `
      <tr>
        <td class="c-name">${esc(s.name)}</td>
        <td class="c-right">¥${yen(s.unitPrice)}</td>
        <td class="c-center">${s.qty}</td>
        <td class="c-right">¥${yen(supplyAmount(s))}</td>
      </tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="c-empty">なし</td></tr>';

  const photoBlock = photoSheet(report.photos);

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<style>
  * { box-sizing: border-box; }
  :root { --teal:#374151; --teal-d:#111827; --ink:#111827; --sub:#6b7280; --line:#e5e7eb; }
  body {
    font-family: "游ゴシック体","YuGothic","Yu Gothic","游ゴシック Medium","Hiragino Kaku Gothic ProN","Noto Sans JP",sans-serif;
    color: var(--ink); margin: 0; padding: 28px 30px; font-size: 12px; line-height: 1.55;
  }
  .muted-sm { color:#b0b9c2; }

  /* ── ヘッダー ── */
  .doc-head { display:flex; justify-content:space-between; align-items:stretch; gap:18px; margin-bottom:18px; }
  .brand { display:flex; flex-direction:column; justify-content:center; }
  .doc-kicker { font-size:10px; letter-spacing:3px; color:var(--teal); font-weight:700; }
  .doc-title { font-size:26px; font-weight:800; color:var(--ink); margin-top:2px; letter-spacing:1px; }
  .doc-sub { font-size:11px; color:var(--sub); margin-top:4px; }
  .summary-card { background:linear-gradient(135deg,var(--teal),var(--teal-d)); color:#fff; border-radius:14px; padding:14px 20px; min-width:210px; text-align:right; box-shadow:0 4px 14px rgba(17,24,39,.22); }
  .sc-label { font-size:10px; opacity:.9; letter-spacing:1px; }
  .sc-amount { font-size:28px; font-weight:800; margin:2px 0; }
  .sc-tax { font-size:10px; opacity:.85; }
  .sc-meta { font-size:10px; opacity:.9; margin-top:8px; border-top:1px solid rgba(255,255,255,.3); padding-top:6px; }

  /* ── 基本情報 ── */
  .meta { display:grid; grid-template-columns:1fr 1fr; gap:1px; background:var(--line); border:1px solid var(--line); border-radius:10px; overflow:hidden; margin-bottom:6px; }
  .meta .cell { background:#fff; padding:8px 12px; }
  .meta .cell.full { grid-column:1 / -1; }
  .meta .k { display:block; font-size:9.5px; color:var(--teal-d); font-weight:700; letter-spacing:.5px; }
  .meta .v { display:block; font-size:13px; margin-top:1px; }

  /* ── セクション見出し ── */
  .sec-label { font-size:13px; font-weight:800; color:var(--ink); margin:18px 0 7px; padding-left:10px; border-left:4px solid var(--teal); }

  /* ── テーブル ── */
  table.tbl { width:100%; border-collapse:collapse; }
  table.tbl thead th { font-size:10px; color:var(--sub); font-weight:700; text-align:left; padding:6px 10px; border-bottom:2px solid var(--teal); background:#f3f4f6; }
  table.tbl td { padding:7px 10px; border-bottom:1px solid var(--line); vertical-align:middle; font-size:11.5px; }
  table.tbl tbody tr:last-child td { border-bottom:none; }
  .c-name { font-weight:600; }
  .c-center { text-align:center; }
  .c-right { text-align:right; font-variant-numeric:tabular-nums; }
  .c-date { color:var(--teal-d); font-weight:600; }
  .c-note { color:#475569; }
  .c-empty { text-align:center; color:#b0b9c2; padding:12px; }
  .tick { display:inline-block; width:17px; height:17px; line-height:17px; text-align:center; border-radius:50%; background:#111827; color:#fff; font-size:11px; font-weight:900; }
  .tick-off { display:inline-block; width:15px; height:15px; border:1.5px solid #cbd5e1; border-radius:50%; }
  .pill { display:inline-block; padding:2px 9px; border-radius:11px; font-size:10.5px; font-weight:700; }
  .pill-ok { background:#f3f4f6; color:#374151; border:1px solid #d1d5db; }
  .pill-alert { background:#111827; color:#fff; border:1px solid #111827; }

  /* ── タグ（害虫駆除） ── */
  .tags { display:flex; flex-wrap:wrap; gap:6px; padding:4px 0; }
  .tag { display:inline-block; background:#f3f4f6; color:var(--teal-d); border:1px solid #d1d5db; border-radius:14px; padding:4px 12px; font-size:11px; font-weight:700; }

  /* ── パネル（DIY / 年間） ── */
  .panel { border:1px solid var(--line); border-radius:10px; padding:10px 12px; margin-bottom:8px; page-break-inside:avoid; }
  .panel-head { display:flex; justify-content:space-between; align-items:center; }
  .panel-name { font-weight:700; }
  .fee { color:var(--teal-d); font-weight:800; font-size:11px; }
  .panel-body { margin-top:5px; white-space:pre-wrap; color:#334155; }
  .panel .photos { margin-top:8px; }

  /* ── 請求内訳 ── */
  .invoice { display:flex; justify-content:flex-end; margin-top:10px; }
  table.inv { width:300px; border-collapse:collapse; }
  table.inv td { padding:6px 12px; font-size:11.5px; }
  table.inv tr td:last-child { text-align:right; font-weight:600; font-variant-numeric:tabular-nums; }
  table.inv .sub td { color:var(--sub); border-bottom:1px solid var(--line); }
  table.inv .ex td { border-top:1px solid #cbd5e1; font-weight:700; }
  table.inv .grand td { background:var(--teal); color:#fff; font-size:14px; font-weight:800; border-radius:0; }
  table.inv .grand td:first-child { border-radius:8px 0 0 8px; }
  table.inv .grand td:last-child { border-radius:0 8px 8px 0; font-size:16px; }

  /* ── 写真 ── */
  .photos { display:flex; flex-wrap:wrap; gap:10px; }
  .photo { width:31.5%; margin:0; border:1px solid var(--line); border-radius:9px; overflow:hidden; page-break-inside:avoid; }
  .photo img { width:100%; height:135px; object-fit:cover; display:block; background:#eef2f4; }
  .photo figcaption { padding:6px 8px; font-size:10px; color:#475569; }
  .badge { display:inline-block; background:#e5e7eb; color:var(--teal-d); border-radius:7px; padding:1px 6px; margin-right:5px; font-weight:700; font-size:9px; }

  /* ── 作業写真ページ（コンタクトシート） ── */
  .photo-page { page-break-before:always; }
  .sheet { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  .sheet-cell { page-break-inside:avoid; }
  .sheet-lbl { font-size:10.5px; font-weight:700; color:var(--ink); margin-bottom:3px; }
  .sheet-cell img { width:100%; height:205px; object-fit:cover; display:block; border:1px solid var(--line); background:#eef2f4; }

  /* ── コメント ── */
  .comment { border:1px solid var(--line); border-left:4px solid var(--teal); border-radius:8px; padding:10px 12px; min-height:38px; white-space:pre-wrap; background:#fafafa; }

  /* ── 署名欄 ── */
  .sign { display:grid; grid-template-columns:1fr 1fr; gap:14px; margin-top:22px; page-break-inside:avoid; }
  .sign-box { border:1px solid var(--line); border-radius:10px; padding:10px 12px; }
  .sign-box .k { font-size:10px; color:var(--sub); font-weight:700; }
  .sign-line { margin-top:14px; border-top:1px solid #cbd5e1; padding-top:5px; font-size:14px; min-height:20px; }

  .footer { margin-top:20px; padding-top:10px; border-top:1px solid var(--line); display:flex; justify-content:space-between; color:#9aa6b1; font-size:9.5px; }
</style>
</head>
<body>
  <header class="doc-head">
    <div class="brand">
      <div class="doc-kicker">MAINTENANCE REPORT</div>
      <div class="doc-title">メンテナンスレポート</div>
      <div class="doc-sub">${esc(report.contractPlan)}プラン ・ 衛生管理 定期点検報告書</div>
    </div>
    <div class="summary-card">
      <div class="sc-label">ご請求金額（税込）</div>
      <div class="sc-amount">¥${yen(b.taxIncluded)}</div>
      <div class="sc-tax">（税抜 ¥${yen(b.taxExcluded)}）</div>
      <div class="sc-meta">${esc(report.storeName) || '店舗未設定'}<br/>${esc(formatWorkDate(report.workDate)) || '日付未設定'} 実施</div>
    </div>
  </header>

  <section class="meta">
    <div class="cell"><span class="k">作業店舗</span><span class="v">${esc(report.storeName) || '—'}</span></div>
    <div class="cell"><span class="k">作業日</span><span class="v">${esc(formatWorkDate(report.workDate)) || '—'}</span></div>
    <div class="cell"><span class="k">契約プラン</span><span class="v">${esc(report.contractPlan) || '—'}</span></div>
    <div class="cell"><span class="k">施工担当者</span><span class="v">${esc(report.technician) || '—'}</span></div>
    <div class="cell full"><span class="k">御請求先</span><span class="v">${esc(report.billingTo) || '—'}</span></div>
  </section>

  <div class="sec-label">定期点検 <span style="font-size:10px;color:#94a3b8;font-weight:600">（実施 ${doneCount} / ${report.checklist.length}）</span></div>
  <table class="tbl">
    <thead>
      <tr>
        <th style="width:26%">項目</th>
        <th class="c-center" style="width:7%">実施</th>
        <th style="width:20%">状況</th>
        <th>備考</th>
        <th class="c-center" style="width:13%">次回予定</th>
      </tr>
    </thead>
    <tbody>${checklistRows}</tbody>
  </table>

  <div class="sec-label">害虫駆除</div>
  <div class="tags">${pestHtml}</div>

  <div class="sec-label">トッピング（追加作業）</div>
  <table class="tbl">
    <thead><tr><th style="width:34%">品目</th><th>コメント</th><th class="c-right" style="width:18%">追加費用</th></tr></thead>
    <tbody>${toppingRows}</tbody>
  </table>

  ${diyBlock}

  <div class="sec-label">使用備品資材</div>
  <table class="tbl">
    <thead><tr><th>品目</th><th class="c-right" style="width:18%">単価</th><th class="c-center" style="width:12%">数量</th><th class="c-right" style="width:20%">金額</th></tr></thead>
    <tbody>${supplyRows}</tbody>
  </table>

  <div class="invoice">
    <table class="inv">
      <tr class="sub"><td>メンテナンス</td><td>¥${yen(b.maintenance)}</td></tr>
      <tr class="sub"><td>トッピング</td><td>¥${yen(b.toppings)}</td></tr>
      <tr class="sub"><td>プチDIY</td><td>¥${yen(b.diy)}</td></tr>
      <tr class="sub"><td>年間スケジュール</td><td>¥${yen(b.annual)}</td></tr>
      <tr class="sub"><td>備品 資材 廃棄</td><td>¥${yen(b.supplies)}</td></tr>
      <tr class="ex"><td>小計（税抜）</td><td>¥${yen(b.taxExcluded)}</td></tr>
      <tr class="sub"><td>消費税</td><td>¥${yen(b.tax)}</td></tr>
      <tr class="grand"><td>ご請求金額（税込）</td><td>¥${yen(b.taxIncluded)}</td></tr>
    </table>
  </div>

  <div class="sec-label">コメント・提案</div>
  <div class="comment">${esc(report.comment) || '<span class="muted-sm">—</span>'}</div>

  ${annualBlock}

  <section class="sign">
    <div class="sign-box"><span class="k">施工担当者</span><div class="sign-line">${esc(report.technician) || ''}</div></div>
    <div class="sign-box"><span class="k">確認（お客様）</span><div class="sign-line"></div></div>
  </section>

  ${photoBlock}

  <div class="footer">
    <span>衛生管理メンテナンスレポート</span>
    <span>${esc(report.storeName)}　${esc(formatWorkDate(report.workDate))}</span>
  </div>
</body>
</html>`;
}

/** 共有時のファイル名（例: メンテナンスレポート_まる助東松山駅前店_5-15） */
export function reportFileName(report: ReportLike): string {
  const date = formatWorkDate(report.workDate).replace(/\//g, '-');
  const store = report.storeName || '店舗未設定';
  return `メンテナンスレポート_${store}${date ? '_' + date : ''}`;
}
