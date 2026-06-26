import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FlaskConical } from "lucide-react";
import { CoverageReportPanel } from "@/shared/ui";
import { getDesktopRuntime } from "@/shared/platform/desktopRuntime";

export default function TestReportPanel() {
  const { t } = useTranslation();
  const runtime = getDesktopRuntime();
  const coverageBaseUrl = runtime.backendUrl || "";
  const summaryUrl = useMemo(
    () => `${coverageBaseUrl}/client-coverage/coverage-summary.json`,
    [coverageBaseUrl],
  );

  return (
    <CoverageReportPanel
      src={summaryUrl}
      title={
        <span className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-icon-primary" />
          {t("settings.development.clientTests.reportTitle")}
        </span>
      }
      emptyText={t("settings.development.clientTests.reportNotAvailable")}
    />
  );
}
