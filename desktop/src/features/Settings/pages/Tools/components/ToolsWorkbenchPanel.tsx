import { LoaderCircle } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import Badge from "@/shared/ui/Badge";
import { TextInput } from "@/shared/ui/Input";
import type { McpWorkspaceSelection } from "@/shared/api/tools";

type ToolsWorkbenchPanelProps = {
  isSelectingWorkspace: boolean;
  isWorkspaceLoading: boolean;
  workspaceRootInput: string;
  workspaceSelection: McpWorkspaceSelection | null;
  onWorkspaceChange: (value: string) => void;
  onWorkspaceApply: () => void;
  labels: {
    applyWorkspace: string;
    workspaceCurrent: string;
    workspaceDescription: string;
    workspaceRoot: string;
    workspaceRootInput: string;
    workspaceRootPlaceholder: string;
    workspaceUnset: string;
  };
};

export default function ToolsWorkbenchPanel({
  isSelectingWorkspace,
  isWorkspaceLoading,
  workspaceRootInput,
  workspaceSelection,
  onWorkspaceChange,
  onWorkspaceApply,
  labels,
}: ToolsWorkbenchPanelProps) {
  return (
    <div className="shrink-0 rounded-ui-panel border border-border bg-surface-primary px-4 py-3">
      <div className="grid grid-cols-[170px_minmax(0,1fr)_auto] items-center gap-3">
        <div className="min-w-0">
          <div className="text-sm font-medium text-text-primary">{labels.workspaceRoot}</div>
          <div className="mt-0.5 truncate text-xs text-text-secondary">{labels.workspaceDescription}</div>
        </div>
        <TextInput
          label={undefined}
          value={workspaceRootInput}
          onChange={onWorkspaceChange}
          placeholder={labels.workspaceRootPlaceholder}
          disabled={isWorkspaceLoading || isSelectingWorkspace}
          compact
        />
        <div className="flex items-center gap-2">
          <Badge variant="muted">{workspaceSelection?.source ?? "unset"}</Badge>
          <Button
            variant="primary"
            size="sm"
            onClick={onWorkspaceApply}
            disabled={isWorkspaceLoading || isSelectingWorkspace}
          >
            {isSelectingWorkspace ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
            {labels.applyWorkspace}
          </Button>
        </div>
      </div>
      <div className="mt-2 truncate text-xs text-text-secondary">
        {workspaceSelection?.rootPath
          ? `${labels.workspaceCurrent}: ${workspaceSelection.rootPath}`
          : labels.workspaceUnset}
      </div>
    </div>
  );
}
