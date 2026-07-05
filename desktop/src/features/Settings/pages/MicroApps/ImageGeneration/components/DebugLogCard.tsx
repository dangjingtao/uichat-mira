import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import type { StudioLogEntry } from "../model/view-model";

interface DebugLogCardProps {
  logs: StudioLogEntry[];
}

const logTone = (level: StudioLogEntry["level"]) => {
  if (level === "success") {
    return "success";
  }
  if (level === "warning") {
    return "warning";
  }
  if (level === "danger") {
    return "danger";
  }
  return "neutral";
};

export default function DebugLogCard({ logs }: DebugLogCardProps) {
  const { t } = useTranslation();

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-text-primary">
          {t("settings.microApps.imageGenerationStudio.cards.debugLog.title")}
        </div>
        <div className="text-sm text-text-secondary">
          {t("settings.microApps.imageGenerationStudio.cards.debugLog.description")}
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="rounded-ui-panel border border-dashed border-border bg-surface-secondary/20 px-4 py-6 text-sm text-text-secondary">
          {t("settings.microApps.imageGenerationStudio.logs.empty")}
        </div>
      ) : (
        <div className="space-y-2">
          {logs.map((entry) => (
            <div
              key={entry.id}
              className="rounded-ui-panel border border-border bg-surface-secondary/20 px-3 py-3"
            >
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={logTone(entry.level)} size="sm">
                  {new Date(entry.at).toLocaleTimeString()}
                </Badge>
                <span className="text-sm font-medium text-text-primary">
                  {t(entry.stageKey)}
                </span>
              </div>
              <div className="mt-2 text-sm leading-6 text-text-secondary">
                {t(entry.detailKey)}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
