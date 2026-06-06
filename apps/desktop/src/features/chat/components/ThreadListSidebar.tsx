// src/assistant/ThreadListSidebar.tsx
"use client";
import {
  ThreadListPrimitive,
  ThreadListItemPrimitive,
  ThreadListItemMorePrimitive,
} from "@assistant-ui/react";

const statusTextMap = {
  unknown: "检测中",
  running: "运行中",
  stopped: "未启动",
} as const;

const statusColorMap = {
  unknown: "bg-amber-500",
  running: "bg-green-600",
  stopped: "bg-red-600",
} as const;

export function ThreadListSidebar() {
  return (
    <>
      {/* 新建对话 */}
      <div className="px-2 pt-2">
        <ThreadListPrimitive.New asChild>
          <button
            className="w-full flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-zinc-200 dark:hover:bg-zinc-800 transition"
            onClick={() => {}}
          >
            + New Chat
          </button>
        </ThreadListPrimitive.New>
      </div>

      {/* 列表 */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        <ThreadListPrimitive.Items>
          {(itemCtx: any) => (
            <ThreadListItemPrimitive.Root
              asChild
              className="group relative rounded-lg"
            >
              <button className="w-full text-left px-3 py-2 text-sm truncate rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 data-[active=true]:bg-zinc-200 dark:data-[active=true]:bg-zinc-800 transition">
                {/* 点一下就切到这个 thread */}
                <ThreadListItemPrimitive.Trigger asChild>
                  <span className="cursor-pointer">
                    <ThreadListItemPrimitive.Title />
                  </span>
                </ThreadListItemPrimitive.Trigger>

                {/* ⋯ 更多操作：rename / archive / delete */}
                <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 group-data-[active=true]:opacity-100 transition">
                  <ThreadListItemMorePrimitive.Root>
                    <button className="rounded-md p-1 hover:bg-zinc-300 dark:hover:bg-zinc-700">
                      ⋯
                    </button>
                  </ThreadListItemMorePrimitive.Root>
                </span>
              </button>
            </ThreadListItemPrimitive.Root>
          )}
        </ThreadListPrimitive.Items>
      </div>
    </>
  );
}
