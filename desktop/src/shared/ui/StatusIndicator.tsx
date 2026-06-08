type StatusType = "running" | "stopped" | "unknown";

interface StatusIndicatorProps {
  status: StatusType;
  size?: "sm" | "md";
}

const statusConfig = {
  running: {
    color: "bg-success",
    ring: "ring-success/20",
    label: "运行中",
  },
  stopped: {
    color: "bg-danger",
    ring: "ring-danger/20",
    label: "已停止",
  },
  unknown: {
    color: "bg-warning",
    ring: "ring-warning/20",
    label: "处理中",
  },
};

export function StatusIndicator({ status, size = "md" }: StatusIndicatorProps) {
  const config = statusConfig[status];
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
