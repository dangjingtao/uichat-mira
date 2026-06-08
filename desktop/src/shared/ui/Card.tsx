import React from "react";

interface CardProps {
  label?: React.ReactNode;
  value?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  interactive?: boolean;
  className?: string;
}

function Card({
  label,
  value,
  description,
  children,
  interactive = false,
  className = "",
}: CardProps) {
  return (
    <div
      className={`
        rounded-xl
        border border-border
        bg-surface-primary
        p-4
        shadow-shadow-sm
        transition-all
        duration-150
        ${interactive ? "hover:-translate-y-0.5 hover:shadow-shadow-md" : ""}
        ${className}
      `}
    >
      {children ? (
        children
      ) : (
        <div className="space-y-1.5">
          {label ? (
            <div className="text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
              {label}
            </div>
          ) : null}
          {value ? (
            <div className="text-base font-semibold text-text-primary">{value}</div>
          ) : null}
          {description ? (
            <div className="text-sm text-text-secondary">{description}</div>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default Card;
