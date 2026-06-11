// src/assistant/ThreadListSidebar.tsx
"use client";
import { MoreHorizontal } from "lucide-react";
import {
  ThreadListPrimitive,
  ThreadListItemPrimitive,
  ThreadListItemMorePrimitive,
} from "@assistant-ui/react";

export function ThreadListSidebar() {
  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-2 pb-2 pt-1">
        <ThreadListPrimitive.New className="flex h-9 w-full cursor-pointer items-center justify-center rounded-lg border border-border bg-surface-primary px-3 text-sm font-medium text-text-primary shadow-shadow-sm transition-all duration-150 hover:border-primary/30 hover:bg-surface-secondary hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-secondary">
          新建对话
        </ThreadListPrimitive.New>
      </div>

      <div className="min-h-0 flex-1 px-1.5 py-2">
        <ThreadListPrimitive.Root className="flex h-full flex-col">
          <div className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-[0.12em] text-text-tertiary">
            Recent
          </div>

          <div className="stable-scrollbar min-h-0 flex-1 overflow-y-auto pr-0.5">
            <ThreadListPrimitive.Items>
              {() => (
                <ThreadListItemPrimitive.Root className="group relative mb-1 flex items-center rounded-lg border border-transparent px-1 py-0.5 text-text-secondary transition-all duration-150 hover:border-border hover:bg-surface-primary hover:text-text-primary hover:shadow-shadow-sm data-[active=true]:border-border data-[active=true]:bg-surface-primary data-[active=true]:text-text-primary data-[active=true]:shadow-shadow-sm">
                  <span className="pointer-events-none absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary opacity-0 transition-opacity duration-150 group-data-[active=true]:opacity-100" />

                  <ThreadListItemPrimitive.Trigger className="flex min-w-0 flex-1 rounded-lg px-2.5 py-1.5 text-left focus-visible:outline-none">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium leading-5">
                        <ThreadListItemPrimitive.Title fallback="新对话" />
                      </span>
                    </span>
                  </ThreadListItemPrimitive.Trigger>

                  <ThreadListItemMorePrimitive.Root>
                    <ThreadListItemMorePrimitive.Trigger className="mr-1 flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-transparent text-text-tertiary opacity-0 transition-all duration-150 hover:border-border hover:bg-surface-secondary hover:text-text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 group-hover:opacity-100 group-data-[active=true]:opacity-100">
                      <MoreHorizontal className="size-4" />
                    </ThreadListItemMorePrimitive.Trigger>
                    <ThreadListItemMorePrimitive.Content className="min-w-[128px] rounded-xl border border-border bg-surface-primary p-1.5 shadow-lg">
                      <ThreadListItemPrimitive.Archive asChild>
                        <ThreadListItemMorePrimitive.Item className="flex w-full cursor-pointer items-center rounded-lg px-2.5 py-1.5 text-sm text-text-primary transition-colors duration-150 hover:bg-surface-secondary">
                          归档
                        </ThreadListItemMorePrimitive.Item>
                      </ThreadListItemPrimitive.Archive>
                      <ThreadListItemPrimitive.Delete asChild>
                        <ThreadListItemMorePrimitive.Item className="flex w-full cursor-pointer items-center rounded-lg px-2.5 py-1.5 text-sm text-danger transition-colors duration-150 hover:bg-danger/10">
                          删除
                        </ThreadListItemMorePrimitive.Item>
                      </ThreadListItemPrimitive.Delete>
                    </ThreadListItemMorePrimitive.Content>
                  </ThreadListItemMorePrimitive.Root>
                </ThreadListItemPrimitive.Root>
              )}
            </ThreadListPrimitive.Items>
          </div>
        </ThreadListPrimitive.Root>
      </div>
    </div>
  );
}
