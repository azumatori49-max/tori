interface Props {
  visible: boolean;
  message?: string;
}

export const SuccessOverlay = ({ visible, message = '提出しました' }: Props) => {
  if (!visible) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 animate-fade-in">
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-white px-10 py-8 shadow-2xl">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-ok text-white text-3xl">
          ✓
        </div>
        <p className="text-base font-bold text-text">{message}</p>
      </div>
    </div>
  );
};
