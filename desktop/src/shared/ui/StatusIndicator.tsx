import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";

type StatusType = "running" | "stopped" | "unknown";

interface StatusIndicatorProps {
  status: StatusType;
  size?: "sm" | "md";
}

const getStatusConfig = (t: TFunction) => ({
  running: {
    color: "bg-success",
    ring: "ring-success/20",
    label: t("ui.statusIndicator.running"),
  },
  stopped: {
    color: "bg-danger",
    ring: "ring-danger/20",
    label: t("ui.statusIndicator.stopped"),
  },
  unknown: {
    color: "bg-warning",
    ring: "ring-warning/20",
    label: t("ui.statusIndicator.unknown"),
  },
});

export function StatusIndicator({ status, size = "md" }: StatusIndicatorProps) {
  const { t } = useTranslation();
  const config = getStatusConfig(t)[status];
  const sizeClass = size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3";

  return (
    <span className="inline-flex items-center gap-2">
      <span
        className={`${sizeClass} rounded-full ${config.color} ring-4 ${config.ring}`}
      />
    </span>
  );
}

export default StatusIndicator;
