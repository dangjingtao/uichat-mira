import Badge from "@/shared/ui/Badge";
import Card from "@/shared/ui/Card";
import { useTranslation } from "react-i18next";
import {
  getRuntimeDisplayLabel,
} from "@/shared/platform/desktopRuntime";
import { useRuntimeHealth } from "@/features/system/hooks/useRuntimeHealth";

function HealthCheck() {
  const { t } = useTranslation();
  const { runtime } = useRuntimeHealth();

  return (
    <section className="space-y-4">
      <Card className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 px-0 pb-1">
          <div className="flex min-w-0 flex-wrap items-center gap-2">
            <h2 className="text-sm font-semibold text-text-primary">
              {t("settings.general.health.title")}
            </h2>
            <Badge variant="muted">
              {getRuntimeDisplayLabel(runtime)}
            </Badge>
          </div>
        </div>
        <p className="text-sm leading-6 text-text-secondary">
          {t("settings.general.health.summary")}
        </p>
      </Card>
    </section>
  );
}

export default HealthCheck;
