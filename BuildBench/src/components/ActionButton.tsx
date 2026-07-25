import type { ReactNode } from "react";
import { ChevronRight } from "lucide-react";

export function ActionButton({
  className = "",
  icon,
  title,
  description,
  disabled,
  onClick,
}: {
  className?: string;
  icon: ReactNode;
  title: string;
  description: string;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button className={`action-button ${className}`} disabled={disabled} onClick={onClick}>
      <i className="action-icon">{icon}</i>
      <span>
        <strong>{title}</strong>
        <small>{description}</small>
      </span>
      <ChevronRight className="chevron" size={20} />
    </button>
  );
}
