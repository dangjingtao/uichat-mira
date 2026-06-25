import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import Badge from "@/shared/ui/Badge";
import type { RoleModelConfig } from "@/shared/api/modelSettings";

interface ModelStatusCardProps {
  title: string;
  description: string;
  config: RoleModelConfig | null;
  required?: boolean;
  icon: React.ReactNode;
}

export default function ModelStatusCard({
  title,
  description,
  config,
  required = false,
  icon,
}: ModelStatusCardProps) {
  const { t } = useTranslation();
  const configured = Boolean(config?.providerCode && config?.remoteModelId);
  const modelSummary = configured
    ? `${config?.providerCode} · ${config?.name ?? config?.remoteModelId}`
    : null;

  return (
    <Card className="bg-gradient-to-br from-surface-primary to-surface-secondary p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="text-sm font-semibold text-text-primary">
                {title}
              </div>
              {modelSummary ? (
                <Badge variant="neutral" size="sm">
                  {modelSummary}
                </Badge>
              ) : null}
            </div>
            <div className="mt-1 text-sm leading-6 text-text-secondary">
              {description}
            </div>
          </div>
        </div>
        <Badge variant={configured ? "success" : "danger"} size="md">
          {configured
            ? t("settings.knowledgeBase.add.configured")
            : required
              ? t("settings.knowledgeBase.add.requiredConfig")
              : t("settings.knowledgeBase.add.notConfigured")}
        </Badge>
      </div>
    </Card>
  );
}
