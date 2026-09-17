import { useEffect, useMemo, useState, type FC } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { ReportCard } from './ReportCard';
import {
  dateKeyToDate,
  formatDateJa,
  formatDateKeyShort,
  formatMonthKeyJa,
  getDateKey,
  getMonthKey,
  getWeekKey,
} from '../../lib/dateUtils';
import {
  fetchSubmissionsForKey,
  useStoreSubmissionStatus,
} from '../../hooks/useSubmissions';
import { useStoreReferrals } from '../../hooks/useReferrals';
import { targetForType } from '../../data/checkItems';
import type {
  ReferralRequest,
  ReferralStatus,
  ReportType,
  Store,
  StoreKey,
} from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  stores: Record<StoreKey, Store>;
  onLogout: () => void;
  onOpenReport: (type: ReportType) => void;
  onOpenHistory: () => void;
  onOpenReferral: (initial?: ReferralRequest | null) => void;
}

/** 未提出カウントの集計開始日（この日より前は数えない） */
const MISS_TRACK_START = '2026-07-11';
/** マンスリー開始月（この月より前はアラートしない） */
const MONTHLY_START = 'M2026-08';

const pad = (n: number) => String(n).padStart(2, '0');

interface MissDay {
  d: string;
  c: number;
  t: number;
}

const countPhotos = (raw: unknown): number => {
  if (!raw) return 0;
  if (Array.isArray(raw)) {
    return raw.filter((x) => typeof x === 'string' && x.length > 0).length;
  }
  if (typeof raw === 'object') {
    return Object.values(raw as Record<string, unknown>).filter(
      (x) => typeof x === 'string' && x.length > 0,
    ).length;
  }
  return 0;
};

export const StoreTopScreen: FC<Props> = ({
  storeKey,
  storeName,
  stores,
  onLogout,
  onOpenReport,
  onOpenHistory,
  onOpenReferral,
}) => {
  const referrals = useStoreReferrals(storeKey);
  const todayKey = getDateKey();
  const weekKey = getWeekKey();
  const monthKey = getMonthKey();
  const { submission: daily } = useStoreSubmissionStatus(storeKey, 'daily', todayKey);
  const { submission: weekly } = useStoreSubmissionStatus(storeKey, 'weekly', weekKey);
  const { submission: monthly } = useStoreSubmissionStatus(storeKey, 'monthly', monthKey);

  const dailyTarget = targetForType('daily', storeKey);
  const weeklyTarget = targetForType('weekly', storeKey);

  const [allMiss, setAllMiss] = useState<Record<StoreKey, MissDay[]> | null>(null);
  const [missOpen, setMissOpen] = useState(true);
  const [prevMonthlyMissing, setPrevMonthlyMissing] = useState(false);

  const [ty, tm, td] = todayKey.split('-').map(Number);

  const sortedKeys = useMemo(
    () =>
      Object.keys(stores).sort((a, b) =>
        stores[a].name.localeCompare(stores[b].name, 'ja'),
      ),
    [stores],
  );

  // 前月のマンスリー未提出チェック
  useEffect(() => {
    let cancelled = false;
    const prevKey = getMonthKey(-1);
    if (prevKey < MONTHLY_START) return;
    fetchSubmissionsForKey([storeKey], 'monthly', prevKey).then((r) => {
      if (!cancelled) setPrevMonthlyMissing(!r[storeKey]);
    });
    return () => {
      cancelled = true;
    };
  }, [storeKey]);

  // 今月の未提出日を全店分集計（集計開始日〜昨日・業務日ベース・規定枚数未満は未提出扱い）
  useEffect(() => {
    if (sortedKeys.length === 0) return;
    let cancelled = false;
    const monthStart = `${ty}-${pad(tm)}-01`;
    const from = monthStart > MISS_TRACK_START ? monthStart : MISS_TRACK_START;

    const keys: string[] = [];
    for (let day = 1; day < td; day += 1) {
      const k = `${ty}-${pad(tm)}-${pad(day)}`;
      if (k >= from) keys.push(k);
    }

    if (keys.length === 0) {
      setAllMiss({});
      return;
    }

    setAllMiss(null);
    Promise.all(keys.map((k) => fetchSubmissionsForKey(sortedKeys, 'daily', k)))
      .then((results) => {
        if (cancelled) return;
        const misses: Record<string, MissDay[]> = {};
        sortedKeys.forEach((k) => {
          misses[k] = [];
        });
        results.forEach((dayMap, idx) => {
          const dayKey = keys[idx];
          sortedKeys.forEach((k) => {
            const created = stores[k]?.createdAt?.slice(0, 10);
            if (created && dayKey < created) return;
            const sub = dayMap[k];
            const target = targetForType('daily', k);
            const c = countPhotos(sub?.photos);
            const submitted = !!sub?.viaLine || c >= target;
            if (!submitted) misses[k].push({ d: dayKey, c, t: target });
          });
        });
        setAllMiss(misses);
      })
      .catch(() => {
        if (!cancelled) setAllMiss(null);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortedKeys.join(','), ty, tm, td]);

  const missDates = allMiss === null ? null : allMiss[storeKey] ?? [];

  const missList = useMemo(() => {
    if (!allMiss) return [];
    return sortedKeys
      .filter((k) => (allMiss[k]?.length ?? 0) > 0)
      .sort((a, b) => (allMiss[b]?.length ?? 0) - (allMiss[a]?.length ?? 0));
  }, [allMiss, sortedKeys]);

  return (
    <div className="min-h-screen bg-bg">
      <AppHeader
        title={storeName}
        subtitle="らくらく衛生管理"
        showLogo
        right={
          <button
            type="button"
            onClick={onLogout}
            className="text-xs font-bold text-text-muted hover:text-accent"
          >
            ログアウト
          </button>
        }
      />

      <main className="mx-auto w-full max-w-app px-4 py-5">
        <div className="mb-4 flex items-center justify-between gap-2">
          <div className="inline-flex items-center gap-2 rounded-full bg-surface px-3 py-1.5 border border-border shadow-sm">
            <span className="h-2 w-2 rounded-full bg-accent animate-pulseDot" />
            <span className="text-xs font-bold">{formatDateJa(dateKeyToDate(todayKey))}</span>
          </div>
          {missDates === null ? (
            <span className="text-[11px] text-text-muted">集計中…</span>
          ) : (
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                missDates.length > 0 ? 'bg-ng-bg text-ng' : 'bg-ok-bg text-ok'
              }`}
            >
              {tm}月の未提出：{missDates.length}回
            </span>
          )}
        </div>

        {prevMonthlyMissing && (
          <div className="mb-4 rounded-xl bg-ng-bg px-3 py-2 text-[11px] font-bold text-ng">
            先月（{formatMonthKeyJa(getMonthKey(-1))}）のモップ交換が提出されていません。今月分は忘れずに提出してください。
          </div>
        )}

        {missDates !== null && missDates.length > 0 && (
          <div className="mb-4 rounded-xl bg-ng-bg px-3 py-2 text-[11px] text-ng">
            <span className="font-bold">未提出の日：</span>
            {missDates.map((m) => formatDateKeyShort(m.d) + (m.c > 0 ? `（${m.c}/${m.t}枚）` : '')).join('・')}
          </div>
        )}

        <div className="space-y-4">
          <ReportCard
            variant="daily"
            storeKey={storeKey}
            title="毎日の衛生チェック"
            description={`毎日 ${dailyTarget}枚の写真を撮影して提出してください`}
            submission={daily}
            onOpen={() => onOpenReport('daily')}
          />
          <ReportCard
            variant="weekly"
            storeKey={storeKey}
            title="週次の衛生チェック"
            description={`毎週 1回 ${weeklyTarget}枚の写真を撮影して提出してください`}
            submission={weekly}
            onOpen={() => onOpenReport('weekly')}
          />
          <ReportCard
            variant="monthly"
            storeKey={storeKey}
            title="月次の衛生チェック"
            description="毎月 1回 モップ交換の写真を提出してください（月内いつでもOK）"
            submission={monthly}
            onOpen={() => onOpenReport('monthly')}
          />
        </div>

        <button
          type="button"
          onClick={onOpenHistory}
          className="mt-5 w-full rounded-2xl border border-border bg-surface px-4 py-3.5 text-sm font-bold text-text shadow-sm transition active:scale-[0.99]"
        >
          過去の提出をみる
        </button>

        <button
          type="button"
          onClick={() => onOpenReferral(null)}
          className="mt-3 w-full rounded-2xl border-2 border-accent/60 bg-surface px-4 py-3.5 text-sm font-bold text-accent shadow-sm transition active:scale-[0.99]"
        >
          紹介手当を申請する
        </button>

        <ReferralHistory
          items={referrals}
          onReapply={(r) => onOpenReferral(r)}
        />

        <div className="mt-5 rounded-2xl border border-border bg-surface p-4 shadow-sm">
          <button
            type="button"
            onClick={() => setMissOpen((v) => !v)}
            className="flex w-full items-center justify-between"
          >
            <h2 className="text-xs font-bold">
              {tm}月の未提出回数（全店舗）
              <span className="ml-1 font-normal text-text-muted">
                （当日分は含みません）
              </span>
            </h2>
            <span className="text-text-muted">{missOpen ? '▲' : '▼'}</span>
          </button>
          {missOpen && (
            <div className="mt-3">
              {allMiss === null ? (
                <p className="text-xs text-text-muted">集計中…</p>
              ) : missList.length === 0 ? (
                <p className="text-xs font-bold text-ok">今月の未提出はありません</p>
              ) : (
                <div className="max-h-72 space-y-1.5 overflow-y-auto">
                  {missList.map((k) => {
                    const dates = allMiss?.[k] ?? [];
                    const isMe = k === storeKey;
                    return (
                      <div
                        key={k}
                        className={`rounded-lg px-3 py-2 ${
                          isMe ? 'bg-ng-bg' : 'bg-surface2'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="truncate text-xs font-bold">
                            {stores[k].name}
                            {isMe && <span className="ml-1 text-[10px] text-ng">（自店）</span>}
                          </span>
                          <span className="ml-2 shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-ng">
                            未提出：{dates.length}
                          </span>
                        </div>
                        <p className="mt-1 text-[10px] text-text-muted">
                          {dates.map((m) => formatDateKeyShort(m.d) + (m.c > 0 ? `（${m.c}/${m.t}枚）` : '')).join('・')}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        <p className="mt-8 text-center text-[11px] text-text-muted">
          店舗の毎日・毎週の衛生チェック写真を投稿し、本部がまとめて確認できる業務アプリ。
        </p>
      </main>
    </div>
  );
};

// ============================================================
// 紹介手当申請の履歴（自店のみ）
// ============================================================

const REFERRAL_STATUS_STYLE: Record<
  ReferralStatus,
  { label: string; cls: string }
> = {
  pending: { label: '申請中', cls: 'bg-warn-bg text-warn' },
  approved: { label: '承認済み', cls: 'bg-ok-bg text-ok' },
  paid: { label: '支払済み', cls: 'bg-blue-50 text-blue-600' },
  rejected: { label: '差戻し', cls: 'bg-ng-bg text-ng' },
};

const ReferralHistory: FC<{
  items: ReferralRequest[] | null;
  onReapply: (item: ReferralRequest) => void;
}> = ({ items, onReapply }) => {
  if (items === null || items.length === 0) return null;
  return (
    <section className="mt-5 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <h2 className="text-xs font-bold">紹介手当の申請履歴</h2>
      <ul className="mt-3 space-y-2">
        {items.map((r) => {
          const style = REFERRAL_STATUS_STYLE[r.status];
          const applied = r.appliedAt?.slice(0, 10) ?? '';
          return (
            <li
              key={r.id}
              className="rounded-xl border border-border bg-surface2 px-3 py-2.5 text-xs"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="truncate font-bold">
                    {r.referredName}
                  </div>
                  <div className="mt-0.5 text-[10px] text-text-muted">
                    {r.kind === 'employee' ? '社員（3ヶ月）' : 'スタッフ（50時間）'}
                    ・{applied} 申請
                  </div>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${style.cls}`}
                >
                  {style.label}
                </span>
              </div>
              {r.status === 'rejected' && (
                <div className="mt-2 space-y-1.5">
                  {r.rejectReason && (
                    <p className="rounded-lg bg-ng-bg px-2 py-1.5 text-[11px] font-bold text-ng">
                      差戻し理由：{r.rejectReason}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => onReapply(r)}
                    className="w-full rounded-lg border border-accent/50 bg-surface py-2 text-[11px] font-bold text-accent"
                  >
                    この内容を引き継いで再申請する
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
};