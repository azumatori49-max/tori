import { useEffect, useSyncExternalStore, type FC, type ReactNode } from 'react';

/**
 * アプリ内の確認画面（ブラウザ標準の confirm / alert の代わり）。
 *
 * 使い方:
 *   if (!(await confirmDialog({ title: '○○を削除しますか？', message: '元に戻せません。', confirmLabel: '削除する', danger: true }))) return;
 *   await noticeDialog({ title: '保存できませんでした', message: '…' });
 *
 * 画面のどこからでも呼べるように、表示役の <ConfirmHost /> を App の一番外側に1つだけ置く。
 */
export interface ConfirmOptions {
  /** 見出し（何をするのか） */
  title: string;
  /** 説明（何が起きるか・元に戻せるか）。改行はそのまま表示する */
  message?: ReactNode;
  /** 実行ボタンの文言（既定: OK） */
  confirmLabel?: string;
  /** やめるボタンの文言（既定: やめる） */
  cancelLabel?: string;
  /** 元に戻せない操作のとき true（実行ボタンを赤にする） */
  danger?: boolean;
}

interface DialogState extends ConfirmOptions {
  /** true のときは「お知らせ」。ボタンは閉じる1つだけ */
  noticeOnly: boolean;
  resolve: (ok: boolean) => void;
}

let current: DialogState | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const getSnapshot = () => current;

const open = (opts: ConfirmOptions, noticeOnly: boolean): Promise<boolean> =>
  new Promise((resolve) => {
    // すでに開いているものがあれば「やめる」扱いで閉じる
    current?.resolve(false);
    current = { ...opts, noticeOnly, resolve };
    emit();
  });

const close = (ok: boolean) => {
  const c = current;
  current = null;
  emit();
  c?.resolve(ok);
};

/** 確認画面を出す。実行が選ばれたら true、やめる・外側タップ・Esc は false */
export const confirmDialog = (opts: ConfirmOptions): Promise<boolean> => open(opts, false);

/** お知らせ（エラーなど）を出す。閉じるまで待つ */
export const noticeDialog = async (opts: Pick<ConfirmOptions, 'title' | 'message'>): Promise<void> => {
  await open({ ...opts, confirmLabel: '閉じる' }, true);
};

export const ConfirmHost: FC = () => {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!state) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [state]);

  if (!state) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4" role="presentation">
      <div className="absolute inset-0 bg-black/50 animate-fadeIn" onClick={() => close(false)} />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="relative w-full max-w-sm rounded-2xl bg-surface p-5 shadow-2xl animate-fadeIn"
      >
        <h2 id="confirm-dialog-title" className="text-base font-bold leading-snug text-text">
          {state.title}
        </h2>
        {state.message && (
          <div className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-text">{state.message}</div>
        )}
        <div className="mt-5 flex gap-2">
          {!state.noticeOnly && (
            <button
              type="button"
              autoFocus
              onClick={() => close(false)}
              className="min-h-[44px] flex-1 rounded-xl border border-border bg-surface px-3 text-sm font-bold text-text"
            >
              {state.cancelLabel ?? 'やめる'}
            </button>
          )}
          <button
            type="button"
            autoFocus={state.noticeOnly}
            onClick={() => close(true)}
            className={`min-h-[44px] flex-1 rounded-xl px-3 text-sm font-bold text-white ${
              state.danger ? 'bg-ng' : 'bg-accent'
            }`}
          >
            {state.confirmLabel ?? 'OK'}
          </button>
        </div>
      </div>
    </div>
  );
};
