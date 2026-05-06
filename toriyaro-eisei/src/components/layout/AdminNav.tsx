import type { ReactNode } from 'react';
import type { AdminTab } from '../../types';

interface Props {
  active: AdminTab;
  onChange: (tab: AdminTab) => void;
}

const ClipboardIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <rect x="6" y="4" width="12" height="17" rx="2" />
    <path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    <path d="M9 11h6M9 15h6" />
  </svg>
);

const StoreIcon = () => (
  <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 9l1.2-4h13.6L20 9" />
    <path d="M4 9v11h16V9" />
    <path d="M4 9c0 1.7 1.3 3 3 3s3-1.3 3-3 1.3 3 3 3 3-1.3 3-3 1.3 3 3 3 3-1.3 3-3" />
    <path d="M10 20v-6h4v6" />
  </svg>
);

const TABS: Array<{ key: AdminTab; label: string; icon: ReactNode }> = [
  { key: 'dashboard', label: '提出確認', icon: <ClipboardIcon /> },
  { key: 'stores', label: '店舗管理', icon: <StoreIcon /> },
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
            className={`flex flex-col items-center justify-center gap-1 py-2.5 transition ${
              isActive ? 'text-accent' : 'text-text-muted hover:text-text'
            }`}
          >
            {t.icon}
            <span className="text-[11px] font-bold tracking-wider">{t.label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);
