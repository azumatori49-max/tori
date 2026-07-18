import { useEffect, useState } from 'react';
import { SLOT_COUNT, useReportItems, type ReportItems } from '../../hooks/useReportItems';

/** 撮影項目の名称を編集するタブ（管理者のみ） */
export const ItemsTab = () => {
  const { items, loading, saveItems } = useReportItems();
  const [draft, setDraft] = useState<ReportItems>(items);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  // 未編集の間はクラウドの最新値を反映する
  useEffect(() => {
    if (!dirty) setDraft(items);
  }, [items, dirty]);

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
      await saveItems(draft);
      setDirty(false);
      setMsg('保存しました。店舗の画面にすぐ反映されます');
    } catch (e) {
      setMsg(e instanceof Error ? e.message : '保存に失敗しました');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <div className="py-8 text-center text-sm text-text-muted">読み込み中…</div>;
  }

  return (
    <div className="px-4 py-4 pb-8">
      <p className="mb-4 text-xs text-text-muted">
        写真スロットに表示される撮影項目の名称です。変更して「保存」を押すと全店舗に反映されます。
      </p>

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
        {busy ? '保存中…' : '保存'}
      </button>
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
