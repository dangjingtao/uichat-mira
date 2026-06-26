import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FlaskConical } from "lucide-react";
import { CoverageReportPanel } from "@/shared/ui";
import { getDesktopRuntime } from "@/shared/platform/desktopRuntime";

export interface CoverageReportViewProps {
  type: "client" | "server";
}

export default function CoverageReportView({ type }: CoverageReportViewProps) {
  const { t } = useTranslation();
  const runtime = getDesktopRuntime();
  const coverageBaseUrl = runtime.backendUrl || "";
  const summaryUrl = useMemo(
    () => `${coverageBaseUrl}/${type}-coverage/coverage-summary.json`,
    [coverageBaseUrl, type],
  );
  const resultUrl = useMemo(
    () => `${coverageBaseUrl}/${type}-coverage/test-results-summary.json`,
    [coverageBaseUrl, type],
  );

  const isClient = type === "client";

  return (
    <CoverageReportPanel
      src={summaryUrl}
      resultSrc={resultUrl}
      title={
        <span className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-icon-primary" />
          {t(
            isClient
              ? "settings.development.clientTests.reportTitle"
              : "settings.development.serverTests.reportTitle",
          )}
        </span>
      }
      emptyText={t(
        isClient
          ? "settings.development.clientTests.reportNotAvailable"
          : "settings.development.serverTests.reportNotAvailable",
      )}
    />
  );
}
