import { useEffect, useMemo, useState, type FC } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { storeSurveyUrl } from '../../lib/storeSurvey';
import { ReportCard } from './ReportCard';
import { isMorningLocked } from '../../lib/morningLock';
import { ScheduleSection } from './ScheduleCard';
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
  fetchSubmissionRange,
  fetchSubmissionsForKey,
  useStoreSubmissionStatus,
} from '../../hooks/useSubmissions';
import { collectMissDays, currentMonthTrackKeys, type MissDay } from '../../lib/missTrack';
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
  onOpenSurvey: () => void;
  surveyNotice?: string;
  onOpenReferral: (initial?: ReferralRequest | null) => void;
  onOpenSchedule: (scheduleId: string) => void;
}

/** マンスリー開始月（この月より前はアラートしない） */
const MONTHLY_START = 'M2026-08';

/**
 * 全店舗の未提出回数（店舗トップ下部の一覧用）。
 * 一覧を開いたときに初めて読み込み、アプリを開いている間は同じ日の結果を使い回す。
 */
let allMissCache: { todayKey: string; storeKeys: string; data: Record<StoreKey, MissDay[]> } | null = null;

export const StoreTopScreen: FC<Props> = ({
  storeKey,
  storeName,
  stores,
  onLogout,
  onOpenReport,
  onOpenHistory,
  onOpenSurvey,
  surveyNotice,
  onOpenReferral,
  onOpenSchedule,
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

  const tm = Number(todayKey.split('-')[1]);
  const [prevMonthlyMissing, setPrevMonthlyMissing] = useState(false);

  // 自店の今月の未提出日（自店のデータだけを1回で読む）。null=集計中, 'error'=読めなかった
  const [missDates, setMissDates] = useState<MissDay[] | 'error' | null>(null);
  // 全店舗の未提出回数（一覧を開いたときだけ読む）
  const [missOpen, setMissOpen] = useState(false);
  const [allMiss, setAllMiss] = useState<Record<StoreKey, MissDay[]> | 'error' | null>(null);

  const sortedKeys = useMemo(
    () =>
      Object.keys(stores).sort((a, b) =>
        stores[a].name.localeCompare(stores[b].name, 'ja'),
      ),
    [stores],
  );
  const storeKeysSig = sortedKeys.join(',');
  const myCreatedAt = stores[storeKey]?.createdAt;

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

  // 自店の今月の未提出日（集計開始日〜昨日・業務日ベース・規定枚数未満は未提出扱い）
  useEffect(() => {
    let cancelled = false;
    const keys = currentMonthTrackKeys(todayKey);
    if (keys.length === 0) {
      setMissDates([]);
      return;
    }
    setMissDates(null);
    fetchSubmissionRange(storeKey, 'daily', keys[0], keys[keys.length - 1])
      .then((daily) => {
        if (cancelled) return;
        setMissDates(collectMissDays(keys, daily, myCreatedAt, targetForType('daily', storeKey)));
      })
      .catch(() => {
        if (!cancelled) setMissDates('error');
      });
    return () => {
      cancelled = true;
    };
  }, [storeKey, todayKey, myCreatedAt]);

  // 全店舗の未提出回数: 一覧を開いたときに初めて読み込む（店舗ごとに1回ずつ）
  useEffect(() => {
    if (!missOpen || sortedKeys.length === 0) return;
    if (allMissCache && allMissCache.todayKey === todayKey && allMissCache.storeKeys === storeKeysSig) {
      setAllMiss(allMissCache.data);
      return;
    }
    let cancelled = false;
    const keys = currentMonthTrackKeys(todayKey);
    if (keys.length === 0) {
      setAllMiss({});
      return;
    }
    setAllMiss(null);
    Promise.all(
      sortedKeys.map(async (k) => {
        const daily = await fetchSubmissionRange(k, 'daily', keys[0], keys[keys.length - 1]);
        return [k, collectMissDays(keys, daily, stores[k]?.createdAt, targetForType('daily', k))] as const;
      }),
    )
      .then((entries) => {
        const data = Object.fromEntries(entries) as Record<StoreKey, MissDay[]>;
        allMissCache = { todayKey, storeKeys: storeKeysSig, data };
        if (!cancelled) setAllMiss(data);
      })
      .catch(() => {
        if (!cancelled) setAllMiss('error');
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [missOpen, storeKeysSig, todayKey]);

  const allMissData = allMiss !== null && allMiss !== 'error' ? allMiss : null;
  const missList = useMemo(() => {
    if (!allMissData) return [];
    return sortedKeys
      .filter((k) => (allMissData[k]?.length ?? 0) > 0)
      .sort((a, b) => (allMissData[b]?.length ?? 0) - (allMissData[a]?.length ?? 0));
  }, [allMissData, sortedKeys]);
  const myMiss = Array.isArray(missDates) ? missDates : null;

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
            className="inline-flex min-h-[44px] items-center whitespace-nowrap px-1 text-xs font-bold text-text-muted hover:text-accent"
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
          ) : myMiss ? (
            <span
              className={`rounded-full px-3 py-1.5 text-xs font-bold ${
                myMiss.length > 0 ? 'bg-ng-bg text-ng' : 'bg-ok-bg text-ok'
              }`}
            >
              {tm}月の未提出：{myMiss.length}回
            </span>
          ) : null}
        </div>

        {prevMonthlyMissing && (
          <div className="mb-4 rounded-xl bg-ng-bg px-3 py-2 text-[11px] font-bold text-ng">
            先月（{formatMonthKeyJa(getMonthKey(-1))}）のモップ交換が提出されていません。今月分は忘れずに提出してください。
          </div>
        )}

        {myMiss && myMiss.length > 0 && (
          <div className="mb-4 rounded-xl bg-ng-bg px-3 py-2 text-[11px] text-ng">
            <span className="font-bold">未提出の日：</span>
            {myMiss.map((m) => formatDateKeyShort(m.d) + (m.c > 0 ? `（${m.c}/${m.t}枚）` : '')).join('・')}
          </div>
        )}

        {/* 毎日の提出を一番上に置く（最初の画面で必ず見えるように） */}
        <ReportCard
          variant="daily"
          storeKey={storeKey}
          title="毎日の衛生チェック"
          description={`毎日 ${dailyTarget}枚の写真を撮影して提出してください`}
          submission={daily}
          viewOnly={isMorningLocked(storeKey)}
          onOpen={() => onOpenReport('daily')}
        />

        {/* 年間スケジュール（期間つきの撮影依頼）。未提出カウントや月次集計には含めない */}
        <ScheduleSection storeKey={storeKey} onOpen={onOpenSchedule} />

        <div className="mt-4 space-y-4">
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

        {storeSurveyUrl(storeKey) ? (
          <button
            type="button"
            onClick={onOpenSurvey}
            className="mt-3 block w-full rounded-2xl border-2 border-accent/60 bg-surface px-4 py-3.5 text-center text-sm font-bold text-accent shadow-sm transition active:scale-[0.99]"
          >
            アンケート
            <span className="mt-1 block text-[11px] font-normal text-text-muted">お客様の回答を見る</span>
          </button>
        ) : (
          <div className="mt-3 rounded-2xl border border-border bg-surface px-4 py-3.5 text-center text-text-muted">
            <p className="text-sm font-bold">アンケート</p>
            <p className="mt-1 text-[11px]">この店舗のアンケートは準備中です</p>
          </div>
        )}

        {surveyNotice && <p role="status" className="mt-2 rounded-xl bg-warn-bg p-3 text-xs text-warn">{surveyNotice}</p>}

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
            onClick={() => {
              if (missOpen && allMiss === 'error') setAllMiss(null);
              setMissOpen((v) => !v);
            }}
            aria-expanded={missOpen}
            className="flex min-h-[44px] w-full items-center justify-between text-left"
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
              ) : allMiss === 'error' ? (
                <p className="text-xs font-bold text-ng">
                  集計を読み込めませんでした。電波の良い場所で、いったん閉じてからもう一度開いてください。
                </p>
              ) : missList.length === 0 ? (
                <p className="text-xs font-bold text-ok">今月の未提出はありません</p>
              ) : (
                <div className="max-h-72 space-y-1.5 overflow-y-auto">
                  {missList.map((k) => {
                    const dates = allMissData?.[k] ?? [];
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
