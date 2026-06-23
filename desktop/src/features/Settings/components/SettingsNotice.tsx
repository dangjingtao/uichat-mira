import React from "react";
import { AlertCircle, CheckCircle2, Info, TriangleAlert } from "lucide-react";
import Card from "@/shared/ui/Card";

type SettingsNoticeTone = "danger" | "success" | "warning" | "info";

const toneClassNames: Record<SettingsNoticeTone, string> = {
  danger: "border-danger-border bg-danger-soft text-danger-text",
  success: "border-success-border bg-success-soft text-success-text",
  warning: "border-warning-border bg-warning-soft text-warning-text",
  info: "border-info-border bg-info-soft text-info-text",
};

const toneIcons: Record<
  SettingsNoticeTone,
  React.ComponentType<{ className?: string }>
> = {
  danger: AlertCircle,
  success: CheckCircle2,
  warning: TriangleAlert,
  info: Info,
};

interface SettingsNoticeProps {
  children: React.ReactNode;
  tone?: SettingsNoticeTone;
  icon?: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
}

const sizeClassNames = {
  sm: "px-3 py-2 text-xs",
  md: "px-4 py-3 text-sm",
} as const;

export default function SettingsNotice({
  children,
  tone = "info",
  icon,
  size = "md",
  className = "",
}: SettingsNoticeProps) {
  const ToneIcon = toneIcons[tone];

  return (
    <Card
      className={`flex items-start gap-3 ${sizeClassNames[size]} ${toneClassNames[tone]} ${className}`}
    >
      <div className="mt-0.5 shrink-0">
        {icon ?? <ToneIcon className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">{children}</div>
    </Card>
  );
}
