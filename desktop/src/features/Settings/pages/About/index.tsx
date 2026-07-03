import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import Card from "@/shared/ui/Card";
import { getAppMeta, type AppMetaData } from "@/shared/api/system";
import { isDesktopShell } from "@/shared/platform/desktopRuntime";
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

function About() {
  const { t } = useTranslation();
  const [appMeta, setAppMeta] = useState<AppMetaData>(() =>
    getFallbackAppMeta(),
  );

  useEffect(() => {
    if (!isDesktopShell()) {
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
  }, []);

  const brandStoryParagraphs = t("settings.about.brand.paragraphs", {
    appName: appPackageMeta.displayName,
    returnObjects: true,
  }) as string[];

  return (
    <SettingsPageLayout
      miniTitle={t("settings.about.miniTitle")}
      title={`${appMeta.displayName} ${appMeta.version}`}
      description={t("settings.about.brand.description")}
      contentClassName="space-y-4 pt-6"
    >
      <Card className="overflow-hidden border-none bg-transparent shadow-none">
        <div className="space-y-5">
          <div className="max-w-3xl space-y-4 text-sm leading-7 text-text-secondary">
            {brandStoryParagraphs.map((paragraph, index) => (
              <p
                key={`${index}:${paragraph.slice(0, 12)}`}
                className={
                  index === brandStoryParagraphs.length - 1
                    ? "font-medium text-text-primary"
                    : ""
                }
              >
                {paragraph}
              </p>
            ))}
          </div>
        </div>
      </Card>
    </SettingsPageLayout>
  );
}

export default About;
