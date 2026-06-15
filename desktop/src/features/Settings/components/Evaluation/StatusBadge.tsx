import type { EvaluationJobStatus } from "@/features/Settings/pages/Evaluation/types";

const statusMap: Record<
  EvaluationJobStatus | "saved",
  { label: string; className: string }
> = {
  idle: {
    label: "未开始",
    className: "border-border bg-surface-secondary text-text-secondary",
  },
  ready: {
    label: "可运行",
    className: "border-primary/20 bg-primary/5 text-primary",
  },
  running: {
    label: "运行中",
    className: "border-warning/20 bg-warning/10 text-warning",
  },
  completed: {
    label: "已完成",
    className: "border-success/20 bg-success/10 text-success",
  },
  failed: {
    label: "部分失败",
    className: "border-danger/20 bg-danger/10 text-danger",
  },
  saved: {
    label: "已保存",
    className: "border-border bg-surface-secondary text-text-primary",
  },
};

export function StatusBadge({
  status,
}: {
  status: EvaluationJobStatus | "saved";
}) {
  const current = statusMap[status];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${current.className}`}
    >
      {current.label}
    </span>
  );
}

export default StatusBadge;
