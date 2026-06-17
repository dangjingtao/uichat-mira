import { ChatModelAdapter, ThreadMessage } from "@assistant-ui/react";
import i18n from "@/shared/i18n";

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
            text: `${i18n.t("chat.localModel.replyPrefix", { prompt: latestPrompt })}\n\n${i18n.t("chat.localModel.replySuffix")}`,
          },
        ]
      : [
          {
            type: "text" as const,
            text: i18n.t("chat.localModel.greeting"),
          },
        ];

    return {
      content,
    };
  },
};
