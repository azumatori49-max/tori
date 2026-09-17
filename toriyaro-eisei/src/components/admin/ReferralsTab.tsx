import { useMemo, useState, type FC } from 'react';
import { Lightbox } from '../ui/Lightbox';
import {
  approveReferral,
  markReferralPaid,
  rejectReferral,
  useAllReferrals,
} from '../../hooks/useReferrals';
import type {
  ReferralChecklist,
  ReferralKind,
  ReferralRequest,
  ReferralStatus,
} from '../../types';

const STATUS_STYLE: Record<ReferralStatus, { label: string; cls: string }> = {
  pending: { label: '申請中', cls: 'bg-warn-bg text-warn' },
  approved: { label: '承認済み', cls: 'bg-ok-bg text-ok' },
  paid: { label: '支払済み', cls: 'bg-blue-50 text-blue-600' },
  rejected: { label: '差戻し', cls: 'bg-ng-bg text-ng' },
};

const KIND_LABEL: Record<ReferralKind, string> = {
  employee: '社員（3ヶ月）',
  staff: 'スタッフ（50時間）',
};

const pad = (n: number) => String(n).padStart(2, '0');

const formatIsoJa = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const formatDateJa = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${y}/${Number(m)}/${Number(d)}`;
};

/** 3ヶ月加算 */
const plusThreeMonths = (isoDate: string): string => {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  base.setMonth(base.getMonth() + 3);
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}`;
};

interface Props {
  // 現状 stores は使わないが、将来的な絞り込みに備え引数は受け取る
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _reserved?: never;
}

export const ReferralsTab: FC<Props> = () => {
  const { items, error } = useAllReferrals();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [monthKey, setMonthKey] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
  });
  const [copied, setCopied] = useState(false);

  const dupSet = useMemo(() => {
    if (!items) return new Set<string>();
    const nameCount = new Map<string, number>();
    for (const r of items) {
      if (r.status === 'rejected') continue;
      nameCount.set(
        r.normalizedReferredName,
        (nameCount.get(r.normalizedReferredName) ?? 0) + 1,
      );
    }
    const dups = new Set<string>();
    for (const [k, v] of nameCount) if (v > 1) dups.add(k);
    return dups;
  }, [items]);

  const selected = useMemo(
    () => (items ? items.find((r) => r.id === selectedId) ?? null : null),
    [items, selectedId],
  );

  const approvedInMonth = useMemo(() => {
    if (!items) return [];
    return items
      .filter((r) => r.status === 'approved' || r.status === 'paid')
      .filter((r) => (r.decidedAt ?? '').slice(0, 7) === monthKey)
      .sort((a, b) =>
        (a.storeName ?? '').localeCompare(b.storeName ?? '', 'ja'),
      );
  }, [items, monthKey]);

  const monthlyText = useMemo(() => {
    const [y, m] = monthKey.split('-').map(Number);
    const header = `【${y}年${m}月分 紹介手当 承認済み一覧】`;
    if (approvedInMonth.length === 0) {
      return `${header}\n（該当なし）`;
    }
    const rows = approvedInMonth.map((r) => {
      const decided = r.decidedAt?.slice(0, 10) ?? '';
      return `${r.storeName}\t${KIND_LABEL[r.kind]}\t紹介者:${r.referrerName}\t被紹介者:${r.referredName}\t入社:${r.hireDate}\t達成:${r.thresholdDate}\t承認:${decided}\t確認者:${r.decidedBy ?? ''}`;
    });
    return [header, `件数：${approvedInMonth.length}件`, '', ...rows].join('\n');
  }, [approvedInMonth, monthKey]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(monthlyText);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = monthlyText;
      ta.style.position = 'fixed';
      ta.style.top = '-1000px';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        setCopied(true);
        window.setTimeout(() => setCopied(false), 2000);
      } catch {
        // ignore
      }
      document.body.removeChild(ta);
    }
  };

  return (
    <section className="space-y-4">
      {/* 月次出力 */}
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-xs font-bold">月次出力（承認済み一覧）</h2>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="month"
            value={monthKey}
            onChange={(e) => setMonthKey(e.target.value)}
            className="rounded-lg border border-border bg-surface2 px-3 py-2 text-sm"
          />
          <button
            type="button"
            onClick={onCopy}
            disabled={approvedInMonth.length === 0}
            className="flex-1 rounded-xl bg-accent py-2.5 text-sm font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-40"
          >
            テキストをコピー
          </button>
          {copied && (
            <span className="rounded-full bg-ok-bg px-2 py-1 text-[10px] font-bold text-ok">
              コピーしました
            </span>
          )}
        </div>
        <textarea
          readOnly
          value={monthlyText}
          className="mt-2 h-40 w-full resize-y rounded-lg border border-border bg-surface2 p-2 text-[11px] leading-relaxed"
        />
      </div>

      {/* 一覧 */}
      <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
        <h2 className="text-xs font-bold">紹介手当 申請一覧（新しい順）</h2>
        {error && (
          <p className="mt-2 rounded-lg bg-ng-bg px-2 py-1.5 text-[11px] font-bold text-ng">
            {error}
          </p>
        )}
        {items === null ? (
          <p className="mt-3 text-xs text-text-muted">読み込み中…</p>
        ) : items.length === 0 ? (
          <p className="mt-3 text-xs text-text-muted">申請はまだありません</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {items.map((r) => {
              const style = STATUS_STYLE[r.status];
              const isDup = dupSet.has(r.normalizedReferredName);
              return (
                <li key={r.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(r.id)}
                    className="w-full rounded-xl border border-border bg-surface2 px-3 py-2.5 text-left transition active:scale-[0.99]"
                  >
                    {isDup && (
                      <div className="mb-1 rounded-md bg-ng px-2 py-0.5 text-[10px] font-bold text-white">
                        重複候補（同名の申請あり）
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-xs font-bold">
                          {r.referredName}
                          <span className="ml-2 text-[10px] font-normal text-text-muted">
                            {r.storeName}
                          </span>
                        </div>
                        <div className="mt-0.5 text-[10px] text-text-muted">
                          {KIND_LABEL[r.kind]}・{formatIsoJa(r.appliedAt)}
                        </div>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${style.cls}`}
                      >
                        {style.label}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {selected && (
        <ReferralDetailModal
          req={selected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </section>
  );
};

// ============================================================
// 詳細モーダル
// ============================================================

const ReferralDetailModal: FC<{
  req: ReferralRequest;
  onClose: () => void;
}> = ({ req, onClose }) => {
  const [checklist, setChecklist] = useState<ReferralChecklist>(
    req.checklist ?? { enrolled: false, hireDate: false, threshold: false },
  );
  const [decidedBy, setDecidedBy] = useState(req.decidedBy ?? '');
  const [rejectReason, setRejectReason] = useState(req.rejectReason ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const allChecked =
    checklist.enrolled && checklist.hireDate && checklist.threshold;
  const canApprove =
    !busy && allChecked && decidedBy.trim().length > 0 && req.status === 'pending';
  const canReject =
    !busy && rejectReason.trim().length > 0 && req.status === 'pending';
  const canMarkPaid = !busy && req.status === 'approved';

  const autoThreshold =
    req.kind === 'employee' ? plusThreeMonths(req.hireDate) : '';
  const thresholdMismatch =
    req.kind === 'employee' && autoThreshold && autoThreshold !== req.thresholdDate;

  const onApprove = async () => {
    if (!canApprove) return;
    setBusy(true);
    setError(null);
    try {
      await approveReferral(req.id, decidedBy.trim(), checklist);
      onClose();
    } catch (e) {
      setError('承認に失敗しました。通信状況を確認してください。');
      // eslint-disable-next-line no-console
      console.error('[referral approve failed]', (e as Error)?.message ?? '');
      setBusy(false);
    }
  };
  const onReject = async () => {
    if (!canReject) return;
    setBusy(true);
    setError(null);
    try {
      await rejectReferral(
        req.id,
        decidedBy.trim() || '管理者',
        rejectReason.trim(),
      );
      onClose();
    } catch (e) {
      setError('差戻しに失敗しました。');
      // eslint-disable-next-line no-console
      console.error('[referral reject failed]', (e as Error)?.message ?? '');
      setBusy(false);
    }
  };
  const onPaid = async () => {
    if (!canMarkPaid) return;
    setBusy(true);
    setError(null);
    try {
      await markReferralPaid(req.id);
      onClose();
    } catch (e) {
      setError('支払済みへの更新に失敗しました。');
      // eslint-disable-next-line no-console
      console.error('[referral paid failed]', (e as Error)?.message ?? '');
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-3 animate-fadeIn">
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-surface shadow-lg">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-surface/95 px-5 py-3 backdrop-blur">
          <h3 className="text-sm font-bold">申請詳細</h3>
          <button
            type="button"
            onClick={onClose}
            className="text-xl text-text-muted"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>
        <div className="space-y-3 px-5 py-4 text-xs">
          <span
            className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold ${
              STATUS_STYLE[req.status].cls
            }`}
          >
            {STATUS_STYLE[req.status].label}
          </span>

          <div className="space-y-1">
            <DetailRow k="店舗" v={req.storeName} />
            <DetailRow k="種別" v={KIND_LABEL[req.kind]} />
            <DetailRow k="店長" v={req.managerName} />
            <DetailRow k="紹介者" v={req.referrerName} />
            <DetailRow k="被紹介者" v={req.referredName} />
            <DetailRow k="入社日" v={formatDateJa(req.hireDate)} />
            <DetailRow
              k={req.kind === 'employee' ? '3ヶ月達成日' : '50時間達成日'}
              v={formatDateJa(req.thresholdDate)}
            />
            <DetailRow k="申請日時" v={formatIsoJa(req.appliedAt)} />
            {req.decidedAt && (
              <DetailRow k="決裁日時" v={formatIsoJa(req.decidedAt)} />
            )}
            {req.decidedBy && <DetailRow k="確認者" v={req.decidedBy} />}
            {req.paidAt && (
              <DetailRow k="支払日時" v={formatIsoJa(req.paidAt)} />
            )}
          </div>

          {thresholdMismatch && (
            <div className="rounded-lg bg-warn-bg px-2 py-1.5 text-[11px] font-bold text-warn">
              入社日+3ヶ月（{formatDateJa(autoThreshold)}）と達成日がズレています。
            </div>
          )}
          {req.status === 'rejected' && req.rejectReason && (
            <div className="rounded-lg bg-ng-bg px-2 py-1.5 text-[11px] font-bold text-ng">
              差戻し理由：{req.rejectReason}
            </div>
          )}

          <div>
            <p className="mb-1 text-[11px] font-bold text-text-muted">
              サイン画像（タップで拡大）
            </p>
            <div className="grid grid-cols-3 gap-2">
              <SigThumb
                label="店長"
                name={req.managerName}
                url={req.signatures?.manager?.imageUrl}
                onOpen={() => setLightbox(req.signatures?.manager?.imageUrl ?? null)}
              />
              <SigThumb
                label="紹介者"
                name={req.referrerName}
                url={req.signatures?.referrer?.imageUrl}
                onOpen={() => setLightbox(req.signatures?.referrer?.imageUrl ?? null)}
              />
              <SigThumb
                label="被紹介者"
                name={req.referredName}
                url={req.signatures?.referred?.imageUrl}
                onOpen={() => setLightbox(req.signatures?.referred?.imageUrl ?? null)}
              />
            </div>
          </div>

          {req.status === 'pending' && (
            <>
              <div className="rounded-xl border border-border bg-surface2 p-3 space-y-2">
                <p className="text-[11px] font-bold">
                  勤怠での確認チェックリスト
                </p>
                <CheckRow
                  label="勤怠記録で被紹介者の在籍を確認した"
                  checked={checklist.enrolled}
                  onChange={(v) =>
                    setChecklist((c) => ({ ...c, enrolled: v }))
                  }
                />
                <CheckRow
                  label="入社日が申請と一致することを確認した"
                  checked={checklist.hireDate}
                  onChange={(v) =>
                    setChecklist((c) => ({ ...c, hireDate: v }))
                  }
                />
                <CheckRow
                  label={
                    req.kind === 'employee'
                      ? '3ヶ月勤務の達成を勤怠で確認した'
                      : '50時間勤務の達成を勤怠で確認した'
                  }
                  checked={checklist.threshold}
                  onChange={(v) =>
                    setChecklist((c) => ({ ...c, threshold: v }))
                  }
                />
                <div>
                  <label className="mb-1 block text-[11px] font-bold text-text-muted">
                    確認者名（必須）
                  </label>
                  <input
                    type="text"
                    value={decidedBy}
                    onChange={(e) => setDecidedBy(e.target.value)}
                    placeholder="例）本部 田中"
                    className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm"
                    autoComplete="off"
                    maxLength={40}
                  />
                </div>
                <button
                  type="button"
                  onClick={onApprove}
                  disabled={!canApprove}
                  className="w-full rounded-xl bg-accent py-2.5 text-sm font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-40"
                >
                  承認する
                </button>
              </div>

              <div className="rounded-xl border border-border bg-surface2 p-3 space-y-2">
                <p className="text-[11px] font-bold">差戻し</p>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="差戻し理由を入力（申請者に表示されます）"
                  className="h-20 w-full resize-y rounded-lg border border-border bg-surface p-2 text-xs"
                  maxLength={200}
                />
                <button
                  type="button"
                  onClick={onReject}
                  disabled={!canReject}
                  className="w-full rounded-xl border border-ng bg-ng-bg py-2.5 text-sm font-bold text-ng active:scale-[0.98] disabled:opacity-40"
                >
                  差戻す
                </button>
              </div>
            </>
          )}

          {req.status === 'approved' && (
            <button
              type="button"
              onClick={onPaid}
              disabled={!canMarkPaid}
              className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-40"
            >
              支払済みにする
            </button>
          )}

          {error && (
            <p className="rounded-lg bg-ng-bg px-3 py-2 text-[11px] font-bold text-ng">
              {error}
            </p>
          )}
        </div>
      </div>
      <Lightbox url={lightbox} onClose={() => setLightbox(null)} />
    </div>
  );
};

const DetailRow: FC<{ k: string; v: string }> = ({ k, v }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="shrink-0 text-text-muted">{k}</span>
    <span className="min-w-0 text-right font-bold break-words">{v || '—'}</span>
  </div>
);

const CheckRow: FC<{
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <label className="flex items-start gap-2 text-[11px]">
    <input
      type="checkbox"
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      className="mt-0.5"
    />
    <span>{label}</span>
  </label>
);

const SigThumb: FC<{
  label: string;
  name: string;
  url?: string;
  onOpen: () => void;
}> = ({ label, name, url, onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    disabled={!url}
    className="flex flex-col overflow-hidden rounded-lg border border-border bg-white text-left disabled:opacity-40"
  >
    <div className="aspect-[3/2] w-full">
      {url ? (
        <img src={url} alt="" className="h-full w-full object-contain" />
      ) : (
        <div className="flex h-full items-center justify-center text-[10px] text-text-muted">
          （画像なし）
        </div>
      )}
    </div>
    <div className="border-t border-border px-1.5 py-1 text-[9px]">
      <div className="text-text-muted">{label}</div>
      <div className="truncate font-bold">{name}</div>
    </div>
  </button>
);
