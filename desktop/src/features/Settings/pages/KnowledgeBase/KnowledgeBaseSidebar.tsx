import { Plus, Search } from "lucide-react";
import { Button } from "@/shared/ui/Button";
import Card from "@/shared/ui/Card";
import type { KnowledgeBaseSummary } from "@/shared/api/knowledgeBase";

interface KnowledgeBaseSidebarProps {
  searchText: string;
  onSearchTextChange: (value: string) => void;
  onCreate: () => void;
  knowledgeBases: KnowledgeBaseSummary[];
  selectedKnowledgeBaseId: string | null;
  onSelectKnowledgeBase: (knowledgeBaseId: string) => void;
}

function formatKnowledgeBaseCount(count: number) {
  return `${count}`;
}

function formatKnowledgeBaseUpdatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }

  const diffMs = Date.now() - date.getTime();
  if (diffMs < 0) {
    return "刚刚更新";
  }

  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  if (diffMinutes < 1) {
    return "刚刚更新";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes}分钟前更新`;
  }

  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  if (diffHours < 24) {
    return `${diffHours}小时前更新`;
  }

  return `${Math.max(Math.floor(diffMs / (1000 * 60 * 60 * 24)), 1)}天前更新`;
}

export default function KnowledgeBaseSidebar({
  searchText,
  onSearchTextChange,
  onCreate,
  knowledgeBases,
  selectedKnowledgeBaseId,
  onSelectKnowledgeBase,
}: KnowledgeBaseSidebarProps) {
  return (
    <Card className="flex h-full min-h-0 flex-col" padding="sm">
      <div className="flex items-center gap-1">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-icon-secondary" />
          <input
            value={searchText}
            onChange={(event) => onSearchTextChange(event.target.value)}
            placeholder="搜索知识库"
            className="h-8 w-full rounded-ui-control border border-border bg-surface-primary pl-9 pr-3 text-[13px] text-text-primary shadow-shadow-sm transition-[background-color,border-color,box-shadow] duration-150 placeholder:text-text-tertiary focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <Button variant="outline" size="sm" onClick={onCreate}>
          <Plus className="h-3 w-3" />
        </Button>
      </div>

      <div className="stable-scrollbar mt-3 min-h-0 flex-1 overflow-y-auto pr-1">
        <div className="space-y-1">
          {knowledgeBases.map((item) => {
            const isActive = item.id === selectedKnowledgeBaseId;
            const updatedAtLabel = formatKnowledgeBaseUpdatedAt(item.updatedAt);

            return (
              <div
                key={item.id}
                className={`cursor-pointer rounded-ui-control ${
                  isActive
                    ? "bg-primary/10"
                    : "border-transparent text-text-secondary hover:bg-surface-secondary hover:text-text-primary"
                }`}
              >
                <button
                  type="button"
                  onClick={() => onSelectKnowledgeBase(item.id)}
                  className="flex w-full items-start rounded-ui-control px-3 py-1.5 text-left transition-all"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div
                        className={`truncate text-sm font-medium ${
                          isActive ? "text-primary" : "text-text-primary"
                        }`}
                      >
                        {item.name}
                      </div>
                      <div className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-surface-secondary px-1.5 text-[10px] text-text-tertiary">
                        {formatKnowledgeBaseCount(item.documentCount)}
                      </div>
                    </div>
                    {isActive && updatedAtLabel ? (
                      <div className="mt-0.5 truncate text-[11px] leading-4 text-text-tertiary tabular-nums">
                        {updatedAtLabel}
                      </div>
                    ) : null}
                  </div>
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Card>
  );
}
