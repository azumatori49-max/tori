import type { AdminTab } from '../../types';

interface Props {
  tab: AdminTab;
  onChange: (tab: AdminTab) => void;
}

const ITEMS: Array<{ key: AdminTab; icon: string; label: string }> = [
  { key: 'dashboard', icon: '📋', label: '提出確認' },
  { key: 'stores', icon: '🏪', label: '店舗管理' },
];

export const AdminNav = ({ tab, onChange }: Props) => (
  <nav className="sticky bottom-0 z-30 border-t border-border bg-surface">
    <div className="mx-auto flex max-w-app">
      {ITEMS.map((item) => {
        const active = tab === item.key;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-bold transition ${
              active ? 'text-accent' : 'text-text-muted'
            }`}
          >
            <span className="text-xl">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);
