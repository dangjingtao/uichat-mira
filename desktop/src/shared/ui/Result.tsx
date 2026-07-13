import type { HTMLAttributes, ReactNode } from "react";
import { Info } from "lucide-react";

export type ResultVariant = "info" | "success" | "warning" | "danger";
export type ResultType = "empty" | "content";
export type ResultSize = "sm" | "md" | "lg";

export interface ResultProps extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  type?: ResultType;
  variant?: ResultVariant;
  size?: ResultSize;
  title?: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  action?: ReactNode;
  children?: ReactNode;
}

const variantClasses: Record<ResultVariant, { background: string; icon: string }> = {
  info: { background: "bg-info-soft", icon: "text-info" },
  success: { background: "bg-success-soft", icon: "text-success" },
  warning: { background: "bg-warning-soft", icon: "text-warning" },
  danger: { background: "bg-danger-soft", icon: "text-danger" },
};

const sizeClasses: Record<ResultSize, { padding: string; badge: string; icon: string; title: string; description: string }> = {
  sm: {
    padding: "py-8 px-5",
    badge: "h-10 w-10",
    icon: "h-4 w-4",
    title: "text-sm",
    description: "text-xs",
  },
  md: {
    padding: "py-14 px-6",
    badge: "h-[52px] w-[52px]",
    icon: "h-5 w-5",
    title: "text-[15px]",
    description: "text-[13px]",
  },
  lg: {
    padding: "py-20 px-6",
    badge: "h-16 w-16",
    icon: "h-6 w-6",
    title: "text-base",
    description: "text-sm",
  },
};

export default function Result({
  type = "empty",
  variant = "info",
  size = "md",
  title,
  description,
  icon,
  action,
  children,
  className = "",
  ...sectionProps
}: ResultProps) {
  const hasContent = type === "content";
  const visual = sizeClasses[size];
  const colors = variantClasses[variant];

  return (
    <section
      {...sectionProps}
      className={`min-h-0 flex-1 ${className}`}
      aria-live={hasContent ? undefined : "polite"}
    >
      {hasContent ? (
        children
      ) : (
        <div className="flex min-h-full w-full items-center justify-center">
          <div
            role="status"
            className={`flex w-full max-w-md flex-col items-center justify-center text-center ${visual.padding}`}
          >
            <div className={`mb-4 flex shrink-0 items-center justify-center rounded-full ${visual.badge} ${colors.background} ${colors.icon}`}>
              {icon ?? <Info className={visual.icon} aria-hidden="true" />}
            </div>
            {title ? <h3 className={`${visual.title} font-semibold leading-6 text-text-primary`}>{title}</h3> : null}
            {description ? (
              <p className={`mt-2 max-w-[34ch] leading-relaxed ${visual.description} text-text-secondary`}>
                {description}
              </p>
            ) : null}
            {action ? <div className="mt-5 flex items-center justify-center">{action}</div> : null}
          </div>
        </div>
      )}
    </section>
  );
}
