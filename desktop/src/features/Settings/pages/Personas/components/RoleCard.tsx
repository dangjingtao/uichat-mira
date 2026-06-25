import Badge from "@/shared/ui/Badge";
import type { RoleRecord } from "../types";
import { getStatusLabel, isDraftStatus, statusTone } from "../utils";
import RoleAvatar from "./RoleAvatar";
import { useRoleTranslation } from "../i18n/useRoleTranslation";

interface RoleCardProps {
  role: RoleRecord;
  active: boolean;
  avatarSrc?: string | null;
  onSelect: () => void;
}

export default function RoleCard({
  role,
  active,
  avatarSrc,
  onSelect,
}: RoleCardProps) {
  const t = useRoleTranslation();
  const showDraftBadge = isDraftStatus(role.status);

  return (
    <button
      type="button"
      onClick={onSelect}
      className={`w-full rounded-ui-panel border p-3.5 text-left transition-colors ${
        active
          ? "border-primary/25 bg-primary/5"
          : "border-border bg-surface-primary hover:bg-surface-secondary"
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="flex w-12 shrink-0 flex-col items-center gap-2">
          <RoleAvatar
            src={avatarSrc}
            name={role.name}
            sizeClassName="h-10 w-10 shrink-0"
          />
          {showDraftBadge ? (
            <Badge variant={statusTone(role.status)}>
              {getStatusLabel(t, role.status)}
            </Badge>
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold text-text-primary">
              {role.name}
            </div>
            <div className="mt-1 text-xs leading-5 text-text-secondary">
              {role.summary}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-1.5">
        {role.tags.slice(0, 3).map((tag) => (
          <Badge key={tag} variant="neutral">
            {tag}
          </Badge>
        ))}
      </div>
    </button>
  );
}
