import { ChevronRight, LoaderCircle, type LucideIcon } from "lucide-react";

interface ActionButtonProps {
  icon: LucideIcon;
  title: string;
  description: string;
  tone?: "android" | "harmony" | "neutral";
  disabled?: boolean;
  busy?: boolean;
  compact?: boolean;
  onClick: () => void;
}

export function ActionButton({
  icon: Icon,
  title,
  description,
  tone = "neutral",
  disabled = false,
  busy = false,
  compact = false,
  onClick,
}: ActionButtonProps) {
  return (
    <button
      className={`action-button action-${tone}${compact ? " action-compact" : ""}`}
      type="button"
      disabled={disabled}
      onClick={onClick}
    >
      <span className="action-icon" aria-hidden="true">
        <Icon size={compact ? 20 : 22} strokeWidth={2.1} />
      </span>
      <span className="action-copy">
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      {busy ? (
        <LoaderCircle className="spin action-tail" size={19} aria-label="正在提交" />
      ) : (
        <ChevronRight className="action-tail" size={19} aria-hidden="true" />
      )}
    </button>
  );
}

