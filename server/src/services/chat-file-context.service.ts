import { getHarnessEnvironmentSnapshot } from "@/harness/environment.js";
import { readStructuredDocument } from "@/mcp/document-readers.js";
import path from "node:path";
import { attachmentStorageService } from "./attachment-storage.service.js";
import type {
  NormalizedChatMessage,
  NormalizedChatMessagePart,
} from "./provider-proxy.message-protocol.js";

type FilePart = Extract<NormalizedChatMessagePart, { type: "file" }>;

const getAttachmentFileName = (source: string) => {
  if (!attachmentStorageService.isInternalAttachmentUrl(source)) {
    return null;
  }

  const parsed = new URL(source, "http://localhost");
  return decodeURIComponent(parsed.pathname.slice("/attachments/".length));
};

const resolveFileText = async (part: FilePart) => {
  const fileName = getAttachmentFileName(part.data);
  if (!fileName) {
    throw new Error(`File attachment is not managed by the local parser: ${part.filename}`);
  }

  const filePath = path.join(attachmentStorageService.root, fileName);
  const parsed = await readStructuredDocument(
    getHarnessEnvironmentSnapshot(),
    filePath,
  );

  return processParsedFile({
    text: [
    `[文件: ${part.filename}]`,
    `[类型: ${part.mimeType}]`,
    parsed.text,
    `[文件结束: ${part.filename}]`,
    ].join("\n"),
  });
};

// The first file-context node deliberately preserves the parser output. It is
// a replaceable boundary for future file-aware processing without changing
// upload, persistence, or provider contracts.
const processParsedFile = (input: { text: string }) => input.text;

export const resolveMessagesForGenerate = async (
  messages: NormalizedChatMessage[],
) => {
  const latestUserIndex = [...messages]
    .map((message, index) => ({ message, index }))
    .reverse()
    .find((entry) => entry.message.role === "user")?.index;

  if (latestUserIndex === undefined) {
    return messages;
  }

  const latestUserMessage = messages[latestUserIndex];
  if (!latestUserMessage?.parts?.some((part) => part.type === "file")) {
    return messages;
  }

  const fileContext = await Promise.all(
    latestUserMessage.parts
      .filter((part): part is FilePart => part.type === "file")
      .map(resolveFileText),
  );

  const textPart = fileContext.join("\n\n");
  const nextParts = latestUserMessage.parts
    .filter((part) => part.type !== "file")
    .concat({ type: "text", text: textPart });

  return messages.map((message, index) =>
    index === latestUserIndex ? { ...message, content: nextParts.filter((part) => part.type === "text").map((part) => part.text).join("\n"), parts: nextParts } : message,
  );
};

export const removeFileAttachmentsFromParts = (parts: unknown) => {
  if (!Array.isArray(parts)) {
    return;
  }

  for (const part of parts) {
    if (!part || typeof part !== "object" || (part as { type?: unknown }).type !== "file") {
      continue;
    }

    const source = (part as { data?: unknown }).data;
    if (typeof source !== "string" || !attachmentStorageService.isInternalAttachmentUrl(source)) {
      continue;
    }

    const fileName = getAttachmentFileName(source);
    if (fileName) {
      attachmentStorageService.removeSync(fileName);
    }
  }
};
