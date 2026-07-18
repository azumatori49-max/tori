import type { AdminTab } from '../../types';

interface Props {
  tab: AdminTab;
  onChange: (tab: AdminTab) => void;
}

const ClipboardIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-6 w-6"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="5" y="4" width="14" height="17" rx="2" />
    <path d="M9 4.5V3.5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1" />
    <path d="M9 10h6" />
    <path d="M9 14h6" />
    <path d="M9 18h4" />
  </svg>
);

const StoreIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-6 w-6"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 10 5.5 4h13L20 10" />
    <path d="M4 10a2.6 2.6 0 0 0 5.2 0A2.6 2.6 0 0 0 14.4 10a2.6 2.6 0 0 0 5.2 0" />
    <path d="M5.5 12.5V20h13v-7.5" />
    <path d="M9.5 20v-5h5v5" />
  </svg>
);

const TagIcon = () => (
  <svg
    viewBox="0 0 24 24"
    className="h-6 w-6"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.8"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M4 13.5V5a1 1 0 0 1 1-1h8.5L21 11.5a1.4 1.4 0 0 1 0 2L15.5 19a1.4 1.4 0 0 1-2 0Z" transform="rotate(0)" />
    <circle cx="9" cy="9" r="1.4" fill="currentColor" stroke="none" />
  </svg>
);

const ITEMS: Array<{ key: AdminTab; icon: () => JSX.Element; label: string }> = [
  { key: 'dashboard', icon: ClipboardIcon, label: '提出確認' },
  { key: 'stores', icon: StoreIcon, label: '店舗管理' },
  { key: 'items', icon: TagIcon, label: '項目設定' },
];

export const AdminNav = ({ tab, onChange }: Props) => (
  <nav className="sticky bottom-0 z-30 border-t border-border bg-surface">
    <div className="mx-auto flex max-w-app">
      {ITEMS.map((item) => {
        const active = tab === item.key;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onChange(item.key)}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2.5 text-xs font-bold transition ${
              active ? 'text-accent' : 'text-text-muted'
            }`}
          >
            <Icon />
            <span>{item.label}</span>
          </button>
        );
      })}
    </div>
  </nav>
);
