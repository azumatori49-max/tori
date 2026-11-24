import { useEffect, useState, type FC } from 'react';
import { Lightbox } from '../ui/Lightbox';
import { confirmDialog, noticeDialog } from '../ui/ConfirmDialog';
import {
  deletePhoto,
  fetchSubmissionsForKey,
  markAsLineReport,
  moveSubmission,
  unmarkSubmission,
} from '../../hooks/useSubmissions';
import {
  dateKeyToDate,
  formatDateTimeJa,
  getMonthKey,
  getWeekKey,
} from '../../lib/dateUtils';
import { itemsForType, targetForType } from '../../data/checkItems';
import { buildPhotoFileName, sanitizeFileName, type ZipEntry } from '../../lib/download';
import { SavePhotoButton, ZipSaveButton } from './PhotoSave';
import type { ReportType, StoreKey, Submission } from '../../types';

interface Props {
  open: boolean;
  storeKey: StoreKey | null;
  storeName: string;
  anchorDateKey: string;
  onClose: () => void;
  readOnly?: boolean;
  /** この画面で内容を変えた（LINE報告・写真の削除・移動）ときに呼ぶ。一覧の読み直し用 */
  onChanged?: () => void;
}

interface LoadedData {
  daily: Submission | null;
  weekly: Submission | null;
  monthly: Submission | null;
}

const normalisePhotos = (raw: unknown): Map<number, string> => {
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

const TYPE_LABEL: Record<ReportType, string> = { daily: 'デイリー', weekly: 'ウィークリー', monthly: 'マンスリー' };

/** 保存ファイル名の日付: デイリーは業務日、ウィークリーは週の月曜日、マンスリーは YYYYMM */
const dateLabelFor = (type: ReportType, key: string): string =>
  (type === 'weekly' ? key.slice(1) : key).replace(/-/g, '');

/** 番号 → 保存ファイル名（拡張子を除く）の作り方。multi 項目は 1,2,3 と連番 */
const photoNamer = (
  type: ReportType,
  storeKey: StoreKey | null,
  key: string,
  storeName: string,
): ((slot: number) => (ext: string) => string) => {
  const items = itemsForType(type, storeKey, key);
  const lastItem = items[items.length - 1];
  const fixedCount = lastItem?.multi ? items.length - 1 : items.length;
  return (slot) => {
    const item = slot < fixedCount ? items[slot] : lastItem;
    const index = slot < fixedCount ? 1 : slot - fixedCount + 1;
    return (ext) =>
      buildPhotoFileName({
        storeName,
        label: `${TYPE_LABEL[type]}-${item?.label ?? ''}`,
        dateLabel: dateLabelFor(type, key),
        index,
        ext,
      });
  };
};

/** その種類の提出にある写真すべての zip 用エントリ */
const zipEntriesFor = (
  type: ReportType,
  storeKey: StoreKey | null,
  key: string,
  storeName: string,
  submission: Submission | null,
): ZipEntry[] => {
  const namer = photoNamer(type, storeKey, key, storeName);
  return Array.from(normalisePhotos(submission?.photos).entries())
    .sort((a, b) => a[0] - b[0])
    .map(([slot, url]) => ({ url, nameWithExt: namer(slot) }));
};

const formatPhotoTime = (iso: string): string => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

export const StoreDetailModal: FC<Props> = ({
  open,
  storeKey,
  storeName,
  anchorDateKey,
  onClose,
  readOnly = false,
  onChanged,
}) => {
  const [data, setData] = useState<LoadedData>({ daily: null, weekly: null, monthly: null });
  const [loading, setLoading] = useState(false);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const dailyKey = anchorDateKey;
  const weekKey = getWeekKey(0, dateKeyToDate(anchorDateKey));
  const monthKey = getMonthKey(0, dateKeyToDate(anchorDateKey));

  useEffect(() => {
    if (!open || !storeKey) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetchSubmissionsForKey([storeKey], 'daily', dailyKey),
      fetchSubmissionsForKey([storeKey], 'weekly', weekKey),
      fetchSubmissionsForKey([storeKey], 'monthly', monthKey),
    ])
      .then(([d, w, m]) => {
        if (!cancelled) {
          setData({
            daily: d[storeKey] ?? null,
            weekly: w[storeKey] ?? null,
            monthly: m[storeKey] ?? null,
          });
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, storeKey, dailyKey, weekKey, monthKey, reloadToken]);

  if (!open) return null;

  const reload = () => {
    setReloadToken((t) => t + 1);
    onChanged?.();
  };
  const allEntries: ZipEntry[] = readOnly
    ? []
    : [
        ...zipEntriesFor('daily', storeKey, dailyKey, storeName, data.daily),
        ...zipEntriesFor('weekly', storeKey, weekKey, storeName, data.weekly),
        ...zipEntriesFor('monthly', storeKey, monthKey, storeName, data.monthly),
      ];

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/40 animate-fadeIn" onClick={onClose} />
      {/* スマホは下から出るシート、PC（1024px以上）は中央の広いダイアログ */}
      <div className="absolute inset-x-0 bottom-0 max-h-[90vh] overflow-y-auto rounded-t-3xl bg-surface shadow-2xl animate-slideUp lg:inset-x-auto lg:bottom-auto lg:left-1/2 lg:top-1/2 lg:w-[960px] lg:max-w-[94vw] lg:-translate-x-1/2 lg:-translate-y-1/2 lg:animate-fadeIn lg:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-5 py-3 backdrop-blur">
          <div className="min-w-0">
            <h2 className="truncate text-base font-bold">{storeName}</h2>
            <p className="text-[11px] text-text-muted">{anchorDateKey}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center text-2xl text-text-muted hover:text-accent"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="px-5 py-4 space-y-6">
          {loading && <p className="text-center text-sm text-text-muted">読み込み中…</p>}
          {!loading && !readOnly && (
            <ZipSaveButton
              entries={allEntries}
              zipName={`${sanitizeFileName(storeName)}_${anchorDateKey.replace(/-/g, '')}.zip`}
              label={`この店舗の写真をまとめて保存（zip・${allEntries.length}枚）`}
            />
          )}
          {!loading && (
            <>
              <Section
                label="DAILY"
                type="daily"
                storeKey={storeKey}
                storeName={storeName}
                currentKey={dailyKey}
                color="text-accent"
                bg="bg-accent/10"
                submission={data.daily}
                onPhotoClick={setLightboxUrl}
                onReload={reload}
                readOnly={readOnly}
              />
              <Section
                label="WEEKLY"
                type="weekly"
                storeKey={storeKey}
                storeName={storeName}
                currentKey={weekKey}
                color="text-blue-600"
                bg="bg-blue-50"
                submission={data.weekly}
                onPhotoClick={setLightboxUrl}
                onReload={reload}
                readOnly={readOnly}
              />
              <Section
                label="MONTHLY"
                type="monthly"
                storeKey={storeKey}
                storeName={storeName}
                currentKey={monthKey}
                color="text-violet-600"
                bg="bg-violet-50"
                submission={data.monthly}
                onPhotoClick={setLightboxUrl}
                onReload={reload}
                readOnly={readOnly}
              />
            </>
          )}
        </div>
      </div>

      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
};

interface SectionProps {
  label: string;
  type: ReportType;
  storeKey: StoreKey | null;
  storeName: string;
  currentKey: string;
  color: string;
  bg: string;
  submission: Submission | null;
  onPhotoClick: (url: string) => void;
  onReload: () => void;
  readOnly: boolean;
}

const Section: FC<SectionProps> = ({
  label,
  type,
  storeKey,
  storeName,
  currentKey,
  color,
  bg,
  submission,
  onPhotoClick,
  onReload,
  readOnly,
}) => {
  const [moving, setMoving] = useState(false);
  const [newDate, setNewDate] = useState('');
  const [busy, setBusy] = useState(false);

  const target = targetForType(type, storeKey, currentKey);
  const items = itemsForType(type, storeKey, currentKey);
  const photos = normalisePhotos(submission?.photos);
  const photoMeta = submission?.photoMeta || {};
  const filledCount = photos.size;
  const nameFor = photoNamer(type, storeKey, currentKey, storeName);

  const lastItem = items[items.length - 1];
  const hasMulti = !!lastItem?.multi;
  const fixedItems = hasMulti ? items.slice(0, -1) : items;
  const fixedCount = fixedItems.length;

  // 複数枚OKの項目の写真。途中の番号が抜けていても、後ろの写真を落とさない
  const multiPhotos: Array<{ slot: number; url: string }> = hasMulti
    ? Array.from(photos.entries())
        .filter(([slot]) => slot >= fixedCount)
        .sort((a, b) => a[0] - b[0])
        .map(([slot, url]) => ({ slot, url }))
    : [];
  const isLine = !!submission?.viaLine;
  const typeLabel = TYPE_LABEL[type];
  const keyLabel =
    type === 'daily' ? currentKey : type === 'weekly' ? `${currentKey.slice(1)} の週` : `${currentKey.slice(1)}`;
  /** 写真番号 → 項目名（確認画面の文面用） */
  const itemLabelFor = (slot: number): string => {
    const item = slot < fixedCount ? fixedItems[slot] : lastItem;
    const n = slot < fixedCount ? slot + 1 : fixedCount + 1;
    return item ? `${n}. ${item.label}` : `${slot + 1}枚目`;
  };

  const handleMarkLine = async () => {
    if (!storeKey) return;
    const ok = await confirmDialog({
      title: 'LINE報告として提出済みにしますか？',
      message:
        `${storeName} の ${keyLabel} の${typeLabel}を、LINE報告として提出済みにします。` +
        (filledCount > 0 ? `\nすでにある写真 ${filledCount} 枚は残ります。` : '') +
        '\nあとから取り消せます。',
      confirmLabel: '提出済みにする',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await markAsLineReport(storeKey, storeName, type, currentKey);
      onReload();
    } catch (err) {
      await noticeDialog({
        title: 'LINE報告を記録できませんでした',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleUnmarkLine = async () => {
    if (!storeKey) return;
    const ok = await confirmDialog({
      title: 'LINE報告を取り消しますか？',
      message:
        `${storeName} の ${keyLabel} の${typeLabel}のLINE報告を取り消します。` +
        (filledCount > 0 ? `\n写真 ${filledCount} 枚は残ります（枚数が足りなければ一部提出に戻ります）。` : '\n未提出に戻ります。'),
      confirmLabel: '取り消す',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await unmarkSubmission(storeKey, type, currentKey);
      onReload();
    } catch (err) {
      await noticeDialog({
        title: 'LINE報告を取り消せませんでした',
        message: err instanceof Error ? err.message : String(err),
      });
    } finally {
      setBusy(false);
    }
  };

  const handleMove = async () => {
    if (!storeKey || !newDate) return;
    const targetKey =
      type === 'daily' ? newDate : getWeekKey(0, new Date(newDate + 'T00:00:00'));
    if (targetKey === currentKey) {
      await noticeDialog({ title: `同じ${type === 'daily' ? '日付' : '週'}です`, message: '移動先に別の日付を選んでください。' });
      return;
    }
    const lbl =
      type === 'daily' ? targetKey : `週 ${targetKey.slice(1)} 起算`;
    const ok = await confirmDialog({
      title: `${lbl} に移動しますか？`,
      message:
        `${storeName} の${type === 'daily' ? 'デイリー' : 'ウィークリー'}の提出を ${lbl} に移します。\n` +
        '移動先にすでに写真がある項目は、移動先の写真を残します。',
      confirmLabel: '移動する',
    });
    if (!ok) return;
    setBusy(true);
    try {
      await moveSubmission(storeKey, type, currentKey, targetKey);
      setMoving(false);
      setNewDate('');
      onReload();
    } catch (err) {
      await noticeDialog({ title: '移動できませんでした', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  const handleDeletePhoto = async (idx: number) => {
    if (!storeKey) return;
    const ok = await confirmDialog({
      title: '写真を削除しますか？',
      message: `${storeName} の「${itemLabelFor(idx)}」の写真を削除します。元に戻せません。`,
      confirmLabel: '削除する',
      danger: true,
    });
    if (!ok) return;
    setBusy(true);
    try {
      await deletePhoto(storeKey, type, currentKey, idx);
      onReload();
    } catch (err) {
      await noticeDialog({ title: '削除できませんでした', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-black tracking-widest font-display ${bg} ${color}`}
        >
          {label}
        </span>
        <span className="text-xs font-bold">
          {filledCount} 枚 / 目標 {target}
        </span>
      </div>
      {submission ? (
        <p className="mb-2 text-[11px] text-text-muted">
          提出: {formatDateTimeJa(submission.submittedAt)}
        </p>
      ) : (
        <p className="mb-2 text-[11px] text-ng">未提出</p>
      )}

      {isLine && (
        <p className="mb-2 rounded-lg bg-ok-bg px-3 py-2 text-xs font-bold text-ok">
          {filledCount > 0 ? `写真 ${filledCount} 枚 + LINE報告で完了` : 'LINE報告として記録済み（写真なし）'}
        </p>
      )}

      {/* LINE報告の操作（一覧ではなく、この詳細の中で行う）。閲覧モードでは出さない */}
      {!readOnly && (isLine || filledCount < target) && (
        <div className="mb-3">
          {isLine ? (
            <button
              type="button"
              onClick={handleUnmarkLine}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-border bg-surface px-4 text-xs font-bold text-text disabled:opacity-50"
            >
              {busy ? '処理中…' : 'LINE報告マークを取消'}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleMarkLine}
              disabled={busy}
              className="inline-flex min-h-[44px] items-center rounded-lg border border-border bg-surface px-4 text-xs font-bold text-text disabled:opacity-50"
            >
              {busy ? '処理中…' : filledCount > 0 ? '残りをLINE報告として完了にする' : 'LINE報告として提出済みにする'}
            </button>
          )}
        </div>
      )}

      {!readOnly && submission && type !== 'monthly' && (
        <div className="mb-3">
          {!moving ? (
            <button
              type="button"
              onClick={() => setMoving(true)}
              className="text-[11px] font-bold text-accent hover:underline"
            >
              別の{type === 'daily' ? '日' : '週'}に移動
            </button>
          ) : (
            <div className="rounded-lg border border-border bg-bg p-2.5 space-y-2">
              <p className="text-[10px] font-bold text-text-muted">
                移動先の{type === 'daily' ? '日付' : '週（その週内の任意の日付）'}
              </p>
              <input
                type="date"
                value={newDate}
                onChange={(e) => setNewDate(e.target.value)}
                className="w-full rounded border border-border bg-surface px-2 py-1.5 text-xs"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleMove}
                  disabled={!newDate || busy}
                  className="flex-1 rounded bg-accent py-1.5 text-[11px] font-bold text-white disabled:bg-text-muted/40"
                >
                  {busy ? '移動中…' : '移動'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoving(false);
                    setNewDate('');
                  }}
                  disabled={busy}
                  className="flex-1 rounded border border-border bg-white py-1.5 text-[11px] font-bold text-text-muted"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-3 gap-2 lg:grid-cols-6">
        {fixedItems.map((item, i) => {
          const url = photos.get(i);
          const t = photoMeta[String(i)]?.uploadedAt;
          return (
            <div key={i} className="flex flex-col gap-1">
              <div className="relative">
                <button
                  type="button"
                  disabled={!url}
                  onClick={() => url && onPhotoClick(url)}
                  className={`relative aspect-square w-full overflow-hidden rounded-lg border ${
                    url ? 'border-border bg-surface' : 'border-dashed border-border bg-surface2'
                  }`}
                >
                  {url ? (
                    <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center text-xs text-text-muted">
                      #{i + 1}
                    </span>
                  )}
                </button>
                {!readOnly && url && (
                  <button
                    type="button"
                    onClick={() => handleDeletePhoto(i)}
                    disabled={busy}
                    className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ng text-xs text-white shadow disabled:opacity-50"
                    aria-label="削除"
                  >
                    ×
                  </button>
                )}
              </div>
              <div className="px-1 text-center text-[10px] font-bold leading-tight text-text">
                {i + 1}. {item.label}
              </div>
              {!readOnly && url && (
                <div className="text-center">
                  <SavePhotoButton url={url} nameWithExt={nameFor(i)} />
                </div>
              )}
              {t && (
                <div className="text-center text-[9px] text-text-muted">
                  {formatPhotoTime(t)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {hasMulti && lastItem && (
        <div className="mt-4">
          <h4 className="mb-2 text-xs font-bold">
            {fixedCount + 1}. {lastItem.label}
            <span className="ml-2 text-[10px] font-normal text-text-muted">
              {multiPhotos.length} 枚
            </span>
          </h4>
          {multiPhotos.length === 0 ? (
            <p className="rounded-lg bg-surface2 px-3 py-2 text-[11px] text-text-muted">
              未提出
            </p>
          ) : (
            <div className="grid grid-cols-4 gap-1.5 lg:grid-cols-8">
              {multiPhotos.map(({ slot: slotIdx, url }, i) => {
                const t = photoMeta[String(slotIdx)]?.uploadedAt;
                return (
                  <div key={i} className="flex flex-col gap-0.5">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() => onPhotoClick(url)}
                        className="aspect-square w-full overflow-hidden rounded-md border border-border bg-surface"
                      >
                        <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                      </button>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => handleDeletePhoto(slotIdx)}
                          disabled={busy}
                          className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-ng text-xs text-white shadow disabled:opacity-50"
                          aria-label="削除"
                        >
                          ×
                        </button>
                      )}
                    </div>
                    {!readOnly && (
                      <div className="text-center">
                        <SavePhotoButton url={url} nameWithExt={nameFor(slotIdx)} />
                      </div>
                    )}
                    {t && (
                      <div className="text-center text-[9px] text-text-muted">
                        {formatPhotoTime(t)}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </section>
  );
};