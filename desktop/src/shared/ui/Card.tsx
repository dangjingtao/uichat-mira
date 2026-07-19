import React from "react";

export type CardVariant = "default" | "subtle" | "dashed" | "ghost";
export type CardPadding = "none" | "sm" | "md" | "lg";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  label?: React.ReactNode;
  value?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  interactive?: boolean;
  variant?: CardVariant;
  padding?: CardPadding;
  className?: string;
}

const cardVariantClassNames: Record<CardVariant, string> = {
  default: "border border-border bg-surface-primary shadow-shadow-sm",
  subtle: "border border-border bg-surface-secondary shadow-none",
  dashed: "border border-dashed border-border bg-surface-secondary shadow-none",
  ghost: "border-0 bg-transparent shadow-none",
};

const cardPaddingClassNames: Record<CardPadding, string> = {
  none: "p-0",
  sm: "p-3",
  md: "p-4",
  lg: "p-5",
};

function Card({
  label,
  value,
  description,
  children,
  interactive = false,
  variant = "default",
  padding = "md",
  className = "",
  ...divProps
}: CardProps) {
  return (
    <div
      {...divProps}
      className={`
        rounded-ui-panel
        ${cardVariantClassNames[variant]}
        ${cardPaddingClassNames[padding]}
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
            <div className="text-base font-semibold text-text-primary">
              {value}
            </div>
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
