import React from "react";
import { useTranslation } from "react-i18next";
import { CheckCircle, Loader2, AlertCircle, Plus } from "lucide-react";
import type { ProviderSummary } from "@/shared/api/modelSettings";
import Card from "@/shared/ui/Card";
import { IconButton } from "@/shared/ui/Button";
import { TextInput } from "@/shared/ui/Input";

interface PlatformCardProps {
  platforms: ProviderSummary[];
  selectedPlatform: string;
  loadingPlatformId?: string | null;
  searchQuery: string;
  onSelectPlatform: (id: string) => void;
  onSearchQueryChange: (value: string) => void;
  onCreateProvider: () => void;
}

const PlatformCard: React.FC<PlatformCardProps> = ({
  platforms,
  selectedPlatform,
  loadingPlatformId,
  searchQuery,
  onSelectPlatform,
  onSearchQueryChange,
  onCreateProvider,
}) => {
  const { t } = useTranslation();

  return (
    <div className="flex h-full w-full shrink-0 md:w-56">
      <Card
        variant="subtle"
        padding="sm"
        className="flex h-full w-full flex-col"
      >
        <div className="px-1 py-1 text-xs font-medium uppercase tracking-[0.12em] text-text-tertiary">
          {t("settings.model.platform.title")}
        </div>

        <div className="mt-2 flex items-center gap-2 px-1">
          <div className="min-w-0 flex-1">
            <TextInput
              value={searchQuery}
              onChange={onSearchQueryChange}
              placeholder={t("settings.model.platform.searchPlaceholder")}
              compact
            />
          </div>
          <IconButton
            ariaLabel={t("settings.model.platform.addProvider")}
            title={t("settings.model.platform.addProvider")}
            size="sm"
            styleType="outline"
            onClick={onCreateProvider}
          >
            <Plus className="h-4 w-4" />
          </IconButton>
        </div>

        <div className="mt-2 flex-1 space-y-1 overflow-y-auto">
          {platforms.length === 0 ? (
            <div className="rounded-ui-panel border border-dashed border-border bg-surface-secondary px-3 py-6 text-center text-sm text-text-secondary">
              {t("settings.model.platform.noResults")}
            </div>
          ) : null}
          {platforms.map((platform) => {
            const isSelected = selectedPlatform === platform.code;
            const isLoading = loadingPlatformId === platform.code;
            const isConnected = platform.status === "connected";
            const isError = platform.status === "error";

            return (
              <button
                key={platform.code}
                type="button"
                onClick={() => onSelectPlatform(platform.code)}
                className={`w-full rounded-ui-panel border px-2.5 py-2 text-left transition-all duration-150 ${
                  isSelected
                    ? "border-primary/20 bg-surface-primary shadow-shadow-sm"
                    : "border-transparent bg-transparent hover:border-border hover:bg-surface-primary"
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-primary text-[11px] font-semibold text-text-primary">
                      {platform.displayName.slice(0, 1)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-[13px] font-medium text-text-primary">
                        {platform.displayName}
                      </div>
                      <div className="truncate text-[11px] leading-4 text-text-secondary">
                        {platform.assignedRoles.length > 0
                          ? t("settings.model.platform.bound", { roles: platform.assignedRoles.join(" / ") })
                          : t("settings.model.platform.waitingSync")}
                      </div>
                    </div>
                  </div>

                  {isLoading ? (
                    <Loader2 className="mt-0.5 h-4 w-4 animate-spin text-text-tertiary" />
                  ) : isError ? (
                    <span className="inline-flex rounded-full bg-danger/10 p-1 text-danger">
                      <AlertCircle className="h-3 w-3" />
                    </span>
                  ) : (
                    <span
                      className={`inline-flex rounded-full p-1 ${
                        isConnected
                          ? "bg-success/10 text-success"
                          : "bg-surface-tertiary text-text-secondary"
                      }`}
                    >
                      <CheckCircle className="h-3 w-3" />
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </Card>
    </div>
  );
};

export default PlatformCard;
