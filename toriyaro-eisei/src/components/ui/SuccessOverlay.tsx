interface Props {
  visible: boolean;
  title?: string;
  subtitle?: string;
}

export const SuccessOverlay = ({ visible, title = '提出完了', subtitle }: Props) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fadeIn">
      <div className="card px-8 py-10 flex flex-col items-center gap-3 animate-popIn shadow-xl">
        <div className="w-16 h-16 rounded-full bg-ok-bg flex items-center justify-center">
          <svg
            viewBox="0 0 24 24"
            className="w-9 h-9 text-ok"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="5 12.5 10 17.5 19 7.5" />
          </svg>
        </div>
        <h3 className="font-display text-2xl font-extrabold tracking-wide">{title}</h3>
        {subtitle ? <p className="text-sm text-text-muted">{subtitle}</p> : null}
      </div>
    </div>
  );
};
