import Card from "@/shared/ui/Card";
import Tooltip from "@/shared/ui/Tooltip";
import { StatusIndicator } from "@/shared/ui/StatusIndicator";
import { useRuntimeHealth } from "@/features/system/hooks/useRuntimeHealth";
import { useTranslation } from "react-i18next";
import {
  getRuntimeDisplayLabel,
} from "@/shared/platform/desktopRuntime";
import {
  CircleHelp,
  Database,
  Server,
  Waypoints,
} from "lucide-react";
import LogButtons from "../LogsButtons";

function DetailTooltip({ text }: { text: string }) {
  const { t } = useTranslation();

  return (
    <Tooltip text={text} placement="top">
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full text-icon-secondary transition-colors duration-150 hover:bg-surface-secondary hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        aria-label={t("settings.general.health.detailAriaLabel")}
      >
        <CircleHelp className="h-4 w-4" />
      </button>
    </Tooltip>
  );
}

function HealthStatusRow({
  title,
  detail,
  status,
  icon,
}: {
  title: string;
  detail: string;
  status: "unknown" | "running" | "stopped";
  icon: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-border/70 bg-surface-secondary/60 px-3.5 py-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-surface-primary text-icon-secondary">
          {icon}
        </span>
        <div className="text-sm font-medium text-text-primary">{title}</div>
        <DetailTooltip text={detail} />
      </div>
      <StatusIndicator status={status} />
    </div>
  );
}

function HealthCheck() {
  const { t } = useTranslation();
  const { runtime, backendState, databaseState, vectorState } =
    useRuntimeHealth();
  const getDetailText = (detailState: {
    detail?: string;
    detailKey?: string;
    detailValues?: Record<string, string>;
  }) =>
    detailState.detailKey
      ? t(detailState.detailKey, detailState.detailValues)
      : (detailState.detail ?? "");

  return (
    <section className="space-y-4">
      <Card className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3 px-0 pb-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">
              {t("settings.general.health.title")}
            </h2>
            <span className="inline-flex items-center rounded-full border border-cloudy-3 bg-pampas-2 px-2 py-0.5 text-[11px] font-medium text-text-secondary">
              {getRuntimeDisplayLabel(runtime)}
            </span>
          </div>
          <LogButtons />
        </div>

        <HealthStatusRow
          title={t("settings.general.health.services.server")}
          detail={getDetailText(backendState)}
          status={backendState.status}
          icon={<Server className="h-4 w-4" />}
        />

        <HealthStatusRow
          title={t("settings.general.health.services.sqlite")}
          detail={getDetailText(databaseState)}
          status={databaseState.status}
          icon={<Database className="h-4 w-4" />}
        />

        <HealthStatusRow
          title={t("settings.general.health.services.sqliteVec")}
          detail={getDetailText(vectorState)}
          status={vectorState.status}
          icon={<Waypoints className="h-4 w-4" />}
        />
      </Card>
    </section>
  );
}

export default HealthCheck;
