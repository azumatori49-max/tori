import { formatTimestampJa } from '../../lib/dateUtils';

interface Props {
  index: number;
  label: string;
  checkedAt: string | null;
  busy?: boolean;
  disabled?: boolean;
  onToggle: (next: boolean) => void;
}

export const CheckSlot = ({ index, label, checkedAt, busy, disabled, onToggle }: Props) => {
  const checked = !!checkedAt;
  const handleClick = () => {
    if (disabled || busy) return;
    onToggle(!checked);
  };
  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        onClick={handleClick}
        disabled={disabled || busy}
        className={`relative aspect-square w-full rounded-2xl border-2 transition active:scale-[0.97] flex items-center justify-center ${
          checked
            ? 'border-ok bg-ok-bg'
            : 'border-dashed border-border bg-surface2 hover:border-accent/60'
        }`}
        aria-pressed={checked}
        aria-label={`${label} を${checked ? '取り消す' : '確認済みにする'}`}
      >
        <span
          className={`absolute top-2 left-2 inline-flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shadow ${
            checked ? 'bg-ok text-white' : 'bg-border text-text-muted'
          }`}
        >
          {index + 1}
        </span>

        {busy ? (
          <span className="w-7 h-7 rounded-full border-[3px] border-accent border-t-transparent animate-spin" />
        ) : checked ? (
          <span className="flex flex-col items-center gap-1 text-ok">
            <svg
              viewBox="0 0 24 24"
              className="w-10 h-10"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="5 12.5 10 17.5 19 7.5" />
            </svg>
            <span className="text-[10px] font-bold tracking-wider">確認済み</span>
          </span>
        ) : (
          <span className="flex flex-col items-center gap-1 text-text-muted">
            <svg
              viewBox="0 0 24 24"
              className="w-7 h-7"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 11l3 3 7-7" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <span className="text-[11px] font-bold tracking-wider">タップして確認</span>
          </span>
        )}
      </button>

      <span className="text-[10px] leading-tight font-bold text-text text-center px-0.5 break-keep">
        {label}
      </span>
      {checked && checkedAt ? (
        <span className="text-[9px] leading-tight text-text-muted text-center font-mono">
          {formatTimestampJa(checkedAt)}
        </span>
      ) : null}
    </div>
  );
};
