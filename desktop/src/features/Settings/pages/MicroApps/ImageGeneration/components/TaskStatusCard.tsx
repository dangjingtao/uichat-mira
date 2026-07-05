import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import type { StudioTaskStatus } from "../model/view-model";
import { taskStatusOrder } from "../model/view-model";

interface TaskStatusCardProps {
  taskStatus: StudioTaskStatus | null;
}

const statusTone = (status: StudioTaskStatus, active: boolean) => {
  if (!active) {
    return "border-border bg-surface-secondary/30 text-text-tertiary";
  }
  if (status === "succeeded") {
    return "border-success-border bg-success-soft text-success-text";
  }
  if (status === "failed" || status === "cancelled") {
    return "border-danger-border bg-danger-soft text-danger-text";
  }
  if (status === "blocked") {
    return "border-warning-border bg-warning-soft text-warning-text";
  }
  return "border-primary/20 bg-primary/10 text-primary";
};

export default function TaskStatusCard({ taskStatus }: TaskStatusCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-text-primary">
          {t("settings.microApps.imageGenerationStudio.cards.taskStatus.title")}
        </div>
        <div className="text-sm text-text-secondary">
          {t("settings.microApps.imageGenerationStudio.cards.taskStatus.description")}
        </div>
      </div>

      <div className="space-y-2">
        {taskStatusOrder.map((status) => {
          const active = status === taskStatus;
          return (
            <div
              key={status}
              className={`flex items-start gap-3 rounded-ui-panel border px-3 py-3 ${statusTone(
                status,
                active,
              )}`}
            >
              <span
                className={`mt-1 h-2.5 w-2.5 rounded-full ${
                  active ? "bg-current" : "bg-border"
                }`}
              />
              <div className="space-y-1">
                <div className="text-sm font-medium">
                  {t(`settings.microApps.imageGenerationStudio.taskStatus.${status}`)}
                </div>
                <div className="text-xs leading-5 opacity-90">
                  {t(
                    `settings.microApps.imageGenerationStudio.taskStatusDescriptions.${status}`,
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
