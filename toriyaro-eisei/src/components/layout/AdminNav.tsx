import type { AdminTab } from '../../types';

interface Props {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
}

const TABS: Array<{ key: AdminTab; label: string; icon: string }> = [
  { key: 'dashboard', label: '提出確認', icon: '📋' },
  { key: 'stores', label: '店舗管理', icon: '🏪' },
];

export const AdminNav = ({ active, onChange }: Props) => (
  <nav className="sticky bottom-0 z-30 bg-surface/95 backdrop-blur border-t border-border">
    <div className="grid grid-cols-2">
      {TABS.map((t) => {
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            className={`flex flex-col items-center justify-center gap-0.5 py-2.5 transition ${
              isActive ? 'text-accent' : 'text-text-muted hover:text-text'
            }`}
          >
            <span className="text-xl leading-none">{t.icon}</span>
            <span className="text-[11px] font-bold tracking-wider">{t.label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);
