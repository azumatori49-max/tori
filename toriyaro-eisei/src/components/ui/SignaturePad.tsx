import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
  forwardRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';

export interface SignaturePadHandle {
  /** 空なら null。書かれていれば PNG の data URL を返す */
  toDataUrl: () => string | null;
  clear: () => void;
  isEmpty: () => boolean;
}

interface Props {
  onChange?: (isEmpty: boolean) => void;
  /** ひと筆書き終えるたびに現在の PNG data URL を返す。親側で state に保存する用途 */
  onEndStroke?: (dataUrl: string) => void;
  /** マウント時に描画する既存サイン画像（下書き再開用）。初回のみ反映 */
  initialDataUrl?: string;
  disabled?: boolean;
}

/** 白背景と重ねた PNG data URL を生成する（Storage に送るのと同じ形式） */
const canvasToPngDataUrl = (canvas: HTMLCanvasElement): string | null => {
  const out = document.createElement('canvas');
  out.width = canvas.width;
  out.height = canvas.height;
  const octx = out.getContext('2d');
  if (!octx) return null;
  octx.fillStyle = '#ffffff';
  octx.fillRect(0, 0, out.width, out.height);
  octx.drawImage(canvas, 0, 0);
  return out.toDataURL('image/png');
};

/** 指で描くサインパッド。CSS ピクセルと DPR を合わせて滑らかに描画 */
export const SignaturePad = forwardRef<SignaturePadHandle, Props>(
  ({ onChange, onEndStroke, initialDataUrl, disabled }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const drawingRef = useRef(false);
    const lastPtRef = useRef<{ x: number; y: number } | null>(null);
    const dirtyRef = useRef(false);
    const [empty, setEmpty] = useState(true);

    const resize = useCallback(() => {
      const canvas = canvasRef.current;
      const wrap = containerRef.current;
      if (!canvas || !wrap) return;
      const dpr = window.devicePixelRatio || 1;
      const rect = wrap.getBoundingClientRect();
      // 前の内容を保存
      const prev = canvas.toDataURL('image/png');
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.scale(dpr, dpr);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.lineWidth = 2.4;
      ctx.strokeStyle = '#0f172a';
      if (dirtyRef.current) {
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
        };
        img.src = prev;
      }
    }, []);

    useEffect(() => {
      resize();
      const onResize = () => resize();
      window.addEventListener('resize', onResize);
      return () => window.removeEventListener('resize', onResize);
    }, [resize]);

    // 下書きから復元されたサインを初回マウント時のみ canvas に描画。
    // resize() で canvas 寸法が確定した直後に走らせたいので次のマイクロタスクに回す
    const initialLoadedRef = useRef(false);
    useEffect(() => {
      if (initialLoadedRef.current || !initialDataUrl) return;
      initialLoadedRef.current = true;
      const t = window.setTimeout(() => {
        const canvas = canvasRef.current;
        const wrap = containerRef.current;
        if (!canvas || !wrap) return;
        const rect = wrap.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, rect.width, rect.height);
          dirtyRef.current = true;
          setEmpty(false);
          onChange?.(false);
        };
        img.src = initialDataUrl;
      }, 0);
      return () => window.clearTimeout(t);
      // 初回マウントのみ反映するため deps は空。後続の initialDataUrl 変更は無視
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const getPoint = (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return null;
      const rect = canvas.getBoundingClientRect();
      return {
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      };
    };

    const onDown = (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      e.preventDefault();
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.setPointerCapture(e.pointerId);
      drawingRef.current = true;
      lastPtRef.current = getPoint(e);
    };

    const onMove = (e: ReactPointerEvent<HTMLCanvasElement>) => {
      if (!drawingRef.current) return;
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!ctx || !canvas) return;
      const pt = getPoint(e);
      const last = lastPtRef.current;
      if (!pt || !last) return;
      ctx.beginPath();
      ctx.moveTo(last.x, last.y);
      ctx.lineTo(pt.x, pt.y);
      ctx.stroke();
      lastPtRef.current = pt;
      if (empty) {
        setEmpty(false);
        onChange?.(false);
      }
      dirtyRef.current = true;
    };

    const onUp = (e: ReactPointerEvent<HTMLCanvasElement>) => {
      const wasDrawing = drawingRef.current;
      drawingRef.current = false;
      lastPtRef.current = null;
      const canvas = canvasRef.current;
      if (canvas) {
        try {
          canvas.releasePointerCapture(e.pointerId);
        } catch {
          // ignore
        }
      }
      // ひと筆終わるたびに現在の内容を親へ渡す（親側でアンマウントに強い state に保存）
      if (wasDrawing && dirtyRef.current && canvas && onEndStroke) {
        const url = canvasToPngDataUrl(canvas);
        if (url) onEndStroke(url);
      }
    };

    const clear = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext('2d');
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      dirtyRef.current = false;
      if (!empty) {
        setEmpty(true);
        onChange?.(true);
      }
    }, [empty, onChange]);

    useImperativeHandle(
      ref,
      () => ({
        toDataUrl: () => {
          if (empty || !dirtyRef.current) return null;
          const canvas = canvasRef.current;
          if (!canvas) return null;
          return canvasToPngDataUrl(canvas);
        },
        clear,
        isEmpty: () => empty,
      }),
      [empty, clear],
    );

    return (
      <div ref={containerRef} className="relative h-40 w-full">
        <canvas
          ref={canvasRef}
          onPointerDown={onDown}
          onPointerMove={onMove}
          onPointerUp={onUp}
          onPointerCancel={onUp}
          className="h-full w-full touch-none rounded-xl border border-border bg-surface2"
          aria-label="サインパッド"
        />
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-[11px] text-text-muted">
            ここに指でサインしてください
          </div>
        )}
      </div>
    );
  },
);
SignaturePad.displayName = 'SignaturePad';
