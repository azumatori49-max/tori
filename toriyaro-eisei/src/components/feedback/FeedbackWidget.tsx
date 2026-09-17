import { useEffect, useMemo, useRef, useState, type FC } from 'react';
import { onValue, push, ref, set } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { db, storage } from '../../lib/firebase';
import { useAuth } from '../../hooks/useAuth';
import { formatDateTimeJa } from '../../lib/dateUtils';

interface FeedbackItem {
  id: string;
  storeKey?: string;
  message: string;
  createdAt: string;
  reply?: string;
  repliedAt?: string;
  imageUrl?: string;
}

const READ_KEY = 'feedback_read_v1';

const getReadIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(READ_KEY);
    return new Set<string>(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set<string>();
  }
};

const saveReadIds = (ids: Set<string>) => {
  try {
    localStorage.setItem(READ_KEY, JSON.stringify([...ids]));
  } catch {}
};

export const FeedbackWidget: FC<{ alignRight?: boolean }> = ({ alignRight = false }) => {
  const { auth } = useAuth();
  const myKey = auth.storeKey || '';
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(getReadIds);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!myKey) {
      setItems([]);
      return;
    }
    const unsub = onValue(ref(db, 'feedback'), (snap) => {
      const val = snap.val() as Record<string, Omit<FeedbackItem, 'id'>> | null;
      if (!val) {
        setItems([]);
        return;
      }
      const mine = Object.entries(val)
        .filter(([, v]) => v.storeKey === myKey)
        .map(([id, v]) => ({ id, ...v }))
        .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
      setItems(mine);
    });
    return () => unsub();
  }, [myKey]);

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  const unreadCount = useMemo(
    () => items.filter((i) => i.reply && !readIds.has(i.id)).length,
    [items, readIds],
  );

  const handleOpen = () => {
    setOpen(true);
    const repliedIds = items.filter((i) => i.reply).map((i) => i.id);
    if (repliedIds.length > 0) {
      const next = new Set(readIds);
      repliedIds.forEach((id) => next.add(id));
      saveReadIds(next);
      setReadIds(next);
    }
  };

  const handleSubmit = async () => {
    const msg = message.trim();
    if (!msg && !image) return;
    setSubmitting(true);
    try {
      let imageUrl = '';
      if (image) {
        if (image.size > 4_500_000) {
          throw new Error('画像が大きすぎます（5MB以内）');
        }
        const path = `feedback/${myKey || 'unknown'}/${Date.now()}.jpg`;
        const r0 = storageRef(storage, path);
        await uploadBytes(r0, image, {
          contentType: image.type.startsWith('image/') ? image.type : 'image/jpeg',
        });
        imageUrl = await getDownloadURL(r0);
      }
      const r = push(ref(db, 'feedback'));
      const payload: Record<string, unknown> = {
        storeKey: myKey,
        message: msg || '（スクリーンショットのみ）',
        createdAt: new Date().toISOString(),
      };
      if (imageUrl) payload.imageUrl = imageUrl;
      await set(r, payload);
      setDone(true);
      setMessage('');
      setImage(null);
      setTimeout(() => setDone(false), 1500);
    } catch (err) {
      alert('送信失敗: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleOpen}
                        className={`fixed top-3 z-50 inline-flex h-8 items-center justify-center rounded-full border border-border bg-white px-3 text-xs font-bold text-text-muted shadow-sm hover:bg-surface2 ${alignRight ? 'right-3' : 'left-3'}`}
        aria-label="フィードバック"
        title="不具合・要望を送信"
      >
        ご意見
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-[16px] items-center justify-center rounded-full bg-ng px-1 text-[10px] font-bold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[60]">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute left-1/2 top-1/2 max-h-[85vh] w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-2xl bg-surface p-4 shadow-2xl">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-bold">フィードバック・不具合報告</h3>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-2xl text-text-muted"
                aria-label="閉じる"
              >
                ×
              </button>
            </div>

            {items.length > 0 && (
              <div className="mb-4 space-y-2">
                <h4 className="text-xs font-bold text-text-muted">過去の報告</h4>
                {items.map((item) => (
                  <div key={item.id} className="rounded-lg border border-border bg-bg p-3">
                    <p className="text-[10px] text-text-muted">
                      {item.createdAt ? formatDateTimeJa(item.createdAt) : ''}
                    </p>
                    <p className="mt-1 whitespace-pre-wrap text-xs">{item.message}</p>
                    {item.imageUrl && (
                      <img
                        src={item.imageUrl}
                        alt=""
                        className="mt-2 max-h-32 rounded-md border border-border object-contain"
                        loading="lazy"
                      />
                    )}
                    {item.reply ? (
                      <div className="mt-2 rounded-md bg-accent/10 p-2">
                        <p className="text-[10px] font-bold text-accent">管理者からの返信</p>
                        <p className="mt-0.5 whitespace-pre-wrap text-xs">{item.reply}</p>
                        {item.repliedAt && (
                          <p className="mt-1 text-[10px] text-text-muted">
                            {formatDateTimeJa(item.repliedAt)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="mt-2 text-[10px] text-text-muted">返信待ち</p>
                    )}
                  </div>
                ))}
                <hr className="my-3 border-border" />
              </div>
            )}

            <h4 className="mb-2 text-xs font-bold text-text-muted">新しい報告</h4>

            {done ? (
              <div className="rounded-lg bg-ok-bg px-3 py-4 text-center text-sm font-bold text-ok">
                送信しました。ありがとうございます！
              </div>
            ) : (
              <>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="不具合の内容や、こうして欲しい等を自由に記入してください"
                  rows={4}
                  maxLength={2000}
                  className="w-full rounded-lg border border-border bg-bg p-2 text-sm focus:border-accent focus:outline-none"
                />
                <p className="mt-1 text-right text-[10px] text-text-muted">
                  {message.length} / 2000
                </p>

                {preview ? (
                  <div className="relative mt-1">
                    <img
                      src={preview}
                      alt=""
                      className="max-h-40 rounded-lg border border-border object-contain"
                    />
                    <button
                      type="button"
                      onClick={() => setImage(null)}
                      className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-ng text-white shadow"
                      aria-label="画像を削除"
                    >
                      ×
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileRef.current?.click()}
                    className="mt-1 w-full rounded-lg border border-dashed border-border bg-bg py-2.5 text-xs font-bold text-text-muted"
                  >
                    ＋ スクリーンショットを添付（任意）
                  </button>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) setImage(f);
                    e.target.value = '';
                  }}
                />

                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={submitting || (!message.trim() && !image)}
                  className="mt-3 w-full rounded-lg bg-accent py-2.5 text-sm font-bold text-white transition active:scale-[0.98] disabled:bg-text-muted/40 disabled:text-white"
                >
                  {submitting ? '送信中…' : '送信'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
};