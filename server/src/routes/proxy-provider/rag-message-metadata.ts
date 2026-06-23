import type { NormalizedChatMessage } from "@/services/provider-proxy.message-protocol.js";

export const toUserMessageMetadata = (
  _message: NormalizedChatMessage | undefined,
  parentId: string | null,
) => {
  return {
    lineage: {
      parentId,
    },
  };
};
