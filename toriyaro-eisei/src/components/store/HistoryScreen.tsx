import { useEffect, useMemo, useState, type FC } from 'react';
import { AppHeader } from '../layout/AppHeader';
import { Lightbox } from '../ui/Lightbox';
import { fetchSubmissionsForKey } from '../../hooks/useSubmissions';
import {
  getDateKey,
  getWeekKey,
  formatDateKeyJa,
  isFutureDate,
  isFutureWeek,
  weekKeyToDate,
} from '../../lib/dateUtils';
import { itemsForType, targetForType } from '../../data/checkItems';
import { MISS_TRACK_START } from '../../lib/missTrack';
import type { ReportType, StoreKey, Submission } from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  /** 店舗の登録日時（ISO文字列）。無い店舗は登録日による除外をしない */
  createdAt?: string;
  onBack: () => void;
}

/**
 * 「未提出」表示の比較に使う日付キー。
 * デイリーはそのまま、ウィークリーはその週の日曜日（月曜+6日）。
 * base を渡すので 9時切替の補正は掛からない。
 */
const compareDateKey = (tab: ReportType, k: string): string => {
  if (tab !== 'weekly') return k;
  const sun = weekKeyToDate(k);
  sun.setDate(sun.getDate() + 6);
  return getDateKey(0, sun);
};

const sparsePhotos = (raw: unknown): Map<number, string> => {
  const map = new Map<number, string>();
  if (!raw) return map;
  if (Array.isArray(raw)) {
    raw.forEach((v, i) => {
      if (typeof v === 'string' && v.length > 0) map.set(i, v);
    });
    return map;
  }
  if (typeof raw === 'object') {
    Object.entries(raw as Record<string, unknown>).forEach(([k, v]) => {
      const idx = Number(k);
      if (Number.isInteger(idx) && idx >= 0 && typeof v === 'string' && v.length > 0) {
        map.set(idx, v);
      }
    });
  }
  return map;
};

const weekLabel = (weekKey: string): string => {
  const mon = weekKeyToDate(weekKey);
  const sun = new Date(mon);
  sun.setDate(sun.getDate() + 6);
  return `${mon.getMonth() + 1}/${mon.getDate()} 〜 ${sun.getMonth() + 1}/${sun.getDate()} の週`;
};

export const HistoryScreen: FC<Props> = ({ storeKey, storeName, createdAt, onBack }) => {
  const [tab, setTab] = useState<ReportType>('daily');
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-11
  const [data, setData] = useState<Record<string, Submission | null>>({});
  const [loading, setLoading] = useState(true);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  // その月に該当するキー一覧（新しい順）
  const keys = useMemo(() => {
    const lastDay = new Date(year, month + 1, 0).getDate();
    if (tab === 'daily') {
      const out: string[] = [];
      for (let d = lastDay; d >= 1; d -= 1) {
        const key = getDateKey(0, new Date(year, month, d));
        if (!isFutureDate(key)) out.push(key);
      }
      return out;
    }
    const seen = new Set<string>();
    const out: string[] = [];
    for (let d = lastDay; d >= 1; d -= 1) {
      const wk = getWeekKey(0, new Date(year, month, d));
      if (seen.has(wk)) continue;
      seen.add(wk);
      if (!isFutureWeek(wk)) out.push(wk);
    }
    return out;
  }, [tab, year, month]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    Promise.all(
      keys.map((k) =>
        fetchSubmissionsForKey([storeKey], tab, k).then(
          (res) => [k, res[storeKey] ?? null] as const,
        ),
      ),
    )
      .then((entries) => {
        if (!cancelled) {
          setData(Object.fromEntries(entries));
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storeKey, tab, year, month, keys.join(',')]);

  const shiftMonth = (delta: number) => {
    const d = new Date(year, month + delta, 1);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
  };

  const canForward =
    year < now.getFullYear() ||
    (year === now.getFullYear() && month < now.getMonth());

  // 記録が無く、かつ店舗の登録日より前の日（週）は一覧から除外する。
  // createdAt は UTC 日付で持っており、JST の 9時切替と一致する。
  // 「記録が有るか」は取得後の data でしか分からないので、keys ではなく描画側で絞る。
  const createdDate = createdAt ? createdAt.slice(0, 10) : null;
  const visibleKeys = keys.filter((k) => {
    if (data[k]) return true;
    if (createdDate && compareDateKey(tab, k) < createdDate) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-bg pb-10">
      <AppHeader
        title="過去の提出"
        subtitle={storeName}
        left={
          <button
            type="button"
            onClick={onBack}
            className="text-lg text-text-muted hover:text-accent"
            aria-label="戻る"
          >
            ←
          </button>
        }
      />
      <main className="mx-auto w-full max-w-app px-4 py-4">
        <div className="mb-3 rounded-xl bg-surface2 px-3 py-2 text-[11px] text-text-muted">
          この画面は確認専用です（編集はできません）。抜けている項目は赤字で表示されます。
        </div>
        <div className="mb-3 flex rounded-2xl border border-border bg-surface p-1 shadow-sm">
          {(['daily', 'weekly'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              className={`flex-1 rounded-xl py-2 text-xs font-bold transition ${
                tab === t ? 'bg-accent text-white shadow-sm' : 'text-text-muted'
              }`}
            >
              {t === 'daily' ? 'デイリー' : 'ウィークリー'}
            </button>
          ))}
        </div>

        <div className="mb-4 flex items-center justify-between rounded-2xl border border-border bg-surface px-3 py-2 shadow-sm">
          <button
            type="button"
            onClick={() => shiftMonth(-1)}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface2 text-base hover:bg-border"
            aria-label="前の月"
          >
            ←
          </button>
          <div className="text-sm font-bold">
            {year}年{month + 1}月
          </div>
          <button
            type="button"
            onClick={() => shiftMonth(1)}
            disabled={!canForward}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface2 text-base hover:bg-border disabled:opacity-30"
            aria-label="次の月"
          >
            →
          </button>
        </div>

        {loading ? (
          <p className="py-8 text-center text-sm text-text-muted">読み込み中…</p>
        ) : visibleKeys.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            この月の対象データはありません
          </p>
        ) : (
          <div className="space-y-3">
            {visibleKeys.map((k) => {
              const sub = data[k];
              // 記録が無く集計開始前の日（週）は「未提出」ではなく「記録なし」扱い
              const beforeTrack = !sub && compareDateKey(tab, k) < MISS_TRACK_START;
              const photos = sparsePhotos(sub?.photos);
              const isLine = !!sub?.viaLine;
              const target = targetForType(tab, storeKey, k);
              const items = itemsForType(tab, storeKey, k);
              const lastItem = items[items.length - 1];
              const hasMulti = !!lastItem?.multi;
              const fixedItems = hasMulti ? items.slice(0, -1) : items;
              const missing = isLine
                ? []
                : fixedItems
                    .map((it, i) => ({ it, i }))
                    .filter(({ i }) => !photos.has(i));
              const done = isLine || photos.size >= target;
              const label = tab === 'daily' ? formatDateKeyJa(k) : weekLabel(k);
              const urls = Array.from(photos.values());
              return (
                <div
                  key={k}
                  className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-sm font-bold">{label}</h3>
                    {sub ? (
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          done ? 'bg-ok-bg text-ok' : 'bg-warn-bg text-warn'
                        }`}
                      >
                        {isLine
                          ? '提出済み（LINE）'
                          : done
                            ? '提出済み'
                            : `一部提出 ${photos.size}/${target}`}
                      </span>
                    ) : beforeTrack ? (
                      <span className="rounded-full bg-surface2 px-2 py-0.5 text-[10px] font-bold text-text-muted">
                        記録なし（集計開始前）
                      </span>
                    ) : (
                      <span className="rounded-full bg-ng-bg px-2 py-0.5 text-[10px] font-bold text-ng">
                        未提出
                      </span>
                    )}
                  </div>
                  {sub && missing.length > 0 && (
                    <p className="mt-2 text-[11px] font-bold text-ng">
                      抜けている項目：
                      {missing.map(({ it, i }) => `${i + 1}. ${it.label}`).join('・')}
                    </p>
                  )}
                  {!sub && !beforeTrack && (
                    <p className="mt-2 text-[11px] text-ng">
                      全{fixedItems.length}項目が未提出です
                    </p>
                  )}
                  {urls.length > 0 && (
                    <div className="no-scrollbar mt-3 flex gap-1.5 overflow-x-auto">
                      {urls.map((url, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setLightboxUrl(url)}
                          className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border"
                        >
                          <img
                            src={url}
                            alt=""
                            className="h-full w-full object-cover"
                            loading="lazy"
                          />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>
      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
};