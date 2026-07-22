import { SearchCode } from "lucide-react";
import { useTranslation } from "react-i18next";

import Badge from "@/shared/ui/Badge";
import Card from "@/shared/ui/Card";

import gitLogo from "./assets/git.svg";
import nodejsLogo from "./assets/nodejs.svg";
import npmLogo from "./assets/npm.svg";
import uvLogo from "./assets/uv.svg";

type RuntimeTool = {
  name: string;
  version: string;
  logo?: string;
};

// Display-only metadata mirrors the versions pinned by the terminal runtime package.
const runtimeTools: RuntimeTool[] = [
  { name: "Node.js", version: "22.23.1", logo: nodejsLogo },
  { name: "npm / npx", version: "10.9.8", logo: npmLogo },
  { name: "MinGit", version: "2.55.0.windows.3", logo: gitLogo },
  { name: "uv", version: "0.11.31", logo: uvLogo },
  { name: "ripgrep", version: "15.2.0" },
];

export default function DevelopmentEnvironmentSuiteCard() {
  const { t } = useTranslation();

  return (
    <Card className="space-y-3">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold text-text-primary">
          {t("settings.general.developmentEnvironment.title")}
        </h2>
        <Badge variant="muted">Windows x64</Badge>
      </div>

      <div
        role="list"
        className="overflow-hidden rounded-ui-panel border border-border/70 bg-surface-secondary/60"
      >
        {runtimeTools.map((tool, index) => (
          <div
            key={tool.name}
            role="listitem"
            className={`flex items-center justify-between gap-4 px-3.5 py-3 ${
              index > 0 ? "border-t border-border/70" : ""
            }`}
          >
            <div className="flex min-w-0 items-center gap-2">
              {tool.logo ? (
                <img
                  src={tool.logo}
                  alt=""
                  aria-hidden="true"
                  className="h-4 w-4 shrink-0"
                />
              ) : (
                <SearchCode
                  className="h-4 w-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
              )}
              <span className="text-sm font-medium text-text-primary">
                {tool.name}
              </span>
            </div>
            <span className="shrink-0 font-mono text-xs tabular-nums text-text-secondary">
              v{tool.version}
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
