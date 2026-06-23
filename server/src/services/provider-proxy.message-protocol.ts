export interface ProxyChatMessagePartInput {
  /** Canonical text part used by the desktop frontend. */
  type: "text";
  text: string;
}

export interface ProxyChatImagePartInput {
  /** Canonical image part used by the desktop frontend. */
  type: "image";
  image: string;
  fileId?: string;
  filename?: string;
  mediaType?: string;
}

export interface ProxyChatFilePartInput {
  /** Canonical file part used by the desktop frontend. */
  type: "file";
  filename: string;
  data: string;
  fileId?: string;
  mimeType: string;
}

export type ProxyChatMessagePart =
  | ProxyChatMessagePartInput
  | ProxyChatImagePartInput
  | ProxyChatFilePartInput;

export interface ProxyChatMessageInput {
  /** Only the unified frontend protocol is accepted here. */
  id?: string;
  role: "system" | "user" | "assistant";
  parts: ProxyChatMessagePart[];
}

export type NormalizedChatMessagePart =
  | {
      type: "text";
      text: string;
    }
  | {
      type: "image";
      image: string;
      fileId?: string;
      filename?: string;
      mediaType?: string;
    }
  | {
      type: "file";
      data: string;
      filename: string;
      fileId?: string;
      mimeType: string;
    };

export type NormalizedChatMessage = {
  id?: string;
  role: "system" | "user" | "assistant";
  content: string;
  parts?: NormalizedChatMessagePart[];
};

export const getNormalizedMessageText = (
  message: Pick<NormalizedChatMessage, "parts"> | undefined,
) =>
  (message?.parts ?? [])
    .filter(
      (part): part is Extract<NormalizedChatMessagePart, { type: "text" }> =>
        part.type === "text",
    )
    .map((part) => part.text)
    .join("\n")
    .trim();

export const hasNormalizedMessageParts = (
  message: Pick<NormalizedChatMessage, "parts"> | undefined,
) => (message?.parts?.length ?? 0) > 0;

export const hasNormalizedTextPart = (
  message: Pick<NormalizedChatMessage, "parts"> | undefined,
) => getNormalizedMessageText(message).length > 0;

const normalizeTextPart = (
  part: ProxyChatMessagePart,
): NormalizedChatMessagePart | null => {
  if (part.type !== "text") {
    return null;
  }

  return part.text.trim() ? { type: "text", text: part.text } : null;
};

const normalizeImagePart = (
  part: ProxyChatMessagePart,
): NormalizedChatMessagePart | null => {
  if (part.type !== "image") {
    return null;
  }

  const image = part.image.trim();
  if (!image) {
    return null;
  }

  return {
    type: "image",
    image: part.image,
    ...(part.fileId?.trim() ? { fileId: part.fileId.trim() } : {}),
    ...(part.filename ? { filename: part.filename } : {}),
    mediaType: part.mediaType?.trim() || "image/*",
  };
};

const normalizeFilePart = (
  part: ProxyChatMessagePart,
): NormalizedChatMessagePart | null => {
  if (part.type !== "file") {
    return null;
  }

  const filename = part.filename.trim();
  if (!filename) {
    return null;
  }

  const data = part.data.trim();
  const fileId =
    typeof part.fileId === "string" ? part.fileId.trim() : undefined;

  if (!data) {
    return null;
  }

  return {
    type: "file",
    filename: part.filename,
    data: part.data,
    ...(fileId ? { fileId } : {}),
    mimeType: part.mimeType.trim() || "application/octet-stream",
  };
};

const normalizePart = (
  part: ProxyChatMessagePart,
): NormalizedChatMessagePart | null => {
  return (
    normalizeTextPart(part) ??
    normalizeImagePart(part) ??
    normalizeFilePart(part)
  );
};

const getPartSummary = (part: NormalizedChatMessagePart) => {
  if (part.type === "text") {
    return part.text;
  }

  if (part.type === "image") {
    if (part.fileId) {
      return part.filename
        ? `[Image attachment: ${part.filename} (${part.fileId})]`
        : `[Image attachment: ${part.fileId}]`;
    }

    return part.filename
      ? `[Image attachment: ${part.filename}]`
      : "[Image attachment]";
  }

  if (part.type === "file" && part.fileId) {
    return `[File attachment: ${part.filename} (${part.fileId})]`;
  }

  return `[File attachment: ${part.filename}]`;
};

/**
 * Normalize the single app-owned frontend protocol into provider-ready
 * messages. This is intentionally strict: no legacy `content`, no mixed file
 * parts, and no obsolete transport fallbacks.
 */
export const normalizeProxyChatMessages = (
  messages: ProxyChatMessageInput[],
): NormalizedChatMessage[] =>
  messages.reduce<NormalizedChatMessage[]>((result, message) => {
    const parts = message.parts
      .map((part) => normalizePart(part))
      .filter((part): part is NormalizedChatMessagePart => Boolean(part));

    if (parts.length === 0) {
      return result;
    }

    const content = getNormalizedMessageText({ parts });

    result.push({
      ...(typeof message.id === "string" ? { id: message.id } : {}),
      role: message.role,
      content,
      parts,
    });

    return result;
  }, []);
