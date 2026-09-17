import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FC,
} from 'react';
import { AppHeader } from '../layout/AppHeader';
import { SignaturePad, type SignaturePadHandle } from '../ui/SignaturePad';
import { SuccessOverlay } from '../ui/SuccessOverlay';
import {
  deleteReferralDraft,
  findDuplicate,
  generateDraftId,
  normalizeName,
  saveReferralDraft,
  submitReferral,
  useStoreDrafts,
} from '../../hooks/useReferrals';
import type {
  ReferralDraft,
  ReferralKind,
  ReferralRequest,
  StoreKey,
} from '../../types';

interface Props {
  storeKey: StoreKey;
  storeName: string;
  /** 差戻しからの再申請時に元の内容をプリセット（下書きピッカーはスキップ） */
  initial?: Partial<ReferralRequest> | null;
  onBack: () => void;
  onSubmitted: () => void;
}

type Step = 1 | 2 | 3;
type Phase = 'picker' | 'form';

const pad = (n: number) => String(n).padStart(2, '0');

const todayKey = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** 入社日 + 3ヶ月（月末調整あり） */
const plusThreeMonths = (isoDate: string): string => {
  if (!isoDate) return '';
  const [y, m, d] = isoDate.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  const target = new Date(base);
  target.setMonth(target.getMonth() + 3);
  return `${target.getFullYear()}-${pad(target.getMonth() + 1)}-${pad(target.getDate())}`;
};

const daysBetween = (fromIso: string, toIso: string): number | null => {
  if (!fromIso || !toIso) return null;
  const [fy, fm, fd] = fromIso.split('-').map(Number);
  const [ty, tm, td] = toIso.split('-').map(Number);
  const a = new Date(fy, fm - 1, fd).getTime();
  const b = new Date(ty, tm - 1, td).getTime();
  return Math.round((b - a) / 86_400_000);
};

const formatJa = (iso: string): string => {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${y}年${Number(m)}月${Number(d)}日`;
};

const formatIsoJa = (iso: string): string => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}/${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

const sigCount = (d: ReferralDraft): number =>
  (d.signatures?.manager ? 1 : 0) +
  (d.signatures?.referrer ? 1 : 0) +
  (d.signatures?.referred ? 1 : 0);

export const ReferralFormScreen: FC<Props> = ({
  storeKey,
  storeName,
  initial,
  onBack,
  onSubmitted,
}) => {
  const drafts = useStoreDrafts(storeKey);

  // 差戻しからの再申請: ピッカーはスキップして即フォーム。それ以外は
  // 下書き購読が終わってから phase を決める（下書きあり→picker / なし→form）
  const [phase, setPhase] = useState<Phase | null>(initial ? 'form' : null);
  const [draftId, setDraftId] = useState<string | null>(
    initial ? generateDraftId() : null,
  );

  const [step, setStep] = useState<Step>(1);
  const [kind, setKind] = useState<ReferralKind>(
    (initial?.kind as ReferralKind) ?? 'employee',
  );
  const [managerName, setManagerName] = useState(initial?.managerName ?? '');
  const [referrerName, setReferrerName] = useState(initial?.referrerName ?? '');
  const [referredName, setReferredName] = useState(initial?.referredName ?? '');
  const [hireDate, setHireDate] = useState(initial?.hireDate ?? '');
  const [thresholdDate, setThresholdDate] = useState(
    initial?.thresholdDate ?? '',
  );
  const [thresholdTouched, setThresholdTouched] = useState(
    !!initial?.thresholdDate,
  );

  const [managerSig, setManagerSig] = useState<string | null>(null);
  const [referrerSig, setReferrerSig] = useState<string | null>(null);
  const [referredSig, setReferredSig] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // 「下書きを保存しました」トースト
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<number | null>(null);
  const triggerSavedToast = useCallback(() => {
    setShowSaved(true);
    if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    savedTimerRef.current = window.setTimeout(() => setShowSaved(false), 2000);
  }, []);
  useEffect(
    () => () => {
      if (savedTimerRef.current) window.clearTimeout(savedTimerRef.current);
    },
    [],
  );

  // 下書きが読み終えたら phase を確定
  useEffect(() => {
    if (phase !== null) return;
    if (drafts === null) return;
    if (drafts.length > 0) {
      setPhase('picker');
    } else {
      setDraftId(generateDraftId());
      setPhase('form');
    }
  }, [phase, drafts]);

  const openDraft = useCallback((d: ReferralDraft) => {
    setDraftId(d.id);
    setKind(d.kind);
    setManagerName(d.managerName ?? '');
    setReferrerName(d.referrerName ?? '');
    setReferredName(d.referredName ?? '');
    setHireDate(d.hireDate ?? '');
    setThresholdDate(d.thresholdDate ?? '');
    setThresholdTouched(!!d.thresholdDate);
    setManagerSig(d.signatures?.manager?.dataUrl ?? null);
    setReferrerSig(d.signatures?.referrer?.dataUrl ?? null);
    setReferredSig(d.signatures?.referred?.dataUrl ?? null);
    setStep(1);
    setError(null);
    setPhase('form');
  }, []);

  const startNewDraft = useCallback(() => {
    setDraftId(generateDraftId());
    // 入力内容は既に空。既に何か入っていた場合はリセット
    setKind('employee');
    setManagerName('');
    setReferrerName('');
    setReferredName('');
    setHireDate('');
    setThresholdDate('');
    setThresholdTouched(false);
    setManagerSig(null);
    setReferrerSig(null);
    setReferredSig(null);
    setStep(1);
    setError(null);
    setPhase('form');
  }, []);

  const removeDraft = useCallback(
    async (d: ReferralDraft) => {
      const ok = window.confirm(
        `${d.referredName || '無題'}の下書きを削除しますか？（この操作は取り消せません）`,
      );
      if (!ok) return;
      try {
        await deleteReferralDraft(storeKey, d.id);
      } catch {
        /* silent */
      }
    },
    [storeKey],
  );

  // ---------- 自動保存: テキスト系フィールド（デバウンス 400ms） ----------
  const hasAnyTextContent =
    managerName.trim().length > 0 ||
    referrerName.trim().length > 0 ||
    referredName.trim().length > 0 ||
    hireDate.length > 0 ||
    thresholdDate.length > 0;

  useEffect(() => {
    if (phase !== 'form') return;
    if (!draftId) return;
    if (!hasAnyTextContent) return;
    const t = window.setTimeout(() => {
      saveReferralDraft(storeKey, draftId, {
        kind,
        managerName,
        referrerName,
        referredName,
        hireDate,
        thresholdDate,
      })
        .then(() => triggerSavedToast())
        .catch(() => {
          /* silent: 保存失敗はユーザーに強く警告しない（次回入力で再送される） */
        });
    }, 400);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    phase,
    draftId,
    storeKey,
    kind,
    managerName,
    referrerName,
    referredName,
    hireDate,
    thresholdDate,
    hasAnyTextContent,
  ]);

  // ---------- サイン: 書き終え/クリアの瞬間に個別保存 ----------
  const persistSignature = useCallback(
    (
      role: 'manager' | 'referrer' | 'referred',
      dataUrl: string | null,
    ) => {
      if (phase !== 'form' || !draftId) return;
      const value = dataUrl
        ? { dataUrl, signedAt: new Date().toISOString() }
        : null;
      saveReferralDraft(storeKey, draftId, { [`signatures/${role}`]: value })
        .then(() => triggerSavedToast())
        .catch(() => {
          /* silent */
        });
    },
    [phase, draftId, storeKey, triggerSavedToast],
  );

  const onCaptureManager = useCallback(
    (u: string | null) => {
      setManagerSig(u);
      persistSignature('manager', u);
    },
    [persistSignature],
  );
  const onCaptureReferrer = useCallback(
    (u: string | null) => {
      setReferrerSig(u);
      persistSignature('referrer', u);
    },
    [persistSignature],
  );
  const onCaptureReferred = useCallback(
    (u: string | null) => {
      setReferredSig(u);
      persistSignature('referred', u);
    },
    [persistSignature],
  );

  // ---------- STEP1 バリデーション ----------
  const autoThreshold = useMemo(
    () => (kind === 'employee' ? plusThreeMonths(hireDate) : ''),
    [kind, hireDate],
  );
  const effectiveThreshold =
    kind === 'employee' && !thresholdTouched
      ? autoThreshold
      : thresholdDate;
  const thresholdMismatch =
    kind === 'employee' &&
    thresholdTouched &&
    thresholdDate.length > 0 &&
    autoThreshold.length > 0 &&
    thresholdDate !== autoThreshold;
  const staffGap = useMemo(
    () => (kind === 'staff' ? daysBetween(hireDate, thresholdDate) : null),
    [kind, hireDate, thresholdDate],
  );

  const step1Errors: string[] = [];
  if (!managerName.trim()) step1Errors.push('店長名を入力してください');
  if (!referrerName.trim()) step1Errors.push('紹介者名を入力してください');
  if (!referredName.trim()) step1Errors.push('被紹介者名を入力してください');
  if (!hireDate) step1Errors.push('入社日を入力してください');
  if (!effectiveThreshold) step1Errors.push('達成日を入力してください');
  if (kind === 'staff' && staffGap !== null && staffGap < 0) {
    step1Errors.push('達成日は入社日より後の日付にしてください');
  }
  const staffTooEarlyWarn =
    kind === 'staff' && staffGap !== null && staffGap >= 0 && staffGap < 14;

  const canProceed1 = step1Errors.length === 0;
  const canProceed2 =
    !!managerSig && !!referrerSig && !!referredSig && !submitting;

  const proceedTo2 = () => {
    if (!canProceed1) return;
    if (kind === 'employee' && !thresholdTouched && autoThreshold) {
      setThresholdDate(autoThreshold);
    }
    setError(null);
    setStep(2);
  };

  const onSubmit = async () => {
    if (submitting) return;
    setError(null);

    if (!managerSig || !referrerSig || !referredSig) {
      setError('サインが3枚揃っていません。STEP2 に戻って確認してください。');
      return;
    }

    setSubmitting(true);
    try {
      const dup = await findDuplicate(normalizeName(referredName));
      if (dup) {
        const when = dup.appliedAt.slice(0, 10);
        setError(
          `この方はすでに申請済みです（${dup.storeName}・${when} 申請）。`,
        );
        setSubmitting(false);
        return;
      }
      const now = new Date().toISOString();
      await submitReferral({
        kind,
        storeKey,
        storeName,
        managerName: managerName.trim(),
        referrerName: referrerName.trim(),
        referredName: referredName.trim(),
        hireDate,
        thresholdDate: effectiveThreshold,
        signatures: {
          manager: { dataUrl: managerSig, signedAt: now },
          referrer: { dataUrl: referrerSig, signedAt: now },
          referred: { dataUrl: referredSig, signedAt: now },
        },
      });
      // 本申請成立後: 下書きを消す（失敗しても本申請は成立済み）
      if (draftId) {
        try {
          await deleteReferralDraft(storeKey, draftId);
        } catch {
          /* silent */
        }
      }
      setSuccess(true);
      window.setTimeout(() => {
        setSuccess(false);
        onSubmitted();
      }, 1400);
    } catch (err) {
      setError(
        '送信に失敗しました。通信状況を確認してもう一度お試しください。',
      );
      // eslint-disable-next-line no-console
      console.error('[referral submit failed]', (err as Error)?.message ?? '');
      setSubmitting(false);
    }
  };

  // ---------------- render ----------------

  const header = (
    <AppHeader
      title="紹介手当を申請する"
      subtitle={storeName}
      left={
        <button
          type="button"
          onClick={onBack}
          className="text-lg text-text-muted hover:text-accent"
          aria-label="戻る"
        >
          ←
        </button>
      }
    />
  );

  if (phase === null) {
    return (
      <div className="min-h-screen bg-bg">
        {header}
        <main className="mx-auto w-full max-w-app px-4 py-10 text-center text-xs text-text-muted">
          読み込み中…
        </main>
      </div>
    );
  }

  if (phase === 'picker') {
    return (
      <div className="min-h-screen bg-bg pb-24">
        {header}
        <main className="mx-auto w-full max-w-app px-4 py-5 space-y-4">
          <div className="rounded-2xl border border-accent/40 bg-surface p-4 shadow-sm">
            <h2 className="text-sm font-bold">作成中の申請があります</h2>
            <p className="mt-1 text-[11px] text-text-muted">
              以下は自動保存された下書きです。続きから入力するか、新しく作成できます。
            </p>
          </div>
          <ul className="space-y-2">
            {(drafts ?? []).map((d) => (
              <li
                key={d.id}
                className="rounded-2xl border border-border bg-surface p-4 shadow-sm"
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-bold">
                      {d.referredName || '（被紹介者名 未入力）'}
                    </div>
                    <div className="mt-0.5 text-[10px] text-text-muted">
                      {d.kind === 'employee'
                        ? '社員（3ヶ月）'
                        : 'スタッフ（50時間）'}
                      ・サイン {sigCount(d)}/3 枚・最終更新 {formatIsoJa(d.updatedAt)}
                    </div>
                  </div>
                </div>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => openDraft(d)}
                    className="flex-1 rounded-xl bg-accent py-2 text-xs font-bold text-white shadow-sm active:scale-[0.98]"
                  >
                    続きから
                  </button>
                  <button
                    type="button"
                    onClick={() => removeDraft(d)}
                    className="rounded-xl border border-ng bg-ng-bg px-4 py-2 text-xs font-bold text-ng"
                  >
                    削除
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={startNewDraft}
            className="w-full rounded-xl border-2 border-accent/60 bg-surface py-3 text-sm font-bold text-accent shadow-sm active:scale-[0.98]"
          >
            新規作成
          </button>
        </main>
      </div>
    );
  }

  // phase === 'form'
  return (
    <div className="min-h-screen bg-bg pb-24">
      {header}
      {showSaved && (
        <div
          className="pointer-events-none fixed left-1/2 top-14 z-40 -translate-x-1/2 rounded-full bg-ok-bg px-3 py-1 text-[11px] font-bold text-ok shadow-sm"
          aria-live="polite"
        >
          下書きを保存しました
        </div>
      )}
      <main className="mx-auto w-full max-w-app px-4 py-5 space-y-4">
        <div className="flex items-center justify-between text-[11px] font-bold text-text-muted">
          <StepChip label="STEP1 入力" active={step === 1} done={step > 1} />
          <StepChip label="STEP2 サイン" active={step === 2} done={step > 2} />
          <StepChip label="STEP3 確認" active={step === 3} done={false} />
        </div>

        {step === 1 && (
          <section className="space-y-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
            <div>
              <label className="mb-1 block text-xs font-bold text-text-muted">
                種別
              </label>
              <div className="grid grid-cols-2 gap-2">
                <KindOption
                  label="社員紹介手当"
                  sub="被紹介者が3ヶ月勤務を達成"
                  active={kind === 'employee'}
                  onClick={() => setKind('employee')}
                />
                <KindOption
                  label="スタッフ紹介手当"
                  sub="被紹介者が50時間勤務を達成"
                  active={kind === 'staff'}
                  onClick={() => setKind('staff')}
                />
              </div>
            </div>

            <TextField
              label="店長名"
              value={managerName}
              onChange={setManagerName}
              placeholder="例）山田 太郎"
            />
            <TextField
              label="紹介者名"
              value={referrerName}
              onChange={setReferrerName}
              placeholder="例）佐藤 花子"
            />
            <TextField
              label="被紹介者名"
              value={referredName}
              onChange={setReferredName}
              placeholder="例）鈴木 一郎"
            />

            <div>
              <label className="mb-1 block text-xs font-bold text-text-muted">
                入社日
              </label>
              <input
                type="date"
                value={hireDate}
                max={todayKey()}
                onChange={(e) => {
                  setHireDate(e.target.value);
                  if (kind === 'employee' && !thresholdTouched) {
                    setThresholdDate(plusThreeMonths(e.target.value));
                  }
                }}
                className="w-full rounded-xl border border-border bg-surface2 px-3 py-3 text-sm focus:border-accent focus:outline-none"
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-text-muted">
                {kind === 'employee' ? '3ヶ月達成日' : '50時間達成日'}
              </label>
              <input
                type="date"
                value={effectiveThreshold}
                onChange={(e) => {
                  setThresholdTouched(true);
                  setThresholdDate(e.target.value);
                }}
                className="w-full rounded-xl border border-border bg-surface2 px-3 py-3 text-sm focus:border-accent focus:outline-none"
              />
              {kind === 'employee' && autoThreshold && (
                <p className="mt-1 text-[10px] text-text-muted">
                  入社日 + 3ヶ月 = {formatJa(autoThreshold)}
                </p>
              )}
              {thresholdMismatch && (
                <p className="mt-1 rounded-lg bg-warn-bg px-2 py-1.5 text-[11px] font-bold text-warn">
                  自動計算（{formatJa(autoThreshold)}）とズレています。内容をご確認ください。
                </p>
              )}
              {staffTooEarlyWarn && (
                <p className="mt-1 rounded-lg bg-warn-bg px-2 py-1.5 text-[11px] font-bold text-warn">
                  入社から14日未満です。勤怠を再確認してください。
                </p>
              )}
            </div>

            {step1Errors.length > 0 && (
              <ul className="rounded-lg bg-ng-bg px-3 py-2 text-[11px] font-bold text-ng space-y-0.5">
                {step1Errors.map((e) => (
                  <li key={e}>・{e}</li>
                ))}
              </ul>
            )}

            <button
              type="button"
              onClick={proceedTo2}
              disabled={!canProceed1}
              className="w-full rounded-xl bg-accent py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-40"
            >
              次へ（サイン）
            </button>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-5">
            <div className="rounded-xl border border-accent/40 bg-accent/5 px-3 py-2 text-[11px] font-bold text-text leading-relaxed">
              全員が揃っていなくても大丈夫です。書ける方から順にサインしてください。
              途中の内容は自動保存されます。
            </div>

            <SignBlock
              title="① 店長のサイン"
              agreeName={managerName}
              savedDataUrl={managerSig}
              onCapture={onCaptureManager}
            />
            <SignBlock
              title="② 紹介者のサイン"
              agreeName={referrerName}
              savedDataUrl={referrerSig}
              onCapture={onCaptureReferrer}
            />
            <SignBlock
              title="③ 被紹介者のサイン"
              agreeName={referredName}
              savedDataUrl={referredSig}
              onCapture={onCaptureReferred}
            />

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 rounded-xl border border-border bg-surface py-3 text-sm font-bold text-text-muted"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={() => canProceed2 && setStep(3)}
                disabled={!canProceed2}
                className="flex-1 rounded-xl bg-accent py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-40"
              >
                次へ（確認）
              </button>
            </div>
            {!canProceed2 && (
              <p className="rounded-lg bg-warn-bg px-3 py-2 text-[11px] font-bold text-warn">
                3枚すべてサインしてから次に進めます。書ける人からで大丈夫です。
              </p>
            )}
          </section>
        )}

        {step === 3 && (
          <section className="space-y-4">
            <div className="space-y-2 rounded-2xl border border-border bg-surface p-4 shadow-sm text-xs">
              <Row k="店舗" v={storeName} />
              <Row
                k="種別"
                v={
                  kind === 'employee'
                    ? '社員紹介手当（3ヶ月勤務）'
                    : 'スタッフ紹介手当（50時間勤務）'
                }
              />
              <Row k="店長名" v={managerName} />
              <Row k="紹介者名" v={referrerName} />
              <Row k="被紹介者名" v={referredName} />
              <Row k="入社日" v={formatJa(hireDate)} />
              <Row
                k={kind === 'employee' ? '3ヶ月達成日' : '50時間達成日'}
                v={formatJa(effectiveThreshold)}
              />
            </div>

            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm space-y-3">
              <p className="text-[11px] font-bold text-text-muted">サイン（3枚）</p>
              <SignPreview
                label={`店長：${managerName}`}
                dataUrl={managerSig}
              />
              <SignPreview
                label={`紹介者：${referrerName}`}
                dataUrl={referrerSig}
              />
              <SignPreview
                label={`被紹介者：${referredName}`}
                dataUrl={referredSig}
              />
            </div>

            <div className="rounded-xl bg-warn-bg px-3 py-2 text-[11px] font-bold text-warn">
              送信後は修正できません。内容と3枚のサインをよく確認して送信してください。
            </div>

            {error && (
              <div className="rounded-xl bg-ng-bg px-3 py-2 text-[11px] font-bold text-ng">
                {error}
              </div>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setStep(2)}
                disabled={submitting}
                className="flex-1 rounded-xl border border-border bg-surface py-3 text-sm font-bold text-text-muted disabled:opacity-40"
              >
                戻る
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={submitting}
                className="flex-1 rounded-xl bg-accent py-3 text-sm font-bold text-white shadow-sm active:scale-[0.98] disabled:opacity-40"
              >
                {submitting ? '送信中…' : '申請を送信する'}
              </button>
            </div>
          </section>
        )}
      </main>
      <SuccessOverlay open={success} message="申請を送信しました" />
    </div>
  );
};

// -----------------------------
// 小さな部品
// -----------------------------

const StepChip: FC<{ label: string; active: boolean; done: boolean }> = ({
  label,
  active,
  done,
}) => (
  <span
    className={`flex-1 truncate rounded-full px-2 py-1 text-center text-[10px] font-bold transition ${
      active
        ? 'bg-accent text-white shadow-sm'
        : done
          ? 'bg-ok-bg text-ok'
          : 'bg-surface2 text-text-muted'
    } ${active ? '' : 'mx-1'}`}
  >
    {label}
  </span>
);

const KindOption: FC<{
  label: string;
  sub: string;
  active: boolean;
  onClick: () => void;
}> = ({ label, sub, active, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={`rounded-xl border-2 px-3 py-3 text-left transition ${
      active
        ? 'border-accent bg-accent/5'
        : 'border-border bg-surface hover:border-accent/50'
    }`}
  >
    <div className="text-sm font-bold">{label}</div>
    <div className="mt-0.5 text-[10px] text-text-muted">{sub}</div>
  </button>
);

const TextField: FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}> = ({ label, value, onChange, placeholder }) => (
  <div>
    <label className="mb-1 block text-xs font-bold text-text-muted">
      {label}
    </label>
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={60}
      className="w-full rounded-xl border border-border bg-surface2 px-3 py-3 text-sm focus:border-accent focus:outline-none"
      autoComplete="off"
    />
  </div>
);

/**
 * サイン1枚ぶんのブロック。
 * - Canvas への描画終了ごとに親の state (savedDataUrl) を更新する
 * - 下書きから復元した場合は SignaturePad が initialDataUrl を canvas に描き込むので、
 *   再訪時にも前回のサインが視認できる
 * - 「書き直す」で Canvas と親 state の両方をクリア
 */
const SignBlock: FC<{
  title: string;
  agreeName: string;
  savedDataUrl: string | null;
  onCapture: (dataUrl: string | null) => void;
}> = ({ title, agreeName, savedDataUrl, onCapture }) => {
  const padRef = useRef<SignaturePadHandle>(null);
  return (
    <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-1 text-[11px] text-text-muted">
        私は本申請の内容が事実であることを確認し、同意します。<br />
        氏名：{agreeName || '（STEP1 で入力してください）'}
      </p>
      <div className="mt-3">
        <SignaturePad
          ref={padRef}
          onEndStroke={(dataUrl) => onCapture(dataUrl)}
          initialDataUrl={savedDataUrl ?? undefined}
        />
      </div>
      <div className="mt-2 flex items-center justify-between gap-3">
        {savedDataUrl ? (
          <span className="rounded-full bg-ok-bg px-2 py-0.5 text-[10px] font-bold text-ok">
            ✓ サイン保存済み
          </span>
        ) : (
          <span className="text-[10px] text-text-muted">
            指でサインしてください
          </span>
        )}
        <button
          type="button"
          onClick={() => {
            padRef.current?.clear();
            onCapture(null);
          }}
          className="text-[11px] font-bold text-text-muted underline"
        >
          書き直す
        </button>
      </div>
    </div>
  );
};

const Row: FC<{ k: string; v: string }> = ({ k, v }) => (
  <div className="flex items-start justify-between gap-3">
    <span className="text-text-muted">{k}</span>
    <span className="text-right font-bold">{v}</span>
  </div>
);

const SignPreview: FC<{ label: string; dataUrl: string | null }> = ({
  label,
  dataUrl,
}) => (
  <div>
    <p className="mb-1 text-[10px] text-text-muted">{label}</p>
    {dataUrl ? (
      <img
        src={dataUrl}
        alt=""
        className="h-24 w-full rounded-lg border border-border bg-white object-contain"
      />
    ) : (
      <p className="rounded-lg bg-ng-bg px-2 py-2 text-[11px] font-bold text-ng">
        サインが未入力です。STEP2 に戻って書き直してください。
      </p>
    )}
  </div>
);
