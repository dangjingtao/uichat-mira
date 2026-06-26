import { useEffect, useMemo } from "react";
import { DatabaseZap, FileCode2, FileText, FlaskConical, Info, ScrollText } from "lucide-react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import SettingsPageLayout from "@/features/Settings/components/SettingsPageLayout";
import SegmentedTabs from "@/shared/ui/SegmentedTabs";

const TAB_VALUES = [
  "logs",
  "database",
  "client-tests",
  "server-tests",
  "base-information",
  "docs",
  "api-docs",
] as const;

type TabValue = (typeof TAB_VALUES)[number];

export default function DevelopmentSettings() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (pathname === "/settings/development") {
      navigate("/settings/development/logs", { replace: true });
    }
  }, [navigate, pathname]);

  const activeTab = useMemo<TabValue>(() => {
    if (pathname.includes("/development/database")) {
      return "database";
    }
    if (pathname.includes("/development/client-tests")) {
      return "client-tests";
    }
    if (pathname.includes("/development/server-tests")) {
      return "server-tests";
    }
    if (pathname.includes("/development/base-information")) {
      return "base-information";
    }
    if (pathname.includes("/development/docs")) {
      return "docs";
    }
    if (pathname.includes("/development/api-docs")) {
      return "api-docs";
    }
    return "logs";
  }, [pathname]);

  const tabs = useMemo(
    () => [
      {
        value: "logs" as const,
        label: (
          <span className="flex items-center gap-1.5">
            <ScrollText className="h-4 w-4" />
            {t("settings.development.tabs.logs")}
          </span>
        ),
      },
      {
        value: "database" as const,
        label: (
          <span className="flex items-center gap-1.5">
            <DatabaseZap className="h-4 w-4" />
            {t("settings.development.tabs.database")}
          </span>
        ),
      },
      {
        value: "client-tests" as const,
        label: (
          <span className="flex items-center gap-1.5">
            <FlaskConical className="h-4 w-4" />
            {t("settings.development.tabs.clientTests")}
          </span>
        ),
      },
      {
        value: "server-tests" as const,
        label: (
          <span className="flex items-center gap-1.5">
            <FlaskConical className="h-4 w-4" />
            {t("settings.development.tabs.serverTests")}
          </span>
        ),
      },
      {
        value: "base-information" as const,
        label: (
          <span className="flex items-center gap-1.5">
            <Info className="h-4 w-4" />
            {t("settings.development.tabs.baseInformation")}
          </span>
        ),
      },
      {
        value: "docs" as const,
        label: (
          <span className="flex items-center gap-1.5">
            <FileText className="h-4 w-4" />
            {t("settings.development.tabs.docs")}
          </span>
        ),
      },
      {
        value: "api-docs" as const,
        label: (
          <span className="flex items-center gap-1.5">
            <FileCode2 className="h-4 w-4" />
            {t("settings.development.tabs.apiDocs")}
          </span>
        ),
      },
    ],
    [t],
  );

  const handleTabChange = (value: TabValue) => {
    navigate(`/settings/development/${value}`);
  };

  return (
    <SettingsPageLayout
      miniTitle={t("settings.development.page.miniTitle")}
      title={t("settings.development.page.title")}
      description={t("settings.development.page.description")}
      containerClassName="max-w-none"
      contentClassName="flex h-full min-h-0 flex-col gap-4 pt-6"
    >
      <SegmentedTabs
        value={activeTab}
        onChange={handleTabChange}
        items={tabs}
      />
      <div className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </div>
    </SettingsPageLayout>
  );
}
