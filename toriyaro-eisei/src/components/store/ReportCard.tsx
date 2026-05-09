import { StatusChip, statusOf } from "../ui/StatusChip";

interface Props {
  variant: "daily" | "weekly";
  title: string;
  description: string;
  count: number;
  total?: number;
  onOpen: () => void;
}

const VARIANT = {
  daily: { border: "border-l-accent", label: "DAILY", bar: "bg-accent" },
  weekly: { border: "border-l-blue-500", label: "WEEKLY", bar: "bg-blue-500" },
} as const;

export const ReportCard = ({
  variant,
  title,
  description,
  count,
  total = 7,
  onOpen,
}: Props) => {
  const v = VARIANT[variant];
  const pct = Math.min(100, (count / total) * 100);
  const s = statusOf(count, total);
  const ctaLabel =
    s === "ok" ? "写真を確認・更新" : s === "warn" ? "続きを撮影する" : "撮影を開始";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`block w-full text-left rounded-2xl border border-border ${v.border} border-l-4 bg-surface p-4 shadow-sm transition active:scale-[0.99]`}
    >
      <div className="mb-2 flex items-center justify-between">
        <span className="font-display text-[11px] font-extrabold tracking-widest text-muted">
          {v.label}
        </span>
        <StatusChip count={count} total={total} />
      </div>
      <h3 className="text-base font-bold text-ink">{title}</h3>
      <p className="mt-1 text-xs text-muted">{description}</p>
      <div className="mt-4 flex items-center gap-3">
        <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-surface2">
          <div
            className={`absolute inset-y-0 left-0 ${v.bar} transition-all`}
            style={{ width: `${pct}%` }}
          />
        </div>
        <span className="font-mono text-xs font-bold text-ink">
          {count}/{total}
        </span>
      </div>
      <div className="mt-3 text-right text-xs font-bold text-accent">
        {ctaLabel} →
      </div>
    </button>
  );
};
