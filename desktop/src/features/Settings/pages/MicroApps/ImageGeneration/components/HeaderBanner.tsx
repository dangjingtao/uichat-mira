import { FlaskConical, ImageIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import Alert from "@/shared/ui/Alert";
import Badge from "@/shared/ui/Badge";
import Card from "@/shared/ui/Card";

export default function HeaderBanner() {
  const { t } = useTranslation();

  return (
    <Card className="overflow-hidden border-border/80 bg-[linear-gradient(135deg,rgba(244,237,226,0.85),rgba(223,233,244,0.9))] p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="flex h-10 w-10 items-center justify-center rounded-ui-panel bg-surface-primary/80 text-primary shadow-shadow-sm">
              <ImageIcon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-lg font-semibold text-text-primary">
                {t("settings.microApps.imageGenerationStudio.page.title")}
              </div>
              <div className="text-sm text-text-secondary">
                {t("settings.microApps.imageGenerationStudio.page.subtitle")}
              </div>
            </div>
          </div>
          <Alert
            variant="info"
            title={t("settings.microApps.imageGenerationStudio.banner.title")}
            icon={<FlaskConical className="h-4 w-4" aria-hidden="true" />}
          >
            {t("settings.microApps.imageGenerationStudio.banner.description")}
          </Alert>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="primary" size="md">
            {t("settings.microApps.imageGenerationStudio.banner.badges.debugOnly")}
          </Badge>
          <Badge variant="neutral" size="md">
            {t("settings.microApps.imageGenerationStudio.banner.badges.promptAndWorkflow")}
          </Badge>
        </div>
      </div>
    </Card>
  );
}
