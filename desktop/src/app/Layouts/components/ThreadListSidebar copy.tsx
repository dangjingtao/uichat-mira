// src/assistant/ThreadListSidebar.tsx
"use client";
import { Plus, MessageSquare, MoreHorizontal } from "lucide-react";
import {
  ThreadListPrimitive,
  ThreadListItemPrimitive,
  ThreadListItemMorePrimitive,
} from "@assistant-ui/react";

export function ThreadListSidebar() {
  return (
    <div className="flex h-full flex-col">
      {/* 新建对话 */}
      <div className="px-3 pt-3 pb-2">
        <ThreadListPrimitive.New asChild>
          <button
            className="group flex w-full items-center gap-2 rounded-lg border border-border/70 bg-surface-primary px-3 py-2.5 text-sm font-medium text-text-primary shadow-shadow-sm transition-all duration-150 hover:border-border hover:bg-surface-elevated hover:shadow-shadow-md active:scale-[0.98]"
            onClick={() => {}}
          >
            <Plus className="h-4 w-4 text-text-secondary transition-colors group-hover:text-primary" />
            <span>新建对话</span>
          </button>
        </ThreadListPrimitive.New>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto px-3 py-1">
        <ThreadListPrimitive.Items>
          {(itemCtx: any) => (
            <ThreadListItemPrimitive.Root
              asChild
              className="group relative mb-1 rounded-lg"
            >
              <button className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-text-primary rounded-lg border border-transparent hover:border-border/50 hover:bg-surface-primary/50 data-[active=true]:border-border/70 data-[active=true]:bg-surface-primary data-[active=true]:shadow-shadow-sm transition-all duration-150">
                <MessageSquare className="h-4 w-4 shrink-0 text-text-tertiary group-data-[active=true]:text-primary" />

                {/* 点一下就切到这个 thread */}
                <ThreadListItemPrimitive.Trigger asChild>
                  <span className="flex-1 cursor-pointer truncate font-medium">
                    <ThreadListItemPrimitive.Title />
                  </span>
                </ThreadListItemPrimitive.Trigger>

                {/* ⋯ 更多操作：rename / archive / delete */}
                <span className="shrink-0 opacity-0 group-hover:opacity-100 group-data-[active=true]:opacity-100 transition-opacity duration-150">
                  <ThreadListItemMorePrimitive.Root>
                    <button className="rounded-md p-1 text-text-tertiary hover:bg-surface-secondary hover:text-text-primary transition-colors">
                      <MoreHorizontal className="h-4 w-4" />
                    </button>
                  </ThreadListItemMorePrimitive.Root>
                </span>
              </button>
            </ThreadListItemPrimitive.Root>
          )}
        </ThreadListPrimitive.Items>
      </div>
    </div>
  );
}
