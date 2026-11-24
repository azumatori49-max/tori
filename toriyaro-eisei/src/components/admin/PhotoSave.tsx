import { useRef, useState, type FC } from 'react';
import { savePhoto, saveZip, type ZipEntry } from '../../lib/download';

const btnCls =
  'rounded-md border border-border bg-surface px-3 py-1.5 text-[11px] font-bold text-text-muted disabled:opacity-50';

/** 1枚の保存ボタン（サムネイルの下などに置く小さいもの） */
export const SavePhotoButton: FC<{
  url: string;
  nameWithExt: (ext: string) => string;
  className?: string;
}> = ({ url, nameWithExt, className }) => {
  const [state, setState] = useState<'idle' | 'saving' | 'failed'>('idle');
  const run = async () => {
    setState('saving');
    try {
      await savePhoto(url, nameWithExt);
      setState('idle');
    } catch {
      setState('failed');
    }
  };
  return (
    <button
      type="button"
      onClick={run}
      disabled={state === 'saving'}
      className={
        className ??
        'rounded bg-surface2 px-1.5 py-0.5 text-[10px] font-bold text-text-muted disabled:opacity-50'
      }
    >
      {state === 'saving' ? '保存中…' : state === 'failed' ? '失敗・再試行' : '保存'}
    </button>
  );
};

const BIG_ZIP = 100;

/** まとめて保存（zip）。進捗・キャンセル・失敗分のやり直し */
export const ZipSaveButton: FC<{ entries: ZipEntry[]; zipName: string; label: string }> = ({
  entries,
  zipName,
  label,
}) => {
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [result, setResult] = useState<{ saved: number; failed: ZipEntry[] } | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const run = async (targets: ZipEntry[]) => {
    if (
      targets.length > BIG_ZIP &&
      !confirm(`${targets.length}枚あります。大きいため時間がかかります。続けますか？`)
    )
      return;
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setResult(null);
    setProgress({ done: 0, total: targets.length });
    try {
      const r = await saveZip(targets, zipName, {
        signal: ctrl.signal,
        onProgress: (done, total) => setProgress({ done, total }),
      });
      if (!r.cancelled) setResult({ saved: r.saved, failed: r.failed });
    } catch {
      setResult({ saved: 0, failed: targets });
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  };

  if (progress) {
    return (
      <span className="inline-flex items-center gap-2 text-[11px] font-bold text-text-muted">
        <button type="button" disabled className={btnCls}>
          保存中 {progress.done}/{progress.total}
        </button>
        <button type="button" onClick={() => abortRef.current?.abort()} className="text-text-muted underline">
          キャンセル
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-[11px]">
      <button type="button" onClick={() => run(entries)} disabled={entries.length === 0} className={btnCls}>
        {label}
      </button>
      {result && result.failed.length === 0 && (
        <span className="text-ok">保存しました（{result.saved}枚）</span>
      )}
      {result && result.failed.length > 0 && (
        <>
          <span className="text-ng">
            保存 {result.saved}枚・{result.failed.length}枚取得できませんでした
          </span>
          <button type="button" onClick={() => run(result.failed)} className={btnCls}>
            失敗分をやり直す
          </button>
        </>
      )}
    </span>
  );
};
