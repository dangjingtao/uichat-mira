import { CircleUserRound, Plus } from "lucide-react";
import { IconButton } from "@/shared/ui/Button";
import type { RoleRecord } from "../types";
import RoleCard from "./RoleCard";
import RoleSectionTitle from "./RoleSectionTitle";
import { useRoleTranslation } from "../i18n/useRoleTranslation";

interface RoleListProps {
  roles: RoleRecord[];
  isLoading?: boolean;
  selectedRoleId: string;
  avatarSrcMap: Map<string, string>;
  onSelectRoleId: (id: string) => void;
  onNewRole: () => void;
}

export default function RoleList({
  roles,
  isLoading = false,
  selectedRoleId,
  avatarSrcMap,
  onSelectRoleId,
  onNewRole,
}: RoleListProps) {
  const t = useRoleTranslation();

  return (
    <div className="flex min-h-0 flex-col overflow-hidden border-r border-border">
      <div className="border-b border-border px-3.5 py-3">
        <div className="flex min-h-9 items-center justify-between gap-3">
          <RoleSectionTitle icon={CircleUserRound} title={t("list.title")} />
          <div className="flex shrink-0 items-center gap-1">
            <IconButton
              ariaLabel={t("actions.new")}
              title={t("actions.new")}
              size="sm"
              styleType="ghost"
              onClick={onNewRole}
            >
              <Plus className="h-4 w-4" />
            </IconButton>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto py-1.5">
        {!isLoading && roles.length === 0 ? (
          <div className="mx-3 my-1.5 rounded-ui-panel border border-dashed border-border bg-surface-secondary px-3 py-6 text-center text-sm text-text-secondary">
            {t("list.empty")}
          </div>
        ) : null}
        {roles.map((role) => (
          <RoleCard
            key={role.id}
            role={role}
            active={role.id === selectedRoleId}
            onSelect={() => onSelectRoleId(role.id)}
            avatarSrc={role.avatarId ? avatarSrcMap.get(role.avatarId) : null}
          />
        ))}
      </div>
    </div>
  );
}
