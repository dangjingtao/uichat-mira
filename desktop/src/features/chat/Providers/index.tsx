"use client";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  useRemoteThreadListRuntime,
  InMemoryThreadListAdapter,
} from "@assistant-ui/react";
import type { ChatModelAdapter } from "@assistant-ui/react";
import { ReactNode } from "react";
import i18n from "@/shared/i18n";

const chatAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    const reply = i18n.t("chat.provider.placeholderReply");
    for (const ch of reply) {
      await new Promise((r) => setTimeout(r, 18));
      yield { content: [{ type: "text", text: ch }] };
    }
  },
};

const adapter = new InMemoryThreadListAdapter();

function useAppRuntime() {
  // 每个 thread 的实际对话运行时会用这个
  const local = useLocalRuntime(chatAdapter);
  // 再加一层：多线程列表管理层
  return useRemoteThreadListRuntime({
    runtimeHook: () => local,
    adapter,
  });
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const runtime = useAppRuntime();
  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
