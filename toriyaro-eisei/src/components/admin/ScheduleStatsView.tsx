import { useMemo, useState, type FC } from 'react';
import { Lightbox } from '../ui/Lightbox';
import { SavePhotoButton, ZipSaveButton } from './PhotoSave';
import { buildPhotoFileName, sanitizeFileName, savePhoto, type ZipEntry } from '../../lib/download';
import { getDateKey } from '../../lib/dateUtils';
import {
  csvFileName,
  missingStoresText,
  photosMap,
  slotRanges,
  statsTable,
  toCsv,
  toTsv,
  type ItemStat,
  type ScheduleStats,
} from '../../lib/schedule';
import type { ScheduleItem, Store, StoreKey, Submission } from '../../types';

/** クリップボードにコピー。拒否されたら textarea を選択して execCommand で試す */
const copyToClipboard = async (text: string): Promise<boolean> => {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand('copy');
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
};

const useCopy = () => {
  const [copied, setCopied] = useState(false);
  const [failedText, setFailedText] = useState<string | null>(null);
  const copy = async (text: string) => {
    if (await copyToClipboard(text)) {
      setFailedText(null);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } else {
      setFailedText(text);
    }
  };
  /** 失敗時の代替: 選択状態のテキストエリア */
  const fallback = failedText ? (
    <textarea
      readOnly
      value={failedText}
      autoFocus
      onFocus={(e) => e.currentTarget.select()}
      className="mt-2 h-32 w-full rounded-md border border-border bg-surface2 p-2 text-xs"
    />
  ) : null;
  return { copied, copy, fallback };
};

const btnCls =
  'rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] font-bold text-text-muted disabled:opacity-50';

// ============================================================
// 上部のサマリー: 全項目を達成／一部／未提出 ＋ 集計をコピー・CSVで保存
// ============================================================

export const ScheduleStatsSummary: FC<{
  title: string;
  stats: ScheduleStats;
  storeName: (key: StoreKey) => string;
  todayKey: string;
  loading: boolean;
}> = ({ title, stats, storeName, todayKey, loading }) => {
  const { copied, copy, fallback } = useCopy();
  if (loading) return <p className="text-xs text-text-muted">集計中…</p>;
  if (stats.stores.length === 0) return <p className="text-xs text-text-muted">対象店舗がありません</p>;
  const table = () => statsTable(stats, storeName);
  const download = () => {
    const blob = new Blob([toCsv(table())], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = csvFileName(title, todayKey);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
  };
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <p className="text-xs font-bold">
        全項目を達成 <span className="text-ok">{stats.doneStores}</span>
        店舗／一部 <span className="text-warn">{stats.partialStores}</span>
        店舗／未提出 <span className="text-ng">{stats.noneStores}</span>店舗
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={() => copy(toTsv(table()))} className={btnCls}>
          {copied ? 'コピーしました' : '集計をコピー'}
        </button>
        <button type="button" onClick={download} className={btnCls}>
          CSVで保存
        </button>
      </div>
      {fallback}
    </div>
  );
};

// ============================================================
// 項目別の表示
// ============================================================

export const ScheduleItemStats: FC<{
  title: string;
  stats: ScheduleStats;
  data: Record<StoreKey, Submission | null>;
  stores: Record<StoreKey, Store>;
}> = ({ title, stats, data, stores }) => {
  const storeName = (k: StoreKey) => stores[k]?.name ?? k;
  const [gridItem, setGridItem] = useState<ItemStat | null>(null);
  if (stats.stores.length === 0) {
    return <p className="py-8 text-center text-sm text-text-muted">対象店舗がありません</p>;
  }
  return (
    <div className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
      {stats.items.map((s) => (
        <ItemStatCard
          key={s.index}
          title={title}
          stat={s}
          storeName={storeName}
          onShowPhotos={() => setGridItem(s)}
        />
      ))}
      {stats.retiredPhotoCount > 0 && (
        <p className="px-1 text-[11px] text-text-muted">
          削除・変更された項目の写真 {stats.retiredPhotoCount}枚
        </p>
      )}
      {gridItem && (
        <PhotoGridModal
          title={title}
          stat={gridItem}
          items={stats.items.map((s) => s.item)}
          data={data}
          storeName={storeName}
          onClose={() => setGridItem(null)}
        />
      )}
    </div>
  );
};

const ItemStatCard: FC<{
  title: string;
  stat: ItemStat;
  storeName: (key: StoreKey) => string;
  onShowPhotos: () => void;
}> = ({ title, stat, storeName, onShowPhotos }) => {
  const { copied, copy, fallback } = useCopy();
  const pct = Math.round(stat.rate * 100);
  const text = missingStoresText(title, stat, storeName);
  const chip = (cls: string, label: string) => (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>
  );
  return (
    <div className="rounded-xl border border-border bg-surface p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 flex-1 truncate text-sm font-bold">
          {stat.index + 1}. {stat.item.label}
        </p>
        <span className="shrink-0 text-[10px] text-text-muted">
          必要{stat.item.required}枚／最大{stat.item.max}枚
        </span>
      </div>
      {stat.unachievable && (
        <p className="mt-1 rounded bg-ng-bg px-2 py-1 text-[11px] font-bold text-ng">
          必要枚数が上限を超えているため、達成できません
        </p>
      )}
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-surface2">
        <div className="h-full bg-ok" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 text-[11px] text-text-muted">
        達成 {stat.done.length} / 対象 {stat.targetCount}店舗・{pct}%
      </p>
      <div className="mt-2 flex flex-wrap gap-1">
        {chip('bg-ok-bg text-ok', `達成 ${stat.done.length}`)}
        {chip('bg-warn-bg text-warn', `一部 ${stat.partial.length}`)}
        {chip('bg-ng-bg text-ng', `未達成 ${stat.missing.length}`)}
      </div>
      <p className="mt-2 text-[11px] text-text-muted">
        写真 {stat.photoCount}枚・店舗あたり {stat.average.toFixed(1)}枚
      </p>
      {(stat.missing.length > 0 || stat.partial.length > 0) && (
        <details className="mt-2 text-xs">
          <summary className="cursor-pointer text-[11px] font-bold text-text-muted">
            未達成・一部の店舗（{stat.missing.length + stat.partial.length}）
          </summary>
          <ul className="mt-1 space-y-0.5 pl-2">
            {stat.missing.map((k) => (
              <li key={k}>
                <span className="text-ng">●</span> {storeName(k)}
              </li>
            ))}
            {stat.partial.map((p) => (
              <li key={p.key}>
                <span className="text-warn">●</span> {storeName(p.key)}（{p.count}/{p.required}枚）
              </li>
            ))}
          </ul>
        </details>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-2">
        {text ? (
          <button type="button" onClick={() => copy(text)} className={btnCls}>
            {copied ? 'コピーしました' : '未達成の店舗をコピー'}
          </button>
        ) : (
          <span className="text-[11px] text-ok">未達成の店舗はありません</span>
        )}
        <button type="button" onClick={onShowPhotos} disabled={stat.photoCount === 0} className={btnCls}>
          写真を一覧で見る
        </button>
      </div>
      {fallback}
    </div>
  );
};

// ============================================================
// 写真一覧モーダル（1項目・全店舗。店名順。店舗で絞り込み）
// ============================================================

interface GridPhoto {
  key: StoreKey;
  name: string;
  url: string;
  /** 保存時のファイル名（拡張子を除く）の作り方 */
  nameWithExt: (ext: string) => string;
}

/** 提出時刻 → 業務日 YYYYMMDD（無ければ今日の業務日） */
const dateLabelOf = (uploadedAt: string | undefined): string =>
  (uploadedAt ? getDateKey(0, new Date(uploadedAt)) : getDateKey()).replace(/-/g, '');

const PhotoGridModal: FC<{
  title: string;
  stat: ItemStat;
  items: ScheduleItem[];
  data: Record<StoreKey, Submission | null>;
  storeName: (key: StoreKey) => string;
  onClose: () => void;
}> = ({ title, stat, items, data, storeName, onClose }) => {
  const [filter, setFilter] = useState<StoreKey | ''>('');
  const [current, setCurrent] = useState<number | null>(null);
  const isVideo = stat.item.source === 'video';

  const all = useMemo<GridPhoto[]>(() => {
    const range = slotRanges(items)[stat.index];
    const out: GridPhoto[] = [];
    const keys = [...stat.done, ...stat.partial.map((p) => p.key)].sort((a, b) =>
      storeName(a).localeCompare(storeName(b), 'ja'),
    );
    for (const key of keys) {
      const photos = photosMap(data[key]?.photos);
      const meta = data[key]?.photoMeta ?? {};
      let index = 0;
      for (let n = range.start; n < range.end; n += 1) {
        const url = photos.get(n);
        if (!url) continue;
        index += 1;
        const parts = {
          storeName: storeName(key),
          label: `${title}-${stat.item.label}`,
          dateLabel: dateLabelOf(meta[String(n)]?.uploadedAt),
          index,
        };
        out.push({
          key,
          name: storeName(key),
          url,
          nameWithExt: (ext) => buildPhotoFileName({ ...parts, ext }),
        });
      }
    }
    return out;
  }, [title, stat, items, data, storeName]);
  const storeKeys = useMemo(() => Array.from(new Set(all.map((p) => p.key))), [all]);
  const shown = filter ? all.filter((p) => p.key === filter) : all;
  const zipEntries: ZipEntry[] = shown.map((p) => ({ url: p.url, nameWithExt: p.nameWithExt }));
  const zipName = `${sanitizeFileName(title)}_${sanitizeFileName(stat.item.label)}_${getDateKey().replace(/-/g, '')}.zip`;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center"
        onClick={onClose}
      >
        <div
          className="flex max-h-[90vh] w-full max-w-2xl flex-col rounded-t-2xl bg-surface p-4 sm:rounded-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center gap-2">
            <h3 className="min-w-0 flex-1 truncate text-sm font-bold">
              {stat.item.label}（{shown.length}枚）
            </h3>
            <select
              value={filter}
              onChange={(e) => {
                setFilter(e.target.value);
                setCurrent(null);
              }}
              className="rounded-md border border-border bg-surface px-2 py-1 text-xs"
            >
              <option value="">全店舗</option>
              {storeKeys.map((k) => (
                <option key={k} value={k}>
                  {storeName(k)}
                </option>
              ))}
            </select>
            <button type="button" onClick={onClose} className="text-lg text-text-muted" aria-label="閉じる">
              ×
            </button>
          </div>
          <div className="mt-2">
            <ZipSaveButton
              entries={zipEntries}
              zipName={zipName}
              label="この項目の写真をまとめて保存（zip）"
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4">
            {shown.map((p, i) => (
              <div key={`${p.key}-${i}`} className="min-w-0">
                {isVideo ? (
                  <video
                    src={p.url}
                    controls
                    playsInline
                    preload="metadata"
                    className="aspect-square w-full rounded-md border border-border bg-black"
                  />
                ) : (
                  <button
                    type="button"
                    onClick={() => setCurrent(i)}
                    className="block aspect-square w-full overflow-hidden rounded-md border border-border"
                  >
                    <img src={p.url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  </button>
                )}
                <div className="mt-0.5 flex items-center gap-1">
                  <p className="min-w-0 flex-1 truncate text-[10px] text-text-muted">{p.name}</p>
                  <SavePhotoButton url={p.url} nameWithExt={p.nameWithExt} />
                </div>
              </div>
            ))}
            {shown.length === 0 && (
              <p className="col-span-full py-6 text-center text-xs text-text-muted">写真がありません</p>
            )}
          </div>
        </div>
      </div>
      {current !== null && shown[current] && (
        <Lightbox
          url={shown[current].url}
          caption={`${shown[current].name}（${current + 1}/${shown.length}）`}
          onClose={() => setCurrent(null)}
          onSave={() =>
            savePhoto(shown[current].url, shown[current].nameWithExt).catch(() =>
              alert('保存できませんでした'),
            )
          }
          onPrev={current > 0 ? () => setCurrent(current - 1) : undefined}
          onNext={current < shown.length - 1 ? () => setCurrent(current + 1) : undefined}
        />
      )}
    </>
  );
};
