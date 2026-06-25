import { Eye, FileSearch, Globe, PencilLine, SquareTerminal } from "lucide-react";
import Badge from "@/shared/ui/Badge";
import type { ToolDomainSummary, ToolWorkbenchDomain } from "../types";

const domainIcons: Record<ToolWorkbenchDomain, typeof FileSearch> = {
  read: FileSearch,
  edit: PencilLine,
  web_search: Globe,
  terminal: SquareTerminal,
  browser_action: Eye,
};

type ToolsSidebarProps = {
  activeDomain: ToolWorkbenchDomain;
  summaries: ToolDomainSummary[];
  onSelectDomain: (domain: ToolWorkbenchDomain) => void;
};

export default function ToolsSidebar({
  activeDomain,
  summaries,
  onSelectDomain,
}: ToolsSidebarProps) {
  return (
    <div className="stable-scrollbar flex min-h-0 flex-col gap-3 overflow-y-auto border-r border-border pr-4">
      <div className="space-y-2 pb-2">
        {summaries.map((summary) => {
          const Icon = domainIcons[summary.id];
          const isActive = summary.id === activeDomain;

          return (
            <button
              key={summary.id}
              type="button"
              onClick={() => onSelectDomain(summary.id)}
              className={`flex w-full items-start gap-3 rounded-ui-control border px-3 py-2 text-left transition-colors ${
                isActive
                  ? "border-primary/30 bg-primary/5"
                  : "border-border bg-surface-primary hover:bg-surface-secondary"
              }`}
            >
              <div
                className={`mt-0.5 flex h-7 w-7 items-center justify-center rounded-ui-control ${
                  isActive ? "bg-primary/10 text-primary" : "bg-surface-secondary text-icon-secondary"
                }`}
              >
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <div className="truncate text-sm font-medium text-text-primary">{summary.label}</div>
                  <Badge variant="muted">{summary.count}</Badge>
                </div>
                <div className="mt-1 text-xs leading-5 text-text-secondary">{summary.description}</div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
