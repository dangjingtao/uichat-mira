import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Badge from "@/shared/ui/Badge";
import { getAppMeta, type AppMetaData } from "@/shared/api/system";
import {
  getDesktopRuntime,
  isDesktopShell,
} from "@/shared/platform/desktopRuntime";
import { appPackageMeta } from "@/shared/appMeta";
import SettingsPageLayout from "../../components/SettingsPageLayout";

const getFallbackAppMeta = (): AppMetaData => ({
  name: appPackageMeta.name,
  version: "0.0.0",
  displayName: appPackageMeta.displayName,
  author: appPackageMeta.author,
  description: appPackageMeta.description,
  repositoryUrl: appPackageMeta.repositoryUrl,
  homepageUrl: appPackageMeta.homepageUrl,
  links: [],
});

const platformLabel = (platform: string) => {
  if (platform === "win32") return "Windows";
  if (platform === "darwin") return "macOS";
  if (platform === "linux") return "Linux";
  return platform;
};

const hostLabel = (hostKind: "browser" | "electron" | "tauri") => {
  if (hostKind === "electron") return "Electron";
  if (hostKind === "tauri") return "Tauri";
  return "Browser Preview";
};

function About() {
  const { t } = useTranslation();
  const [runtime] = useState(() => getDesktopRuntime());
  const [appMeta, setAppMeta] = useState<AppMetaData>(() =>
    getFallbackAppMeta(),
  );

  useEffect(() => {
    if (!isDesktopShell(runtime)) {
      setAppMeta(getFallbackAppMeta());
      return;
    }

    let cancelled = false;

    void getAppMeta()
      .then((data) => {
        if (!cancelled) {
          setAppMeta(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAppMeta(getFallbackAppMeta());
        }
      });

    return () => {
      cancelled = true;
    };
  }, [runtime]);

  const brandStoryParagraphs = t("settings.about.brand.paragraphs", {
    appName: appPackageMeta.displayName,
    returnObjects: true,
  }) as string[];
  const runtimeMeta =
    runtime.hostKind === "browser"
      ? hostLabel(runtime.hostKind)
      : `${platformLabel(runtime.platform)} · ${hostLabel(runtime.hostKind)}`;

  return (
    <SettingsPageLayout
      miniTitle={t("settings.about.miniTitle")}
      title={appMeta.displayName}
      titleMeta={
        <Badge
          variant="neutral"
          size="sm"
          outline
          className="font-mono"
        >
          v{appMeta.version} · {runtimeMeta}
        </Badge>
      }
      description={t("settings.about.brand.description")}
      contentClassName="pt-6"
    >
      <article
        data-testid="about-brand-story"
        className="max-w-3xl space-y-4 text-sm leading-7 text-text-secondary"
      >
        {brandStoryParagraphs.map((paragraph, index) => {
          const isFirst = index === 0;
          const isLast = index === brandStoryParagraphs.length - 1;

          return (
            <p
              key={`${index}:${paragraph.slice(0, 12)}`}
              className={
                isLast
                  ? "pt-2 font-medium text-text-primary"
                  : isFirst
                    ? "text-text-primary"
                    : ""
              }
            >
              {paragraph}
            </p>
          );
        })}
      </article>
    </SettingsPageLayout>
  );
}

export default About;
