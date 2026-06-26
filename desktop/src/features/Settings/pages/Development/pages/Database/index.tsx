import { Database, ServerCog, Waypoints } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useRuntimeHealth } from "@/features/system/hooks/useRuntimeHealth";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import StatusIndicator from "@/shared/ui/StatusIndicator";

export default function DevelopmentDatabasePage() {
  const { t } = useTranslation();
  const { backendState, databaseState, vectorState } = useRuntimeHealth();

  const getDetailText = (detailState: {
    detail?: string;
    detailKey?: string;
    detailValues?: Record<string, string>;
  }) =>
    detailState.detailKey
      ? t(detailState.detailKey, detailState.detailValues)
      : (detailState.detail ?? "");

  const rows = [
    {
      key: "backend",
      title: t("settings.general.health.services.server"),
      eyebrow: t("settings.development.database.rows.backendEyebrow"),
      detail: getDetailText(backendState),
      status: backendState.status,
      icon: <ServerCog className="h-4 w-4" />,
    },
    {
      key: "sqlite",
      title: t("settings.general.health.services.sqlite"),
      eyebrow: t("settings.development.database.rows.sqliteEyebrow"),
      detail: getDetailText(databaseState),
      status: databaseState.status,
      icon: <Database className="h-4 w-4" />,
    },
    {
      key: "sqlite-vec",
      title: t("settings.general.health.services.sqliteVec"),
      eyebrow: t("settings.development.database.rows.vectorEyebrow"),
      detail: getDetailText(vectorState),
      status: vectorState.status,
      icon: <Waypoints className="h-4 w-4" />,
    },
  ] as const;

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      {/* Status Cards */}
      <div className="grid gap-4 lg:grid-cols-3">
        {rows.map((row) => (
          <Card
            key={row.key}
            variant="default"
            className="flex flex-col gap-5"
          >
            {/* Card header: icon + labels on left, status on right */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ui-control bg-surface-secondary text-icon-secondary">
                  {row.icon}
                </div>
                <div className="min-w-0">
                  <div className="text-caption font-medium uppercase tracking-wider text-text-tertiary">
                    {row.eyebrow}
                  </div>
                  <div className="text-base font-semibold text-text-primary">
                    {row.title}
                  </div>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <StatusIndicator status={row.status} size="sm" />
                <Badge
                  variant={
                    row.status === "running"
                      ? "success"
                      : row.status === "stopped"
                        ? "danger"
                        : "warning"
                  }
                  size="sm"
                >
                  {t(`ui.statusIndicator.${row.status}`)}
                </Badge>
              </div>
            </div>

            {/* Detail text */}
            {row.detail && (
              <p className="font-mono text-xs leading-6 text-text-tertiary">
                {row.detail}
              </p>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
