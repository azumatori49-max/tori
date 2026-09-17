/**
 * MCP ツール実装（read-only）。
 * stdio 版 (server.js) と HTTP 版 (server-http.js) の両方から使う。
 * Firebase Admin の Database インスタンスは引数で受け取り、
 * 認証・初期化はそれぞれのエントリで行う。
 */

import {
  MARUSUKE_STORE_KEYS,
  buildTargetDates,
  countPhotos,
  formatDateKeyShort,
  formatMonthKeyJa,
  targetForType,
} from './domain.js';

const readNode = async (db, path) => {
  const snap = await db.ref(path).once('value');
  return snap.val();
};

const sortedStoreKeys = (stores) =>
  Object.keys(stores).sort((a, b) =>
    (stores[a]?.name ?? '').localeCompare(stores[b]?.name ?? '', 'ja'),
  );

// ================================================================
// 各ツール
// ================================================================

async function listStores(db) {
  const stores = (await readNode(db, 'stores')) ?? {};
  const keys = sortedStoreKeys(stores);
  return {
    count: keys.length,
    stores: keys.map((k) => ({
      storeKey: k,
      name: stores[k]?.name ?? '',
      createdAt: stores[k]?.createdAt ?? null,
      isMarusuke: MARUSUKE_STORE_KEYS.has(k),
    })),
  };
}

async function getSubmissions(db, { type, dateOrWeekKey }) {
  if (!type || !dateOrWeekKey) {
    throw new Error('type と dateOrWeekKey は必須です');
  }
  const stores = (await readNode(db, 'stores')) ?? {};
  const keys = sortedStoreKeys(stores);
  const results = await Promise.all(
    keys.map(async (k) => {
      const sub = await readNode(db, `submissions/${k}/${type}/${dateOrWeekKey}`);
      const target = targetForType(type, k, dateOrWeekKey);
      const count = countPhotos(sub?.photos);
      const viaLine = !!sub?.viaLine;
      let status;
      if (viaLine) status = 'via_line';
      else if (count >= target) status = 'submitted';
      else if (count > 0) status = 'partial';
      else status = 'missing';
      return {
        storeKey: k,
        storeName: stores[k]?.name ?? '',
        target,
        count,
        viaLine,
        status,
        submittedAt: sub?.submittedAt ?? null,
      };
    }),
  );
  const summary = { submitted: 0, via_line: 0, partial: 0, missing: 0 };
  for (const r of results) summary[r.status] += 1;
  return { type, dateOrWeekKey, summary, stores: results };
}

async function collectMonthlyMisses(db, monthKey) {
  const targetDates = buildTargetDates(monthKey);
  const stores = (await readNode(db, 'stores')) ?? {};
  const keys = sortedStoreKeys(stores);

  const misses = Object.fromEntries(keys.map((k) => [k, []]));
  if (targetDates.length === 0) return { stores, keys, misses, targetDates };

  await Promise.all(
    targetDates.map(async (dayKey) => {
      await Promise.all(
        keys.map(async (k) => {
          const created = stores[k]?.createdAt?.slice(0, 10);
          if (created && dayKey < created) return;
          const sub = await readNode(db, `submissions/${k}/daily/${dayKey}`);
          const target = targetForType('daily', k);
          const c = countPhotos(sub?.photos);
          const submitted = !!sub?.viaLine || c >= target;
          if (!submitted) {
            misses[k].push({ date: dayKey, count: c, target });
          }
        }),
      );
    }),
  );

  for (const k of keys) {
    misses[k].sort((a, b) => a.date.localeCompare(b.date));
  }
  return { stores, keys, misses, targetDates };
}

async function getMonthlyMisses(db, { monthKey }) {
  if (!monthKey) throw new Error('monthKey は必須です（例: "M2026-09"）');
  const { stores, keys, misses, targetDates } = await collectMonthlyMisses(
    db,
    monthKey,
  );
  return {
    monthKey,
    range:
      targetDates.length === 0
        ? null
        : { from: targetDates[0], to: targetDates[targetDates.length - 1] },
    stores: keys.map((k) => ({
      storeKey: k,
      storeName: stores[k]?.name ?? '',
      missCount: misses[k].length,
      missDates: misses[k],
    })),
  };
}

async function getMonthlyReport(db, { monthKey }) {
  if (!monthKey) throw new Error('monthKey は必須です（例: "M2026-09"）');
  const { stores, keys, misses, targetDates } = await collectMonthlyMisses(
    db,
    monthKey,
  );

  const header = `【衛生管理 月次レポート ${formatMonthKeyJa(monthKey)}】`;
  const range =
    targetDates.length === 0
      ? '対象日なし'
      : `${formatDateKeyShort(targetDates[0])}〜${formatDateKeyShort(targetDates[targetDates.length - 1])}`;
  const period = `集計期間:${range}（当日分は含まず）`;

  const noMissKeys = [];
  const withMissKeys = [];
  for (const k of keys) {
    if ((misses[k]?.length ?? 0) === 0) noMissKeys.push(k);
    else withMissKeys.push(k);
  }
  withMissKeys.sort(
    (a, b) => (misses[b]?.length ?? 0) - (misses[a]?.length ?? 0),
  );

  const noMissBlock =
    noMissKeys.length === 0
      ? `■ 未提出なし:0店舗`
      : `■ 未提出なし:${noMissKeys.length}店舗\n${noMissKeys
          .map((k) => stores[k]?.name ?? '')
          .join('、')}`;

  const withMissBlock =
    withMissKeys.length === 0
      ? `■ 未提出あり:0店舗`
      : `■ 未提出あり:${withMissKeys.length}店舗\n${withMissKeys
          .map((k) => {
            const list = misses[k] ?? [];
            const detail = list
              .map((m) =>
                m.count > 0
                  ? `${formatDateKeyShort(m.date)}(${m.count}/${m.target}枚)`
                  : formatDateKeyShort(m.date),
              )
              .join('、');
            return `・${stores[k]?.name ?? ''}:${list.length}回（${detail}）`;
          })
          .join('\n')}`;

  const text = [header, period, '', noMissBlock, '', withMissBlock].join('\n');
  return { monthKey, text };
}

async function getFeedback(db, { unresolvedOnly = false } = {}) {
  const raw = (await readNode(db, 'feedback')) ?? {};
  let arr = Object.entries(raw).map(([id, v]) => ({ id, ...(v ?? {}) }));
  if (unresolvedOnly) {
    arr = arr.filter((x) => !x.replied && !x.resolvedAt);
  }
  arr.sort((a, b) =>
    (b.submittedAt ?? b.at ?? '').localeCompare(a.submittedAt ?? a.at ?? ''),
  );
  return { count: arr.length, items: arr };
}

async function getErrorLogs(db, { limit = 50 } = {}) {
  const raw = (await readNode(db, 'errorLogs')) ?? {};
  const arr = Object.entries(raw).map(([id, v]) => ({ id, ...(v ?? {}) }));
  arr.sort((a, b) => (b.at ?? '').localeCompare(a.at ?? ''));
  const items = arr.slice(0, Math.max(1, Math.min(500, limit)));
  return { count: items.length, total: arr.length, items };
}

async function getReferralRequests(db, { status } = {}) {
  const raw = (await readNode(db, 'referralRequests')) ?? {};
  let arr = Object.values(raw);
  if (status) arr = arr.filter((x) => x?.status === status);
  arr.sort((a, b) => (b?.appliedAt ?? '').localeCompare(a?.appliedAt ?? ''));
  const items = arr.map((r) => ({
    id: r.id,
    kind: r.kind,
    storeKey: r.storeKey,
    storeName: r.storeName,
    managerName: r.managerName,
    referrerName: r.referrerName,
    referredName: r.referredName,
    hireDate: r.hireDate,
    thresholdDate: r.thresholdDate,
    status: r.status,
    appliedAt: r.appliedAt,
    decidedAt: r.decidedAt ?? null,
    decidedBy: r.decidedBy ?? null,
    paidAt: r.paidAt ?? null,
    rejectReason: r.rejectReason ?? null,
    signatureUrls: {
      manager: r.signatures?.manager?.imageUrl ?? null,
      referrer: r.signatures?.referrer?.imageUrl ?? null,
      referred: r.signatures?.referred?.imageUrl ?? null,
    },
  }));
  return { count: items.length, items };
}

// ================================================================
// エクスポート
// ================================================================

export const TOOL_DEFINITIONS = [
  {
    name: 'list_stores',
    description:
      '店舗の一覧を返す（storeKey / 店舗名 / 作成日 / まる助グループ判定）。',
    inputSchema: { type: 'object', properties: {}, additionalProperties: false },
  },
  {
    name: 'get_submissions',
    description:
      '指定した種別(daily/weekly/monthly)と日付/週/月キーに対する、全店舗の提出状況を返す。' +
      ' 判定は src/hooks/useSubmissions と DashboardTab のロジックに一致（viaLine/枚数閾値/店舗別項目数）。',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['daily', 'weekly', 'monthly'] },
        dateOrWeekKey: {
          type: 'string',
          description:
            "daily: 'YYYY-MM-DD' / weekly: 'W2026-08-31'（月曜起点）/ monthly: 'M2026-09'",
        },
      },
      required: ['type', 'dateOrWeekKey'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_monthly_misses',
    description:
      '指定した月について、店舗ごとの未提出回数と日付一覧を返す。集計対象は 1日〜昨日（当月）または月末（過去月）、' +
      ' MISS_TRACK_START(2026-07-11) 以降、店舗の createdAt より前の日は除外、一部提出も未提出扱い。',
    inputSchema: {
      type: 'object',
      properties: {
        monthKey: { type: 'string', description: "'M2026-09' 形式" },
      },
      required: ['monthKey'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_monthly_report',
    description:
      '管理者画面「月次レポート」のコピペ可能なテキスト（本体 MonthlyReportCard と同じ書式）を返す。',
    inputSchema: {
      type: 'object',
      properties: {
        monthKey: { type: 'string', description: "'M2026-09' 形式" },
      },
      required: ['monthKey'],
      additionalProperties: false,
    },
  },
  {
    name: 'get_feedback',
    description:
      'ご意見一覧を新しい順で返す。unresolvedOnly=true で未返信のみに絞れる。',
    inputSchema: {
      type: 'object',
      properties: {
        unresolvedOnly: { type: 'boolean', default: false },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_error_logs',
    description:
      '写真アップロードのエラーログを新しい順で返す（デフォルト最大50件）。',
    inputSchema: {
      type: 'object',
      properties: {
        limit: { type: 'number', default: 50, minimum: 1, maximum: 500 },
      },
      additionalProperties: false,
    },
  },
  {
    name: 'get_referral_requests',
    description:
      '紹介手当申請の一覧を新しい順で返す。status で pending/approved/rejected/paid に絞れる。',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['pending', 'approved', 'rejected', 'paid'],
        },
      },
      additionalProperties: false,
    },
  },
];

/** name に応じて対応するツールを実行 */
export async function runTool(db, name, args = {}) {
  switch (name) {
    case 'list_stores':
      return listStores(db);
    case 'get_submissions':
      return getSubmissions(db, args);
    case 'get_monthly_misses':
      return getMonthlyMisses(db, args);
    case 'get_monthly_report':
      return getMonthlyReport(db, args);
    case 'get_feedback':
      return getFeedback(db, args);
    case 'get_error_logs':
      return getErrorLogs(db, args);
    case 'get_referral_requests':
      return getReferralRequests(db, args);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}
