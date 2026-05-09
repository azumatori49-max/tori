export const SuccessOverlay = ({
  message = "提出しました",
  onClose,
}: {
  message?: string;
  onClose: () => void;
}) => (
  <div
    className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in"
    onClick={onClose}
  >
    <div className="rounded-2xl bg-surface px-8 py-10 text-center shadow-2xl">
      <div className="mb-3 text-5xl">✅</div>
      <div className="text-lg font-bold text-ink">{message}</div>
      <button
        type="button"
        className="mt-5 rounded-full bg-accent px-6 py-2 text-sm font-bold text-white"
        onClick={onClose}
      >
        OK
      </button>
    </div>
  </div>
);
