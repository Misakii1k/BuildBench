import { House, ScrollText, Settings } from "lucide-react";
import type { AppTab } from "../types";

interface BottomNavProps {
  activeTab: AppTab;
  logCount: number;
  onChange: (tab: AppTab) => void;
}

const tabs = [
  { id: "home" as const, label: "控制台", icon: House },
  { id: "logs" as const, label: "日志", icon: ScrollText },
  { id: "settings" as const, label: "设置", icon: Settings },
];

export function BottomNav({ activeTab, logCount, onChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="主导航">
      {tabs.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          className={activeTab === id ? "nav-item active" : "nav-item"}
          type="button"
          aria-current={activeTab === id ? "page" : undefined}
          onClick={() => onChange(id)}
        >
          <span className="nav-icon-wrap">
            <Icon size={22} strokeWidth={2.1} aria-hidden="true" />
            {id === "logs" && logCount > 0 ? <i className="nav-dot" /> : null}
          </span>
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}

