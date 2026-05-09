import type { AdminTab } from "../../types";

interface Props {
  active: AdminTab;
  onChange: (t: AdminTab) => void;
}

const TABS: { key: AdminTab; label: string; icon: string }[] = [
  { key: "dashboard", label: "提出確認", icon: "📋" },
  { key: "stores", label: "店舗管理", icon: "🏪" },
];

export const AdminNav = ({ active, onChange }: Props) => (
  <nav className="sticky bottom-0 z-30 grid grid-cols-2 border-t border-border bg-surface/95 backdrop-blur">
    {TABS.map((t) => (
      <button
        key={t.key}
        type="button"
        onClick={() => onChange(t.key)}
        className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-bold ${
          active === t.key ? "text-accent" : "text-muted"
        }`}
      >
        <span className="text-lg">{t.icon}</span>
        {t.label}
      </button>
    ))}
  </nav>
);
