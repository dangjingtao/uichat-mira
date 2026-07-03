import React from "react";

export type BadgeVariant =
  | "neutral"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "muted";

export type BadgeSize = "sm" | "md";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  outline?: boolean;
  className?: string;
}

const badgeVariantClassNames: Record<BadgeVariant, string> = {
  neutral: "bg-surface-secondary text-text-secondary border-border",
  primary: "bg-primary/10 text-primary border-primary/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
  danger: "bg-danger/10 text-danger-text border-danger/20",
  muted: "bg-pampas-2 text-text-secondary border-cloudy-3",
};

const badgeSizeClassNames: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[11px]",
  md: "px-2.5 py-1 text-xs",
};

export default function Badge({
  children,
  variant = "neutral",
  size = "sm",
  outline = false,
  className = "",
}: BadgeProps) {
  const palette = badgeVariantClassNames[variant];

  return (
    <span
      className={`inline-flex items-center rounded-full font-medium ${outline ? "border" : "border-transparent"} ${badgeSizeClassNames[size]} ${palette} ${outline ? "bg-transparent" : ""} ${className}`}
    >
      {children}
    </span>
  );
}
