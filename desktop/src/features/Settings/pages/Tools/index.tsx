import { useEffect, useState } from "react";
import type { LucideIcon } from "lucide-react";
import { Folder, Globe, Wrench } from "lucide-react";
import { useTranslation } from "react-i18next";
import Badge from "@/shared/ui/Badge";
import Card from "@/shared/ui/Card";
import { message } from "@/shared/ui/Message";
import { getTools, type ToolDefinition } from "@/shared/api/tools";
import SettingsPageLayout from "../../components/SettingsPageLayout";

const toolIconMap: Record<string, LucideIcon> = {
  "web-search": Globe,
  "file-system": Folder,
};

function ToolCard({
  name,
  description,
  Icon,
  tags,
}: {
  name: string;
  description: string;
  Icon: LucideIcon;
  tags: string[];
}) {
  return (
    <Card className="flex gap-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-secondary/60">
        <Icon className="h-5 w-5 text-icon-primary" />
      </div>

      <div className="min-w-0 flex-1 space-y-2">
        <div className="space-y-1">
          <h3 className="text-sm font-semibold text-text-primary">{name}</h3>
          <p className="text-sm leading-6 text-text-secondary">{description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tags.map((tag) => (
            <Badge key={`${name}-${tag}`} variant="muted">
              {tag}
            </Badge>
          ))}
        </div>
      </div>
    </Card>
  );
}

export default function ToolsSettings() {
  const { t } = useTranslation();
  const [tools, setTools] = useState<ToolDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    setIsLoading(true);

    getTools()
      .then((data) => {
        if (cancelled) {
          return;
        }

        setTools(data);
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }

        message.error(
          error instanceof Error
            ? error.message
            : t("settings.tools.loadFailed"),
        );
      })
      .finally(() => {
        if (cancelled) {
          return;
        }

        setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [t]);

  return (
    <SettingsPageLayout
      miniTitle={t("settings.tools.miniTitle")}
      title={t("settings.tools.title")}
      description={t("settings.tools.description")}
      contentClassName="space-y-4 pt-6"
    >
      {isLoading ? (
        <Card className="text-sm text-text-secondary">
          {t("settings.tools.loading")}
        </Card>
      ) : tools.length === 0 ? (
        <Card className="text-sm text-text-secondary">
          {t("settings.tools.empty")}
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          {tools.map((tool) => {
            const Icon = toolIconMap[tool.id] ?? Wrench;

            return (
              <ToolCard
                key={tool.id}
                name={tool.name}
                description={tool.description}
                Icon={Icon}
                tags={tool.tags}
              />
            );
          })}
        </div>
      )}
    </SettingsPageLayout>
  );
}
