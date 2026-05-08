import type { AdminTab } from '../../types';

interface Props {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
}

const TABS: { key: AdminTab; label: string; icon: string }[] = [
  { key: 'dashboard', label: '提出確認', icon: '📋' },
  { key: 'stores', label: '店舗管理', icon: '🏪' },
];

export const AdminNav = ({ active, onChange }: Props) => (
  <nav className="fixed bottom-0 inset-x-0 z-30 bg-surface border-t border-border">
    <div className="max-w-screen-sm mx-auto grid grid-cols-2">
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            type="button"
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`py-3 flex flex-col items-center gap-0.5 ${
              isActive ? 'text-accent' : 'text-text-muted'
            }`}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            <span className={`text-[11px] ${isActive ? 'font-bold' : ''}`}>{t.label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);
