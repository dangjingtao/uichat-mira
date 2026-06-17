import type { EvaluationJobStatus } from "@/features/Settings/pages/Evaluation/types";
import { useTranslation } from "react-i18next";

const statusMap: Record<EvaluationJobStatus | "saved", { key: string; className: string }> = {
  idle: {
    key: "settings.evaluation.status.idle",
    className: "border-border bg-surface-secondary text-text-secondary",
  },
  ready: {
    key: "settings.evaluation.status.ready",
    className: "border-primary/20 bg-primary/5 text-primary",
  },
  queued: {
    key: "settings.evaluation.status.queued",
    className: "border-warning/20 bg-warning/10 text-warning",
  },
  running: {
    key: "settings.evaluation.status.running",
    className: "border-warning/20 bg-warning/10 text-warning",
  },
  completed: {
    key: "settings.evaluation.status.completed",
    className: "border-success/20 bg-success/10 text-success",
  },
  failed: {
    key: "settings.evaluation.status.failed",
    className: "border-danger/20 bg-danger/10 text-danger",
  },
  saved: {
    key: "settings.evaluation.status.saved",
    className: "border-border bg-surface-secondary text-text-primary",
  },
};

export function StatusBadge({
  status,
}: {
  status: EvaluationJobStatus | "saved";
}) {
  const { t } = useTranslation();
  const current = statusMap[status];

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${current.className}`}
    >
      {t(current.key)}
    </span>
  );
}

export default StatusBadge;
