type Status = "ok" | "warn" | "ng";

const LABELS: Record<Status, string> = {
  ok: "提出済み",
  warn: "一部提出",
  ng: "未提出",
};

const CLASSES: Record<Status, string> = {
  ok: "bg-ok-bg text-ok",
  warn: "bg-warn-bg text-warn",
  ng: "bg-ng-bg text-ng",
};

export const statusOf = (count: number, total = 7): Status => {
  if (count >= total) return "ok";
  if (count > 0) return "warn";
  return "ng";
};

export const StatusChip = ({
  count,
  total = 7,
  label,
}: {
  count: number;
  total?: number;
  label?: string;
}) => {
  const s = statusOf(count, total);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-bold ${CLASSES[s]}`}
    >
      {label ?? LABELS[s]}
    </span>
  );
};
