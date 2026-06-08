import { useMemo } from "react";
import { Thread, type SuggestionConfig } from "@assistant-ui/react-ui";
import type { AssistantRuntime } from "@assistant-ui/react";
import {
  AssistantRuntimeImpl,
  LocalRuntimeCore,
} from "@assistant-ui/core/internal";
import { useAuth } from "@/app/providers/AuthProvider";
import { useRuntimeHealth } from "@/features/system/hooks/useRuntimeHealth";
import { localChatModel } from "../../../app/layouts/lib/localChatModel";

import { ThreadListSidebar } from "../components/ThreadListSidebar";

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

const defaultSuggestions: SuggestionConfig[] = [
  { prompt: "帮我总结今天的任务重点" },
  { prompt: "给我一个 RAG 系统排障清单" },
  { prompt: "设计一个接口联调计划" },
];

function ChatPage() {
  const { session, logout } = useAuth();
  const { backendState } = useRuntimeHealth();

  const runtime = useMemo<AssistantRuntime>(() => {
    const core = new LocalRuntimeCore(
      {
        maxSteps: 2,
        adapters: {
          chatModel: localChatModel,
        },
      },
      undefined,
    );

    return new AssistantRuntimeImpl(core);
  }, []);

  const backendStatusLabel = useMemo(
    () => statusTextMap[backendState.status],
    [backendState.status],
  );

  const backendStatusColorClass = useMemo(
    () => statusColorMap[backendState.status],
    [backendState.status],
  );

  if (!session) {
    return null;
  }

  return (
    <div>
      {/* <ThreadListSidebar /> */}
      <div className="flex-1 min-w-0">
        <Thread
          // runtime={runtime}
          welcome={{
            message: "你好，我是 UI Chat RAG 助手。请输入你的问题。",
            suggestions: defaultSuggestions,
          }}
          strings={{
            composer: {
              input: {
                placeholder: "输入问题，回车发送...",
              },
            },
          }}
        />
      </div>
    </div>
  );
}

export default ChatPage;
