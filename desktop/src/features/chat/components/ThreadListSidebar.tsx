"use client";
import { MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  ThreadListPrimitive,
  ThreadListItemPrimitive,
  ThreadListItemMorePrimitive,
} from "@assistant-ui/react";

export function ThreadListSidebar() {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-transparent">
      <div className="shrink-0 px-2 pb-2 pr-4 pt-0">
        <ThreadListPrimitive.New className="flex h-8 w-full cursor-pointer items-center justify-start rounded-[10px] bg-transparent px-3 text-sm font-medium text-text-primary transition-all duration-150 hover:bg-[rgb(var(--color-primary)/0.045)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 focus-visible:ring-offset-2 focus-visible:ring-offset-surface-primary">
          {t("chat.sidebar.newConversation")}
        </ThreadListPrimitive.New>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden px-2 py-3">
        <ThreadListPrimitive.Root className="flex h-full min-h-0 flex-col overflow-hidden">
          <div className="h-0 min-h-0 flex-1 overflow-y-auto overscroll-contain pr-0.5">
            <ThreadListPrimitive.Items>
              {() => (
                <ThreadListItemPrimitive.Root className="group relative mb-0.5 flex items-center px-0.5 py-0 text-text-secondary transition-all duration-150 hover:bg-[rgb(var(--color-primary)/0.04)] hover:text-text-primary data-[active=true]:bg-[rgb(var(--color-primary)/0.055)] data-[active=true]:text-text-primary">
                  <span className="pointer-events-none absolute inset-y-1 left-0 w-[2px] rounded-full bg-primary/85 opacity-0 transition-opacity duration-150 group-data-[active=true]:opacity-100" />

                  <ThreadListItemPrimitive.Trigger className="flex min-w-0 flex-1 px-4 py-2 text-left focus-visible:outline-none">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm leading-5">
                        <ThreadListItemPrimitive.Title
                          fallback={t("chat.sidebar.untitledConversation")}
                        />
                      </span>
                    </span>
                  </ThreadListItemPrimitive.Trigger>

                  <ThreadListItemMorePrimitive.Root>
                    <ThreadListItemMorePrimitive.Trigger className="mr-0.5 flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center text-text-tertiary opacity-0 transition-all duration-150 hover:text-text-primary focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/20 group-hover:opacity-100 group-data-[active=true]:opacity-100">
                      <MoreHorizontal className="size-4" />
                    </ThreadListItemMorePrimitive.Trigger>
                    <ThreadListItemMorePrimitive.Content className="z-[140] min-w-[128px] rounded-[10px] border border-border bg-surface-elevated p-1 shadow-shadow-md">
                      <ThreadListItemPrimitive.Archive asChild>
                        <ThreadListItemMorePrimitive.Item className="flex w-full cursor-pointer items-center rounded-[8px] px-2.5 py-1.5 text-sm text-text-primary transition-colors duration-150 hover:bg-surface-secondary">
                          {t("chat.sidebar.archive")}
                        </ThreadListItemMorePrimitive.Item>
                      </ThreadListItemPrimitive.Archive>
                      <ThreadListItemPrimitive.Delete asChild>
                        <ThreadListItemMorePrimitive.Item className="flex w-full cursor-pointer items-center rounded-[8px] px-2.5 py-1.5 text-sm text-danger-text transition-colors duration-150 hover:bg-danger-soft">
                          {t("chat.sidebar.delete")}
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
