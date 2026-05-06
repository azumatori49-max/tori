import { useCallback, useEffect, useRef, useState } from 'react';

interface Props {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
  title?: string;
}

const detectInAppBrowser = (): string | null => {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent || '';
  if (/Instagram/i.test(ua)) return 'Instagram';
  if (/\bLine\//i.test(ua)) return 'LINE';
  if (/FBAN|FBAV/i.test(ua)) return 'Facebook';
  if (/Twitter/i.test(ua)) return 'Twitter / X';
  if (/TikTok/i.test(ua)) return 'TikTok';
  return null;
};

const stopStream = (stream: MediaStream | null) => {
  stream?.getTracks().forEach((t) => t.stop());
};

export const CameraCapture = ({ open, onClose, onCapture, title = '写真撮影' }: Props) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fallbackInputRef = useRef<HTMLInputElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const start = useCallback(async () => {
    setError(null);
    setReady(false);
    try {
      if (!navigator.mediaDevices?.getUserMedia) {
        throw new Error('このブラウザはカメラに対応していません');
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: 'environment' },
          width: { ideal: 1920 },
          height: { ideal: 1440 },
        },
        audio: false,
      });
      streamRef.current = stream;
      const video = videoRef.current;
      if (video) {
        video.srcObject = stream;
        await video.play();
        setReady(true);
      }
    } catch (e) {
      stopStream(streamRef.current);
      streamRef.current = null;
      const inApp = detectInAppBrowser();
      let msg: string;
      if (e instanceof DOMException && e.name === 'NotAllowedError') {
        msg = inApp
          ? `${inApp} のアプリ内ブラウザではカメラを使えません。\n右上のメニューから「Google で開く」または「ブラウザで開く」を選んでください。`
          : 'カメラの使用が許可されていません。\nアドレスバーの鍵マーク → 権限 → カメラ → 許可\nに変更してから再読み込みしてください。';
      } else if (e instanceof DOMException && e.name === 'NotFoundError') {
        msg = '使用可能なカメラが見つかりませんでした。';
      } else if (e instanceof Error) {
        msg = e.message;
      } else {
        msg = 'カメラを起動できませんでした';
      }
      setError(msg);
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    void start();
    return () => {
      stopStream(streamRef.current);
      streamRef.current = null;
      setReady(false);
    };
  }, [open, start]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  const handleShutter = useCallback(async () => {
    const video = videoRef.current;
    if (!video || busy || !ready) return;
    setBusy(true);
    try {
      const w = video.videoWidth;
      const h = video.videoHeight;
      if (!w || !h) {
        throw new Error('プレビューが準備できていません');
      }
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('canvas context unavailable');
      ctx.drawImage(video, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.92),
      );
      if (!blob) throw new Error('画像の生成に失敗しました');
      const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : '撮影に失敗しました');
    } finally {
      setBusy(false);
    }
  }, [busy, ready, onCapture, onClose]);

  const handleFallbackPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (f) {
      onCapture(f);
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col animate-fadeIn">
      <header className="flex items-center justify-between px-4 py-3 text-white">
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 rounded-lg bg-white/15 text-sm font-bold hover:bg-white/25 transition"
        >
          キャンセル
        </button>
        <span className="font-display text-sm font-bold tracking-wide">{title}</span>
        <span className="w-[68px]" aria-hidden />
      </header>

      <div className="flex-1 relative overflow-hidden">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover bg-black"
          playsInline
          muted
        />

        {!ready && !error ? (
          <div className="absolute inset-0 flex items-center justify-center text-white/80 text-sm">
            カメラを起動中…
          </div>
        ) : null}

        {error ? (
          <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white text-center px-6 gap-4">
            <p className="text-sm leading-relaxed whitespace-pre-line">{error}</p>
            <div className="flex flex-col gap-2 w-full max-w-xs">
              <button
                type="button"
                onClick={start}
                className="px-4 py-2.5 rounded-xl bg-white text-black font-bold"
              >
                もう一度試す
              </button>
              <button
                type="button"
                onClick={() => fallbackInputRef.current?.click()}
                className="px-4 py-2.5 rounded-xl bg-white/15 text-white font-bold"
              >
                端末のカメラアプリで撮影
              </button>
            </div>
            <input
              ref={fallbackInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFallbackPick}
            />
          </div>
        ) : null}
      </div>

      <footer className="py-6 flex items-center justify-center bg-black safe-bottom">
        <button
          type="button"
          onClick={handleShutter}
          disabled={!ready || busy || !!error}
          className="w-[78px] h-[78px] rounded-full bg-white border-[6px] border-white/40 active:scale-95 transition disabled:opacity-40"
          aria-label="撮影"
        />
      </footer>
    </div>
  );
};
