import { useEffect, useMemo, useState } from 'react';
import {
  SLOT_COUNT,
  clearStoreItems,
  padLabels,
  saveStoreItems,
  useReportItems,
} from '../../hooks/useReportItems';
import type { StoreMap } from '../../hooks/useStores';
import type { ReportItems } from '../../types';

interface Props {
  stores: StoreMap;
}

const COMMON = '__common__';

/** 撮影項目の名称を編集するタブ（管理者のみ）。共通設定と店舗ごとの個別設定に対応 */
export const ItemsTab = ({ stores }: Props) => {
  const { items, loading, saveItems } = useReportItems();
  const [target, setTarget] = useState<string>(COMMON);
  const [draft, setDraft] = useState<ReportItems>(items);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const storeEntries = useMemo(
    () =>
      Object.entries(stores).sort(([, a], [, b]) => a.name.localeCompare(b.name, 'ja')),
    [stores]
  );

  const targetStore = target === COMMON ? undefined : stores[target];
  const hasOverride = !!(targetStore?.items?.daily || targetStore?.items?.weekly);

  /** 編集対象の現在値（店舗選択時は個別設定を共通設定で補完した状態） */
  const currentValues = useMemo<ReportItems>(() => {
    if (target === COMMON) return items;
    return {
      daily: padLabels(targetStore?.items?.daily, items.daily),
      weekly: padLabels(targetStore?.items?.weekly, items.weekly),
    };
  }, [target, targetStore, items]);

  // 未編集の間はクラウドの最新値を反映する
  useEffect(() => {
    if (!dirty) setDraft(currentValues);
  }, [currentValues, dirty]);

  const switchTarget = (next: string) => {
    setTarget(next);
    setDirty(false);
    setMsg('');
  };

  const update = (type: keyof ReportItems, index: number, value: string) => {
    setDirty(true);
    setMsg('');
    setDraft((prev) => {
      const next = { ...prev, [type]: [...prev[type]] };
      next[type][index] = value;
      return next;
    });
  };

  const handleSave = async () => {
    setBusy(true);
    setMsg('');
    try {
      if (target === COMMON) {
        await saveItems(draft);
        setMsg('保存しました。個別設定のない全店舗に反映されます');
      } else {
        await saveStoreItems(target, draft);
        setMsg(`「${targetStore?.name ?? ''}」の個別設定を保存しました`);
      }
      setDirty(false);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  const handleClearOverride = async () => {
    if (target === COMMON) return;
    if (!confirm(`「${targetStore?.name ?? ''}」の個別設定を削除して共通設定に戻します。よろしいですか？`)) {
      return;
    }
    setBusy(true);
    setMsg('');
    try {
      await clearStoreItems(target);
      setDirty(false);
      setMsg('共通設定に戻しました');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '解除に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-sm text-text-muted">読み込み中…</div>;
  }

  return (
    <div className="px-4 py-4 pb-8">
      <p className="mb-3 text-xs text-text-muted">
        写真スロットに表示される撮影項目の名称です。共通設定のほか、店舗ごとに個別の項目名も設定できます。
      </p>

      <div className="mb-4">
        <label className="mb-1 block text-xs font-bold text-text-muted">設定対象</label>
        <select
          value={target}
          onChange={(e) => switchTarget(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm"
        >
          <option value={COMMON}>全店舗共通（既定）</option>
          {storeEntries.map(([k, v]) => (
            <option key={k} value={k}>
              {v.name}
              {v.items?.daily || v.items?.weekly ? '（個別設定あり）' : ''}
            </option>
          ))}
        </select>
        {target !== COMMON && !hasOverride && (
          <p className="mt-1 text-[11px] text-text-muted">
            この店舗は現在、共通設定を使用しています。保存すると個別設定になります。
          </p>
        )}
      </div>

      <Section
        title="デイリー（毎日）"
        color="text-accent"
        values={draft.daily}
        onChange={(i, v) => update('daily', i, v)}
      />
      <Section
        title="ウィークリー（週1回）"
        color="text-accent-deep"
        values={draft.weekly}
        onChange={(i, v) => update('weekly', i, v)}
      />

      {msg && (
        <div className="mb-3 rounded-lg bg-ok-bg px-3 py-2 text-xs font-bold text-ok">{msg}</div>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={busy || !dirty}
        className="w-full rounded-lg bg-accent py-3 text-sm font-bold text-white shadow-sm transition active:scale-[0.98] disabled:opacity-50"
      >
        {busy ? '保存中…' : target === COMMON ? '保存' : 'この店舗の個別設定として保存'}
      </button>

      {target !== COMMON && hasOverride && (
        <button
          type="button"
          onClick={handleClearOverride}
          disabled={busy}
          className="mt-2 w-full rounded-lg border border-border bg-surface py-2.5 text-sm font-bold text-text-muted active:bg-surface2 disabled:opacity-50"
        >
          個別設定を削除して共通設定に戻す
        </button>
      )}
    </div>
  );
};

const Section = ({
  title,
  color,
  values,
  onChange,
}: {
  title: string;
  color: string;
  values: string[];
  onChange: (index: number, value: string) => void;
}) => (
  <section className="mb-5">
    <h3 className={`mb-2 text-sm font-black tracking-wide ${color}`}>{title}</h3>
    <div className="space-y-2 rounded-xl border border-border bg-surface p-3">
      {Array.from({ length: SLOT_COUNT }).map((_, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="w-6 shrink-0 text-right text-xs font-bold text-text-muted">
            {i + 1}.
          </span>
          <input
            type="text"
            value={values[i] ?? ''}
            onChange={(e) => onChange(i, e.target.value)}
            placeholder={`項目${i + 1}`}
            className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm"
          />
        </div>
      ))}
    </div>
  </section>
);
