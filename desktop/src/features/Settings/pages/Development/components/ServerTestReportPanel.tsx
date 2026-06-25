import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ExternalLink, FlaskConical } from "lucide-react";
import { getDesktopRuntime } from "@/shared/platform/desktopRuntime";

export default function ServerTestReportPanel() {
  const { t } = useTranslation();
  const [hasCoverageReport, setHasCoverageReport] = useState(false);
  const runtime = getDesktopRuntime();
  const coverageBaseUrl = runtime.backendUrl || "";
  const coverageUrl = `${coverageBaseUrl}/server-coverage/index.html`;

  useEffect(() => {
    let cancelled = false;

    fetch(coverageUrl, { method: "HEAD" })
      .then((res) => {
        if (!cancelled) {
          setHasCoverageReport(res.ok);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHasCoverageReport(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [coverageUrl]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <FlaskConical className="h-4 w-4 text-icon-primary" />
          <h2 className="text-sm font-semibold text-text-primary">
            {t("settings.development.serverTests.reportTitle")}
          </h2>
        </div>
        {hasCoverageReport ? (
          <a
            href={coverageUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-secondary hover:text-text-primary"
          >
            {t("settings.development.serverTests.openFullReport")}
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        ) : null}
      </div>

      {hasCoverageReport ? (
        <div className="overflow-hidden rounded-lg border border-border/70">
          <iframe
            title={t("settings.development.serverTests.reportTitle")}
            src={coverageUrl}
            className="h-[360px] w-full"
          />
        </div>
      ) : (
        <div className="rounded-lg border border-border/70 bg-surface-secondary/60 px-3 py-4 text-sm text-text-secondary">
          {t("settings.development.serverTests.reportNotAvailable")}
        </div>
      )}
    </div>
  );
}
