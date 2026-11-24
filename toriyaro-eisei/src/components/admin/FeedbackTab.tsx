import { useEffect, useState, type FC } from 'react';
import { confirmDialog, noticeDialog } from '../ui/ConfirmDialog';
import { onValue, ref, remove, set, update } from 'firebase/database';
import { db } from '../../lib/firebase';
import { Lightbox } from '../ui/Lightbox';
import { formatDateTimeJa } from '../../lib/dateUtils';
import type { Store, StoreKey } from '../../types';

interface FeedbackItem {
  id: string;
  storeKey?: string;
  message: string;
  createdAt: string;
  resolved?: boolean;
  reply?: string;
  repliedAt?: string;
  imageUrl?: string;
}

interface ErrorLogItem {
  id: string;
  storeKey?: string;
  storeName?: string;
  type?: string;
  dateOrWeekKey?: string;
  message?: string;
  uploaded?: number;
  total?: number;
  at?: string;
}

interface Props {
  stores: Record<StoreKey, Store>;
}

export const FeedbackTab: FC<Props> = ({ stores }) => {
  const [view, setView] = useState<'feedback' | 'errors'>('feedback');
  const [items, setItems] = useState<FeedbackItem[]>([]);
  const [errors, setErrors] = useState<ErrorLogItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    const unsub1 = onValue(ref(db, 'feedback'), (snap) => {
      const val = snap.val() as Record<string, Omit<FeedbackItem, 'id'>> | null;
      setItems(
        val
          ? Object.entries(val)
              .map(([id, v]) => ({ id, ...v }))
              .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
          : [],
      );
      setLoading(false);
    });
    const unsub2 = onValue(ref(db, 'errorLogs'), (snap) => {
      const val = snap.val() as Record<string, Omit<ErrorLogItem, 'id'>> | null;
      setErrors(
        val
          ? Object.entries(val)
              .map(([id, v]) => ({ id, ...v }))
              .sort((a, b) => (b.at || '').localeCompare(a.at || ''))
          : [],
      );
    });
    return () => {
      unsub1();
      unsub2();
    };
  }, []);

  const handleResolve = async (item: FeedbackItem) => {
    await set(ref(db, `feedback/${item.id}/resolved`), !item.resolved);
  };

  const handleDelete = async (item: FeedbackItem) => {
    const from = (item.storeKey && stores[item.storeKey]?.name) || '店舗不明';
    const ok = await confirmDialog({
      title: 'このご意見を削除しますか？',
      message: `${from} からのご意見（${formatDateTimeJa(item.createdAt)}）を削除します。返信も一緒に消え、店舗側の画面からも見えなくなります。元に戻せません。`,
      confirmLabel: '削除する',
      danger: true,
    });
    if (!ok) return;
    await remove(ref(db, `feedback/${item.id}`));
  };

  const handleDeleteError = async (item: ErrorLogItem) => {
    const ok = await confirmDialog({
      title: 'このエラーログを削除しますか？',
      message: '削除すると元に戻せません。',
      confirmLabel: '削除する',
      danger: true,
    });
    if (!ok) return;
    await remove(ref(db, `errorLogs/${item.id}`));
  };

  const handleSendReply = async (item: FeedbackItem) => {
    const text = (replyDrafts[item.id] ?? item.reply ?? '').trim();
    if (!text) return;
    setSavingId(item.id);
    try {
      await update(ref(db, `feedback/${item.id}`), {
        reply: text,
        repliedAt: new Date().toISOString(),
      });
      setReplyDrafts((prev) => {
        const next = { ...prev };
        delete next[item.id];
        return next;
      });
    } catch (err) {
      await noticeDialog({ title: '返信を送信できませんでした', message: err instanceof Error ? err.message : String(err) });
    } finally {
      setSavingId(null);
    }
  };

  const filtered = showResolved ? items : items.filter((i) => !i.resolved);
  const unresolvedCount = items.filter((i) => !i.resolved).length;

  return (
    <div className="space-y-3">
      <div className="flex rounded-2xl border border-border bg-surface p-1 shadow-sm">
        <button
          type="button"
          onClick={() => setView('feedback')}
          className={`min-h-[44px] flex-1 rounded-xl py-2 text-xs font-bold transition ${
            view === 'feedback' ? 'bg-text text-white shadow-sm' : 'text-text-muted'
          }`}
        >
          ご意見{unresolvedCount > 0 ? `（${unresolvedCount}）` : ''}
        </button>
        <button
          type="button"
          onClick={() => setView('errors')}
          className={`min-h-[44px] flex-1 rounded-xl py-2 text-xs font-bold transition ${
            view === 'errors' ? 'bg-text text-white shadow-sm' : 'text-text-muted'
          }`}
        >
          エラーログ{errors.length > 0 ? `（${errors.length}）` : ''}
        </button>
      </div>

      {view === 'errors' ? (
        errors.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            エラーログはありません
          </p>
        ) : (
          <div className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
            {errors.map((e) => (
              <div key={e.id} className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-bold">
                    {e.storeName || (e.storeKey && stores[e.storeKey]?.name) || '(不明)'}
                  </span>
                  <span className="text-text-muted">{e.at ? formatDateTimeJa(e.at) : ''}</span>
                </div>
                <p className="mt-1 text-xs text-text-muted">
                  {e.type === 'weekly' ? 'ウィークリー' : 'デイリー'} {e.dateOrWeekKey} ・ {e.uploaded ?? 0}/{e.total ?? 0}枚まで成功
                </p>
                <p className="mt-2 break-all rounded-lg bg-ng-bg px-3 py-2 text-xs text-ng">
                  {e.message}
                </p>
                <button
                  type="button"
                  onClick={() => handleDeleteError(e)}
                  className="mt-3 w-full rounded-lg border border-border bg-white py-2 text-xs font-bold text-text-muted"
                >
                  確認済みにして削除
                </button>
              </div>
            ))}
          </div>
        )
      ) : (
        <>
          <div className="flex items-center justify-end">
            <label className="flex min-h-[44px] cursor-pointer items-center gap-1.5 text-xs text-text-muted">
              <input
                type="checkbox"
                checked={showResolved}
                onChange={(e) => setShowResolved(e.target.checked)}
              />
              対応済みも表示
            </label>
          </div>

          {loading ? (
            <p className="py-8 text-center text-sm text-text-muted">読み込み中…</p>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-text-muted">
              {showResolved ? 'フィードバックはありません' : '未対応のフィードバックはありません'}
            </p>
          ) : (
            <div className="space-y-2 lg:grid lg:grid-cols-2 lg:items-start lg:gap-3 lg:space-y-0">
              {filtered.map((item) => {
                const storeName =
                  item.storeKey === '__admin__'
                    ? '(管理者)'
                    : item.storeKey && stores[item.storeKey]
                      ? stores[item.storeKey].name
                      : '(不明・未ログイン)';
                const draft = replyDrafts[item.id];
                const replyValue = draft !== undefined ? draft : item.reply ?? '';
                const isSaving = savingId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl border border-border p-4 shadow-sm ${
                      item.resolved ? 'bg-surface2 opacity-70' : 'bg-surface'
                    }`}
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold">{storeName}</span>
                      <span className="text-text-muted">
                        {item.createdAt ? formatDateTimeJa(item.createdAt) : ''}
                      </span>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm">{item.message}</p>
                    {item.imageUrl && (
                      <button
                        type="button"
                        onClick={() => setLightboxUrl(item.imageUrl!)}
                        className="mt-2 block"
                      >
                        <img
                          src={item.imageUrl}
                          alt=""
                          className="max-h-40 rounded-lg border border-border object-contain"
                          loading="lazy"
                        />
                      </button>
                    )}

                    <div className="mt-3 space-y-2">
                      <label className="block text-xs font-bold text-text-muted">
                        返信
                        {item.repliedAt && (
                          <span className="ml-2 font-normal">
                            ・最終送信: {formatDateTimeJa(item.repliedAt)}
                          </span>
                        )}
                      </label>
                      <textarea
                        value={replyValue}
                        onChange={(e) =>
                          setReplyDrafts((prev) => ({ ...prev, [item.id]: e.target.value }))
                        }
                        placeholder="店舗への返信を入力"
                        rows={2}
                        maxLength={2000}
                        className="w-full rounded-lg border border-border bg-bg p-2 text-xs focus:border-accent focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => handleSendReply(item)}
                        disabled={isSaving || !replyValue.trim()}
                        data-busy={isSaving ? '' : undefined}
                        className="min-h-[44px] w-full rounded-lg bg-accent py-2 text-xs font-bold text-white transition active:scale-[0.98]"
                      >
                        {isSaving ? '送信中…' : item.reply ? '返信を更新' : '返信を送信'}
                      </button>
                    </div>

                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleResolve(item)}
                        className="flex-1 rounded-lg border border-border bg-white py-2 text-xs font-bold text-text"
                      >
                        {item.resolved ? '未対応に戻す' : '対応済みにする'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(item)}
                        className="rounded-lg border border-ng/30 bg-white px-3 py-2 text-xs font-bold text-ng"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <Lightbox url={lightboxUrl} onClose={() => setLightboxUrl(null)} />
    </div>
  );
};