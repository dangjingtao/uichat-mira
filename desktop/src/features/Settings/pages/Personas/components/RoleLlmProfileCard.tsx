import { ChevronRight, SlidersHorizontal } from "lucide-react";
import Badge from "@/shared/ui/Badge";
import { useRoleTranslation } from "../i18n/useRoleTranslation";
import type { RoleLlmProfile } from "../types";
import { normalizeLlmProfile, summarizeLlmProfile } from "../utils";

interface RoleLlmProfileCardProps {
  profile: RoleLlmProfile;
  onClick: () => void;
}

export default function RoleLlmProfileCard({
  profile,
  onClick,
}: RoleLlmProfileCardProps) {
  const t = useRoleTranslation();
  const configuredCount = Object.keys(normalizeLlmProfile(profile)).length;

  return (
    <button
      type="button"
      onClick={onClick}
    className="min-w-0 rounded-ui-panel border border-border bg-surface-primary p-3 text-left transition-colors hover:bg-surface-secondary"
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 flex flex-1 items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-ui-control bg-surface-secondary text-icon-secondary">
            <SlidersHorizontal className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <div className="truncate text-sm font-semibold text-text-primary">
                {t("llmProfile.title")}
              </div>
              <Badge variant="neutral" className="shrink-0 whitespace-nowrap">
                {t("llmProfile.configuredCount", { count: configuredCount })}
              </Badge>
            </div>
            <div className="truncate text-xs leading-5 text-text-secondary">
              {summarizeLlmProfile(t, profile)}
            </div>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-icon-secondary" />
      </div>
    </button>
  );
}
