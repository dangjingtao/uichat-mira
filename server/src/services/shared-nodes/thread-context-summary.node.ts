import { nowIso } from "@/utils/time.js";
import type { MessageResponse } from "@/services/thread.service.js";
import { ConversationTrimmer } from "@/services/conversation-trimmer.js";
import { llmSharedNode } from "./llm.node.js";

export interface ThreadContextSummaryResult {
  contextSummary: string;
  contextSummaryUpdatedAt: string;
}

const MAX_SUMMARY_MESSAGES = 24;
const MAX_PART_TEXT_LENGTH = 1200;

const describeMessage = (message: MessageResponse) => {
  const textParts = message.parts
    .filter(
      (part): part is Extract<MessageResponse["parts"][number], { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text.trim())
    .filter(Boolean);

  if (textParts.length > 0) {
    return ConversationTrimmer.trimText(
      textParts.join("\n"),
      MAX_PART_TEXT_LENGTH,
      { ellipsis: false },
    );
  }

  return ConversationTrimmer.trimText(
    message.parts
      .map((part) => {
        if (part.type === "image") {
          return part.filename?.trim() ? `[图片: ${part.filename.trim()}]` : "[图片]";
        }

        if (part.type === "file") {
          return `[文件: ${part.filename.trim()}]`;
        }

        return "";
      })
      .filter(Boolean)
      .join("\n"),
    MAX_PART_TEXT_LENGTH,
    { ellipsis: false },
  );
};

const buildTranscript = (messages: MessageResponse[]) =>
  ConversationTrimmer.take(messages, MAX_SUMMARY_MESSAGES, "tail")
    .map((message) => `${message.role === "user" ? "用户" : "助手"}: ${describeMessage(message)}`)
    .filter((line) => !line.endsWith(": "))
    .join("\n\n");

export const createThreadContextSummaryPrompt = (contextSummary: string) =>
  `以下是当前对话线程的上下文摘要。你必须把它当作本轮对话的隐式背景，但不要直接复述，也不要提到“根据摘要”或“根据系统提示”。\n\n线程摘要：\n${contextSummary}`;

export const threadContextSummaryNode = {
  createRequestContextMessage(contextSummary: string) {
    const normalized = contextSummary.trim();
    if (!normalized) {
      return null;
    }

    return {
      role: "system" as const,
      content: createThreadContextSummaryPrompt(normalized),
    };
  },

  async generate(messages: MessageResponse[]): Promise<ThreadContextSummaryResult> {
    const visibleMessages = messages.filter(
      (message) => message.role === "user" || message.role === "assistant",
    );

    if (visibleMessages.length === 0) {
      return {
        contextSummary: "",
        contextSummaryUpdatedAt: nowIso(),
      };
    }

    const transcript = buildTranscript(visibleMessages);
    const contextSummary = (
      await llmSharedNode.generateText({
        roleType: "task",
        requestedProvider: "default",
        operation: "task-chat",
        messages: [
          {
            role: "system",
            content:
              "你是一个对话上下文摘要节点。你的任务是把线程内已经发生的对话压缩成后续轮次可复用的隐式上下文。\n" +
              "输出要求：\n" +
              "1. 只保留后续对话真正需要的事实、约束、偏好、未完成事项和当前阶段结论。\n" +
              "2. 不要逐轮复述，不要加寒暄，不要写'用户说'、'助手说'这种流水账。\n" +
              "3. 不要虚构未发生的信息。\n" +
              "4. 用简洁中文输出，控制在 6 行以内。\n" +
              "5. 允许使用短标题或短条目，但不要输出 Markdown 代码块。",
          },
          {
            role: "user",
            content: `请为下面这段对话生成可复用的线程上下文摘要：\n\n${transcript}`,
          },
        ],
      })
    ).trim();

    return {
      contextSummary,
      contextSummaryUpdatedAt: nowIso(),
    };
  },
};
