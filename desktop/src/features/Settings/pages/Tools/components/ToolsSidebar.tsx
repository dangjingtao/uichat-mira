import {
  Bot,
  FileSearch,
  GitBranch,
  Globe,
  Mail,
  MousePointerClick,
  Newspaper,
  PencilLine,
  SquareTerminal,
  Wrench,
} from "lucide-react";
import Badge from "@/shared/ui/Badge";
import { UChatOverflowTooltip } from "@/shared/uchat/ui/UChatOverflowTooltip";
import type { ToolGroupSummary, ToolWorkbenchGroupId } from "../types";
import { formatToolGroup } from "../utils";

const groupIcons: Record<string, typeof FileSearch> = {
  "file-search": FileSearch,
  pencil: PencilLine,
  globe: Globe,
  terminal: SquareTerminal,
  "mouse-pointer": MousePointerClick,
  github: GitBranch,
  wrench: Wrench,
  external_expert: Bot,
  mail: Mail,
  news_research: Newspaper,
};

type ToolsSidebarProps = {
  activeGroupId: ToolWorkbenchGroupId | null;
  summaries: ToolGroupSummary[];
  onSelectGroup: (groupId: ToolWorkbenchGroupId) => void;
};

export default function ToolsSidebar({
  activeGroupId,
  summaries,
  onSelectGroup,
}: ToolsSidebarProps) {
  return (
    <nav
      aria-label="Tool groups"
      className="stable-scrollbar flex min-h-0 flex-col overflow-y-auto border-r border-border pr-3"
    >
      <ul className="divide-y divide-border pb-2">
        {summaries.map((summary) => {
          const Icon = groupIcons[summary.id] ?? groupIcons[summary.icon] ?? Wrench;
          const isActive = summary.id === activeGroupId;

          return (
            <li key={summary.id}>
              <button
                type="button"
                onClick={() => onSelectGroup(summary.id)}
                aria-current={isActive ? "page" : undefined}
                className={`grid w-full grid-cols-[28px_minmax(0,1fr)_24px] items-center gap-3 border-l-2 px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary/30 ${
                  isActive
                    ? "border-l-primary bg-surface-soft"
                    : "border-l-transparent hover:bg-surface-secondary"
                }`}
              >
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-ui-control ${
                    isActive ? "bg-primary/10 text-primary" : "bg-surface-secondary text-icon-secondary"
                  }`}
                >
                  <Icon className="h-4 w-4" />
                </div>
                <UChatOverflowTooltip
                  text={summary.label || formatToolGroup(summary.id)}
                  placement="right"
                >
                  <div className="min-w-0 truncate text-sm font-medium text-text-primary">
                    {summary.label || formatToolGroup(summary.id)}
                  </div>
                </UChatOverflowTooltip>
                <Badge variant="muted" className="justify-self-end">
                  {summary.count}
                </Badge>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
