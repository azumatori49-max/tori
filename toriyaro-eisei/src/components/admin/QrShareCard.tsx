import { useState, type FC } from 'react';
import { QRCodeSVG } from 'qrcode.react';

export const QrShareCard: FC = () => {
  const [open, setOpen] = useState(false);
  const url = window.location.origin;

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between"
      >
        <h2 className="text-xs font-bold">アプリ共有用QRコード</h2>
        <span className="text-text-muted">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="mt-4 flex flex-col items-center gap-3">
          <div className="rounded-xl border border-border bg-white p-4">
            <QRCodeSVG value={url} size={200} />
          </div>
          <p className="break-all text-center text-xs font-bold text-text">{url}</p>
          <p className="text-center text-[11px] text-text-muted">
            スタッフにこのQRコードを読み取ってもらい、開いたページを
            「ホーム画面に追加」してもらってください。
            スクリーンショットを撮ってLINE等で配布することもできます。
          </p>
        </div>
      )}
    </div>
  );
};