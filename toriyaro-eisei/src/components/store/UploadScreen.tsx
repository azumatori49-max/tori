import { useState } from "react";
import { AppHeader } from "../layout/AppHeader";
import { PhotoSlot } from "../ui/PhotoSlot";
import { SuccessOverlay } from "../ui/SuccessOverlay";
import { useSubmit } from "../../hooks/useSubmissions";
import { getDateKey, getWeekKey } from "../../lib/dateUtils";
import type { ReportType, StoreKey } from "../../types";

interface Props {
  storeKey: StoreKey;
  storeName: string;
  type: ReportType;
  onBack: () => void;
}

const TOTAL = 7;

export const UploadScreen = ({ storeKey, storeName, type, onBack }: Props) => {
  const [files, setFiles] = useState<(File | null)[]>(() =>
    Array.from({ length: TOTAL }, () => null),
  );
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { submit, submitting, progress } = useSubmit();

  const filledCount = files.filter(Boolean).length;
  const ready = filledCount === TOTAL;

  const setAt = (i: number, f: File) => {
    setFiles((prev) => {
      const next = [...prev];
      next[i] = f;
      return next;
    });
  };

  const handleSubmit = async () => {
    setError(null);
    const list = files.filter((f): f is File => !!f);
    if (list.length !== TOTAL) {
      setError("7枚すべて撮影してください");
      return;
    }
    try {
      const key = type === "daily" ? getDateKey() : getWeekKey();
      await submit(storeKey, storeName, type, key, list);
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "アップロードに失敗しました");
    }
  };

  return (
    <div className="mx-auto flex min-h-full max-w-app flex-col">
      <AppHeader
        title={type === "daily" ? "デイリー報告" : "ウィークリー報告"}
        subtitle={storeName}
        onBack={onBack}
      />

      <div className="px-5 py-5">
        <p className="mb-4 text-sm text-muted">
          {type === "daily"
            ? "開店前にチェックポイントを順番に撮影してください。"
            : "週1回のディープチェック。各箇所を漏れなく撮影してください。"}
        </p>

        <div className="mb-4 flex items-center justify-between">
          <span className="text-xs font-bold text-muted">選択中</span>
          <span className="font-mono text-sm font-bold text-ink">
            {filledCount} / {TOTAL} 枚
          </span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {files.map((f, i) => (
            <PhotoSlot
              key={i}
              index={i}
              file={f}
              onPick={(file) => setAt(i, file)}
            />
          ))}
        </div>

        {error && (
          <p className="mt-4 rounded-lg bg-ng-bg px-3 py-2 text-sm text-ng">
            {error}
          </p>
        )}

        {submitting && (
          <div className="mt-5">
            <div className="mb-1 flex items-center justify-between text-xs text-muted">
              <span>アップロード中…</span>
              <span className="font-mono">{Math.round(progress)}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface2">
              <div
                className="h-full bg-accent transition-all"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        )}

        <button
          type="button"
          onClick={handleSubmit}
          disabled={!ready || submitting}
          className="mt-6 w-full rounded-xl bg-accent py-3.5 text-sm font-bold text-white shadow-sm transition active:scale-[0.99] disabled:cursor-not-allowed disabled:bg-border disabled:text-muted"
        >
          {submitting ? "送信中…" : ready ? "提出する" : `あと ${TOTAL - filledCount} 枚`}
        </button>
      </div>

      {done && (
        <SuccessOverlay
          message="提出が完了しました"
          onClose={() => {
            setDone(false);
            onBack();
          }}
        />
      )}
    </div>
  );
};
