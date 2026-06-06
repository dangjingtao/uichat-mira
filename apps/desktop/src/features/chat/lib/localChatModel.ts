import { ChatModelAdapter, ThreadMessage } from "@assistant-ui/react";

const getLatestUserText = (messages: readonly ThreadMessage[]) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index] as {
      role?: string;
      content?: readonly { type?: string; text?: string }[];
    };

    if (message.role !== "user" || !message.content) {
      continue;
    }

    const textPart = message.content.find((part) => part.type === "text");

    if (textPart?.text?.trim()) {
      return textPart.text.trim();
    }
  }

  return "";
};

export const localChatModel: ChatModelAdapter = {
  async run({ messages }) {
    const latestPrompt = getLatestUserText(messages);

    await new Promise((resolve) => {
      globalThis.setTimeout(resolve, 450);
    });

    const content = latestPrompt
      ? [
          {
            type: "text" as const,
            text: `已收到：${latestPrompt}\n\n这是 assistant-ui 本地演示回复。你可以继续输入问题，后续可直接替换为真实后端推理接口。`,
          },
        ]
      : [
          {
            type: "text" as const,
            text: "你好，我是你的 RAG 助手。请告诉我你想查询的内容。",
          },
        ];

    return {
      content,
    };
  },
};
