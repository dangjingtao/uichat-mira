import type { ChatMessagePart } from "./types";

type ComposerAttachmentLike = {
  uploadedPart?: ChatMessagePart;
};

type ComposerDraftLike = {
  text: string;
  attachments: ComposerAttachmentLike[];
};

// Builds the canonical outgoing user parts from the current draft state.
// This stays pure so empty-send checks can be tested without runtime setup.
export const buildOutgoingUserParts = (
  composer: ComposerDraftLike,
): ChatMessagePart[] => {
  const text = composer.text.trim();
  const parts: ChatMessagePart[] = [];

  if (text) {
    parts.push({ type: "text", text });
  }

  for (const attachment of composer.attachments) {
    if (attachment.uploadedPart) {
      parts.push(attachment.uploadedPart);
    }
  }

  return parts;
};
