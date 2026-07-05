import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";

export default function HelpCard() {
  const { t } = useTranslation();

  return (
    <Card className="space-y-4">
      <div className="space-y-1">
        <div className="text-sm font-semibold text-text-primary">
          {t("settings.microApps.imageGenerationStudio.cards.help.title")}
        </div>
        <div className="text-sm text-text-secondary">
          {t("settings.microApps.imageGenerationStudio.cards.help.description")}
        </div>
      </div>

      <div className="space-y-3 text-sm leading-6 text-text-secondary">
        <div>
          <div className="font-medium text-text-primary">
            {t("settings.microApps.imageGenerationStudio.help.promptTitle")}
          </div>
          <div>{t("settings.microApps.imageGenerationStudio.help.promptDescription")}</div>
        </div>
        <div>
          <div className="font-medium text-text-primary">
            {t("settings.microApps.imageGenerationStudio.help.workflowTitle")}
          </div>
          <div>{t("settings.microApps.imageGenerationStudio.help.workflowDescription")}</div>
        </div>
        <div>
          <div className="font-medium text-text-primary">
            {t("settings.microApps.imageGenerationStudio.help.apiFormatTitle")}
          </div>
          <div>{t("settings.microApps.imageGenerationStudio.help.apiFormatDescription")}</div>
        </div>
        <div>
          <div className="font-medium text-text-primary">
            {t("settings.microApps.imageGenerationStudio.help.localStateTitle")}
          </div>
          <div>{t("settings.microApps.imageGenerationStudio.help.localStateDescription")}</div>
        </div>
      </div>
    </Card>
  );
}
