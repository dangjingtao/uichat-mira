import type {
  ChatFilePart,
  ChatImagePart,
  ChatMessage,
  ChatMessagePart,
  ChatRequestBody,
  CreateChatRequestOptions,
  RuntimeMessageLike,
  RuntimeMessagePartLike,
} from "./types";

export const isImageMimeType = (mimeType: string | undefined) =>
  typeof mimeType === "string" && mimeType.trim().startsWith("image/");

export const getRuntimeMessageParts = (
  message: RuntimeMessageLike | null | undefined,
) => {
  const parts = Array.isArray(message?.parts) ? message.parts : [];
  const attachmentParts = Array.isArray(message?.attachments)
    ? message.attachments.flatMap((attachment) =>
        Array.isArray(attachment.content) ? attachment.content : [],
      )
    : [];

  return [...parts, ...attachmentParts];
};

const getPartResource = (part: RuntimeMessagePartLike) => {
  if (typeof part.image === "string" && part.image.trim()) {
    return part.image.trim();
  }

  if (typeof part.data === "string" && part.data.trim()) {
    return part.data.trim();
  }

  return "";
};

export const toChatMessagePart = (
  part: RuntimeMessagePartLike,
): ChatMessagePart | null => {
  if (part?.type === "text" && typeof part.text === "string") {
    const text = part.text.trim();
    return text ? { type: "text", text } : null;
  }

  const mimeType = part.mimeType?.trim() || part.mediaType?.trim();

  if (
    part?.type === "image" ||
    (part?.type === "file" && isImageMimeType(mimeType))
  ) {
    const image = getPartResource(part);
    if (!image) {
      return null;
    }

    const imagePart: ChatImagePart = {
      type: "image",
      image,
      ...(part.filename ? { filename: part.filename } : {}),
      ...(part.fileId ? { fileId: part.fileId } : {}),
      ...(mimeType ? { mediaType: mimeType } : {}),
    };

    return imagePart;
  }

  if (part?.type === "file") {
    const data = getPartResource(part);
    if (!data) {
      return null;
    }

    const filePart: ChatFilePart = {
      type: "file",
      data,
      filename: part.filename?.trim() || "attachment",
      ...(part.fileId ? { fileId: part.fileId } : {}),
      mimeType: mimeType || "application/octet-stream",
    };

    return filePart;
  }

  return null;
};

export const hasRuntimeAttachmentParts = (message: RuntimeMessageLike) =>
  getRuntimeMessageParts(message).some((part) => {
    const mimeType = part.mimeType?.trim() || part.mediaType?.trim();
    return (
      part?.type === "image" ||
      part?.type === "file" ||
      isImageMimeType(mimeType)
    );
  });

export const trimHistoricalAttachmentMessages = <
  TMessage extends RuntimeMessageLike,
>(
  messages: readonly TMessage[],
) => {
  const latestUserIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find(({ message }) => message.role === "user")?.index;

  if (latestUserIndex === undefined) {
    return messages;
  }

  return messages.map((message, index) => {
    if (index === latestUserIndex || !hasRuntimeAttachmentParts(message)) {
      return message;
    }

    return {
      ...message,
      parts: getRuntimeMessageParts(message).filter((part) => {
        const mimeType = part.mimeType?.trim() || part.mediaType?.trim();
        return !(
          part?.type === "image" ||
          part?.type === "file" ||
          isImageMimeType(mimeType)
        );
      }),
    };
  });
};

export const getLatestUserMessageId = (
  messages: readonly RuntimeMessageLike[],
) => {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "user" && typeof message.id === "string") {
      return message.id;
    }
  }

  return undefined;
};

export const toChatMessages = (
  messages: readonly RuntimeMessageLike[],
): ChatMessage[] =>
  messages.reduce<ChatMessage[]>((result, message) => {
    if (
      message.role !== "system" &&
      message.role !== "user" &&
      message.role !== "assistant"
    ) {
      return result;
    }

    const parts = getRuntimeMessageParts(message)
      .map((part) => toChatMessagePart(part))
      .filter((part): part is ChatMessagePart => Boolean(part));

    if (parts.length === 0) {
      return result;
    }

    result.push({
      ...(typeof message.id === "string" ? { id: message.id } : {}),
      role: message.role,
      parts,
    });

    return result;
  }, []);

export const createChatRequestBody = (
  messages: readonly RuntimeMessageLike[],
  options?: CreateChatRequestOptions,
): ChatRequestBody => {
  const preparedMessages =
    options?.historyPolicy === "none"
      ? [...messages]
      : trimHistoricalAttachmentMessages(messages);
  const messageId = getLatestUserMessageId(preparedMessages);

  return {
    ...(options?.baseBody ?? {}),
    ...(options?.threadId ? { id: options.threadId } : {}),
    ...(messageId ? { messageId } : {}),
    messages: toChatMessages(preparedMessages),
  };
};
