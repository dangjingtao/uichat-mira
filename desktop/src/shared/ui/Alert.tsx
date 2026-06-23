import React from "react";
import {
  AlertCircle,
  CheckCircle2,
  Info,
  TriangleAlert,
  X,
} from "lucide-react";

export type AlertVariant = "info" | "success" | "warning" | "danger";

interface AlertProps extends Omit<React.HTMLAttributes<HTMLDivElement>, "title"> {
  variant?: AlertVariant;
  title?: React.ReactNode;
  children?: React.ReactNode;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  onClose?: () => void;
  closeAriaLabel?: string;
}

const alertVariantClassNames: Record<AlertVariant, string> = {
  info: "border-info-border bg-info-soft text-info-text",
  success: "border-success-border bg-success-soft text-success-text",
  warning: "border-warning-border bg-warning-soft text-warning-text",
  danger: "border-danger-border bg-danger-soft text-danger-text",
};

const alertIconClassNames: Record<AlertVariant, string> = {
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
};

const defaultIcons: Record<AlertVariant, React.ReactNode> = {
  info: <Info className="h-4 w-4" aria-hidden="true" />,
  success: <CheckCircle2 className="h-4 w-4" aria-hidden="true" />,
  warning: <TriangleAlert className="h-4 w-4" aria-hidden="true" />,
  danger: <AlertCircle className="h-4 w-4" aria-hidden="true" />,
};

export default function Alert({
  variant = "info",
  title,
  children,
  icon,
  action,
  onClose,
  closeAriaLabel = "Close alert",
  className = "",
  role,
  ...divProps
}: AlertProps) {
  const renderedIcon = icon === undefined ? defaultIcons[variant] : icon;
  const shouldRenderBody = title || children;

  return (
    <div
      role={role ?? (variant === "danger" || variant === "warning" ? "alert" : "status")}
      {...divProps}
      className={`flex gap-3 rounded-ui-panel border px-3.5 py-3 text-sm ${alertVariantClassNames[variant]} ${className}`}
    >
      {renderedIcon ? (
        <div
          className={`mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center ${alertIconClassNames[variant]}`}
        >
          {renderedIcon}
        </div>
      ) : null}

      {shouldRenderBody ? (
        <div className="min-w-0 flex-1 space-y-1">
          {title ? (
            <div className="font-medium leading-5 text-text-primary">{title}</div>
          ) : null}
          {children ? (
            <div className="leading-5 text-text-secondary">{children}</div>
          ) : null}
        </div>
      ) : null}

      {action ? <div className="flex flex-shrink-0 items-start">{action}</div> : null}

      {onClose ? (
        <button
          type="button"
          aria-label={closeAriaLabel}
          onClick={onClose}
          className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-ui-control border border-transparent text-icon-secondary transition-colors hover:bg-surface-primary/70 hover:text-icon-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        >
          <X className="h-4 w-4" aria-hidden="true" />
        </button>
      ) : null}
    </div>
  );
}
