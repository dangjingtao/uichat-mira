"use client";
import {
  AssistantRuntimeProvider,
  useLocalRuntime,
  useRemoteThreadListRuntime,
  InMemoryThreadListAdapter,
} from "@assistant-ui/react";
import type { ChatModelAdapter } from "@assistant-ui/react";
import { ReactNode } from "react";

/**
 * 这里可以先继续用你之前的 ollamaAdapter / 自己的后端 adapter
 */
const chatAdapter: ChatModelAdapter = {
  async *run({ messages, abortSignal }) {
    // TODO: 替换成你 Ollama / 自定义后端的真实 fetch+yield
    // 下面是个“假流式”占位，让你立刻能看到侧边栏工作
    const reply = "（你还没接入后端；先占位）";
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
