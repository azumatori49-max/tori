/**
 * メンテナンスレポートをPDF用HTMLに変換する。
 * expo-print に渡してPDF化／印刷する。
 *
 * デザインは元のスプレッドシート体裁を再現（色付きの表組み）。
 * 写真は末尾の専用ページにラベル付きグリッドで掲載する。
 */
import { calcBilling, supplyAmount, yen } from '@/lib/billing';
import { formatWorkDate } from '@/lib/format';
import type { MaintenanceReport, MaintenanceReportInsert, ReportPhoto } from '@/types/report';

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

/** チェックボックス（元スプシの ☑ / ☐ を CSS で再現） */
function cb(checked: boolean): string {
  return `<span class="cb${checked ? ' on' : ''}">${checked ? '✓' : ''}</span>`;
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
    <div class="ps-title">作業写真</div>
    <div class="sheet">${cells}</div>
  </section>`;
}

export function buildReportHtml(report: ReportLike): string {
  const b = calcBilling(report);

  // 請求ボックスに追加作業費（トッピング+DIY+年間）をまとめて表示
  const extra = b.toppings + b.diy + b.annual;

  // 点検表
  const checklistRows = report.checklist
    .map(
      (c) => `
      <tr>
        <td class="blue name">${esc(c.name)}</td>
        <td class="ctr">${cb(c.checked)}</td>
        <td>${esc(c.condition)}</td>
        <td>${esc(c.note)}</td>
        <td class="ctr">${esc(formatWorkDate(c.nextDate))}</td>
      </tr>`,
    )
    .join('');

  const pest = report.pestControl;

  // トッピング（定型＋追加分すべて表示）
  const toppingRows = report.toppings
    .map(
      (t) => `
      <tr>
        <td class="purple name">${esc(t.name) || '&nbsp;'}</td>
        <td class="ctr">${cb(t.checked)}</td>
        <td>${esc(t.comment)}</td>
        <td class="rt">${t.fee ? '¥' + yen(t.fee) : ''}</td>
      </tr>`,
    )
    .join('');

  // プチDIY
  const diyRows = report.diy
    .map(
      (d) => `
      <tr>
        <td class="yellow name">${esc(d.name) || '&nbsp;'}</td>
        <td class="ctr">${cb(d.checked)}</td>
        <td>${esc(d.comment)}</td>
        <td class="rt">${d.fee ? '¥' + yen(d.fee) : ''}</td>
      </tr>`,
    )
    .join('');

  // 使用備品資材（最低5行確保して表組みらしく）
  const supplyData = report.supplies.map(
    (s) => `
      <tr>
        <td class="name">${esc(s.name)}</td>
        <td class="rt">${s.unitPrice ? '¥' + yen(s.unitPrice) : ''}</td>
        <td class="ctr">${s.qty || ''}</td>
        <td class="rt">${supplyAmount(s) ? '¥' + yen(supplyAmount(s)) : ''}</td>
      </tr>`,
  );
  while (supplyData.length < 4) {
    supplyData.push('<tr><td>&nbsp;</td><td></td><td></td><td></td></tr>');
  }
  const supplyRows = supplyData.join('');

  // 店舗写真（ヘッダー右上）。店舗外観があれば優先、なければ先頭
  const headerPhoto =
    report.photos.find((p) => p.category === '店舗外観') ?? report.photos[0];

  // 写真ページ：全セクションの写真を集約
  const allPhotos: ReportPhoto[] = [
    ...report.photos,
    ...report.diy.flatMap((d) => d.photos),
    ...report.annualSchedule.photos,
  ];

  const annual = report.annualSchedule;

  return `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700;800&display=swap" />
<style>
  * { box-sizing: border-box; }
  body {
    font-family: "Noto Sans JP","Noto Sans CJK JP","Hiragino Kaku Gothic ProN",sans-serif;
    color: #000; margin: 0; padding: 16px 18px; font-size: 10.5px; line-height: 1.4;
  }
  /* 色（Excel風） */
  :root {
    --bd:#7f7f7f; --blue:#bdd7ee; --purple:#b4a7d6; --yellow:#ffff00;
    --cream:#fff2cc; --orange:#fce4d6; --green:#d9ead3; --gray:#d9d9d9;
  }

  .title {
    text-align:center; font-size:16px; font-weight:800; padding:6px 0;
    border:1px solid var(--bd); border-bottom:none; background:#fff;
  }

  /* ヘッダー（情報 + 請求 + 写真） */
  .head { display:flex; border:1px solid var(--bd); }
  .head .col-info { flex:1.4; }
  .head .col-bill { flex:1; border-left:1px solid var(--bd); }
  .head .col-photo { width:150px; border-left:1px solid var(--bd); padding:4px; display:flex; align-items:center; justify-content:center; }
  .head .col-photo img { max-width:100%; max-height:120px; object-fit:cover; }
  .kv { display:flex; border-bottom:1px solid var(--bd); }
  .kv:last-child { border-bottom:none; }
  .kv .k { width:74px; flex:none; background:#f2f2f2; font-weight:700; padding:4px 6px; border-right:1px solid var(--bd); }
  .kv .v { flex:1; padding:4px 6px; }
  .kv .v.orange { background:var(--orange); font-weight:700; }
  .kv .v.amt { font-weight:800; font-size:13px; }

  /* 表 */
  table.grid { width:100%; border-collapse:collapse; }
  table.grid th, table.grid td { border:1px solid var(--bd); padding:4px 6px; vertical-align:middle; }
  table.grid th { background:#f2f2f2; font-weight:700; font-size:10px; }
  td.name { font-weight:700; }
  td.ctr { text-align:center; }
  td.rt { text-align:right; font-variant-numeric:tabular-nums; }
  td.blue { background:var(--blue); }
  td.purple { background:var(--purple); }
  td.yellow { background:var(--yellow); }
  td.gray { background:var(--gray); font-weight:700; }

  .cb { display:inline-block; width:13px; height:13px; border:1px solid #333; background:#fff; line-height:12px; text-align:center; font-size:11px; font-weight:900; color:#000; }
  .cb.on { background:#fff; }

  /* セクション帯 */
  .band { border:1px solid var(--bd); border-top:none; padding:5px 8px; font-size:13px; font-weight:800; }
  .band.cream { background:var(--cream); }
  .band.green { background:var(--green); }
  .band.small { font-size:11px; }

  /* 害虫駆除 */
  .pest { display:flex; align-items:stretch; border:1px solid var(--bd); border-top:none; }
  .pest .ph { font-size:18px; font-weight:800; padding:6px 14px; border-right:1px solid var(--bd); display:flex; align-items:center; }
  .pest .pi { display:flex; align-items:center; gap:8px; padding:6px 14px; border-right:1px solid var(--bd); }

  .mt { margin-top:8px; }
  .annual-body { border:1px solid var(--bd); border-top:none; padding:6px 8px; white-space:pre-wrap; min-height:30px; }
  .cmt { border:1px solid var(--bd); border-top:none; padding:6px 8px; white-space:pre-wrap; min-height:34px; }

  /* 写真ページ */
  .photo-page { page-break-before:always; }
  .ps-title { font-size:14px; font-weight:800; border-left:4px solid #333; padding-left:8px; margin-bottom:8px; }
  .sheet { display:grid; grid-template-columns:repeat(3,1fr); gap:8px; }
  .sheet-cell { page-break-inside:avoid; }
  .sheet-lbl { font-size:10.5px; font-weight:700; margin-bottom:3px; }
  .sheet-cell img { width:100%; height:205px; object-fit:cover; display:block; border:1px solid #999; background:#eee; }
</style>
</head>
<body>
  <div class="title">メンテナンスレポート</div>

  <div class="head">
    <div class="col-info">
      <div class="kv"><div class="k">作業店舗</div><div class="v">${esc(report.storeName)}</div></div>
      <div class="kv"><div class="k">契約プラン</div><div class="v orange">${esc(report.contractPlan)}</div></div>
      <div class="kv"><div class="k">施工担当者</div><div class="v">${esc(report.technician)}</div></div>
      <div class="kv"><div class="k">御請求先</div><div class="v">${esc(report.billingTo)}</div></div>
    </div>
    <div class="col-bill">
      <div class="kv"><div class="k">作業日</div><div class="v">${esc(formatWorkDate(report.workDate))}</div></div>
      <div class="kv"><div class="k">請求額<br/>(税込)</div><div class="v amt">¥${yen(b.taxIncluded)}</div></div>
      <div class="kv"><div class="k">税抜き</div><div class="v">¥${yen(b.taxExcluded)}</div></div>
      <div class="kv"><div class="k">メンテ</div><div class="v">¥${yen(b.maintenance)}</div></div>
      ${extra ? `<div class="kv"><div class="k">追加作業</div><div class="v">¥${yen(extra)}</div></div>` : ''}
      <div class="kv"><div class="k">備品資材<br/>廃棄</div><div class="v">¥${yen(b.supplies)}</div></div>
    </div>
    ${headerPhoto ? `<div class="col-photo"><img src="${headerPhoto.uri}" /></div>` : ''}
  </div>

  <table class="grid mt">
    <tr>
      <th style="width:24%">項目</th>
      <th style="width:9%">作業<br/>チェック</th>
      <th style="width:20%">状況</th>
      <th>備考</th>
      <th style="width:13%">次回作業<br/>予定日</th>
    </tr>
    ${checklistRows}
  </table>

  <div class="pest">
    <div class="ph">害虫駆除</div>
    <div class="pi">基本駆除 ${cb(pest.basic)}</div>
    <div class="pi">対抗薬剤使用 ${cb(pest.antiDrug)}</div>
    <div class="pi">強殺虫剤 ${cb(pest.strongPesticide)}</div>
  </div>

  <div class="band cream mt">トッピング（追加作業）</div>
  <table class="grid">
    <tr><th style="width:34%">品目</th><th style="width:8%"></th><th>コメント</th><th style="width:16%">追加費用</th></tr>
    ${toppingRows}
  </table>

  <div class="band cream">プチDIY</div>
  <table class="grid">
    <tr><th style="width:34%">品目</th><th style="width:8%"></th><th>コメント</th><th style="width:16%">追加費用</th></tr>
    ${diyRows}
  </table>

  <table class="grid mt">
    <tr><th>使用備品資材</th><th style="width:16%">単価</th><th style="width:12%">数量</th><th style="width:18%">金額</th></tr>
    ${supplyRows}
    <tr><td class="gray rt" colspan="3">合計</td><td class="gray rt">¥${yen(b.supplies)}</td></tr>
  </table>

  <div class="band cream small mt">コメント・提案</div>
  <div class="cmt">${esc(report.comment)}</div>

  <div class="band green mt">年間スケジュール</div>
  <div class="annual-body">${esc(annual.comment)}</div>

  ${photoSheet(allPhotos)}
</body>
</html>`;
}

/** 共有時のファイル名（例: メンテナンスレポート_まる助東松山駅前店_5-15） */
export function reportFileName(report: ReportLike): string {
  const date = formatWorkDate(report.workDate).replace(/\//g, '-');
  const store = report.storeName || '店舗未設定';
  return `メンテナンスレポート_${store}${date ? '_' + date : ''}`;
}
