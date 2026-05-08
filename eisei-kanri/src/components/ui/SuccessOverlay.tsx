interface Props {
  visible: boolean;
  message?: string;
}

export const SuccessOverlay = ({ visible, message = '提出が完了しました' }: Props) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center animate-fade-in">
      <div className="bg-surface rounded-2xl px-8 py-10 flex flex-col items-center gap-3 max-w-xs mx-4 shadow-2xl">
        <div className="w-16 h-16 rounded-full bg-ok-bg flex items-center justify-center">
          <span className="text-ok text-3xl">✓</span>
        </div>
        <p className="font-bold text-lg">{message}</p>
        <p className="text-text-muted text-sm">お疲れさまでした</p>
      </div>
    </div>
  );
};
