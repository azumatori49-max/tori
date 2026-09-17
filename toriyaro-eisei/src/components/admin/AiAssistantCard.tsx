import type { FC } from 'react';

/**
 * 管理者用: 連携済み Claude AI のチャットタブを新しいウィンドウで開く導線カード。
 * このカードは AdminScreen 内でのみレンダーされる（店舗トップ・閲覧モードには出さない）。
 */
export const AiAssistantCard: FC = () => {
  const openAssistant = () => {
    window.open('https://claude.ai/new', '_blank', 'noopener');
  };

  return (
    <div className="mb-4 rounded-2xl border border-border bg-surface p-4 shadow-sm">
      <button
        type="button"
        onClick={openAssistant}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="text-xs font-bold">AIアシスタントに聞く</span>
        <span className="text-text-muted">→</span>
      </button>
      <p className="mt-1 text-[11px] text-text-muted">
        提出状況や未提出集計をAIに質問できます（連携設定済みの端末のみ）。
      </p>
    </div>
  );
};
