import type {
  ChatComposerAction,
  ChatMessagePresentationHints,
  ChatSendLifecyclePolicy,
  ChatThreadCreationPolicy,
  ChatThreadSelectionPolicy,
} from "@/shared/uchat/core";
import type { KnowledgeBaseSummary } from "@/shared/api/knowledgeBase";

export type DesktopChatRuntimePolicyOptions = {
  knowledgeBases?: KnowledgeBaseSummary[];
};

// These policies centralize current desktop chat behavior without polluting
// uchat core with app-specific defaults.
export const createDesktopThreadCreationPolicy =
  (
    getCreateThreadInput?: () =>
      | {
          knowledgeBaseId?: string | null;
          roleId?: string | null;
        }
      | undefined,
  ): ChatThreadCreationPolicy => ({
    buildCreateInput() {
      const createInput = getCreateThreadInput?.();
      const metadata: Record<string, unknown> = {};

      if (
        createInput &&
        (typeof createInput.knowledgeBaseId === "string" ||
          createInput.knowledgeBaseId === null)
      ) {
        metadata.knowledgeBaseId = createInput.knowledgeBaseId;
      }

      if (
        createInput &&
        (typeof createInput.roleId === "string" || createInput.roleId === null)
      ) {
        metadata.roleId = createInput.roleId;
      }

      return Object.keys(metadata).length > 0 ? { metadata } : undefined;
    },
  });

export const desktopThreadSelectionPolicy: ChatThreadSelectionPolicy = {
  autoSelectAfterLoad: "none",
  hydrateOnSelect: true,
};

export const desktopSendLifecyclePolicy: ChatSendLifecyclePolicy = {};

export const createDesktopComposerActions = ({
  knowledgeBases = [],
}: DesktopChatRuntimePolicyOptions): ChatComposerAction[] => [
  {
    id: "upload-image",
    kind: "attachment",
    label: "Add image",
    title: "Add image",
    accept: ".png,.jpg,.jpeg,.webp,.gif,.bmp,.avif",
    multiple: true,
    attachmentKind: "image",
  },
  {
    id: "role-picker",
    kind: "command",
    label: "Role",
    title: "Open role picker",
  },
  {
    id: "knowledge-base-picker",
    kind: "command",
    label: "Knowledge base",
    title:
      knowledgeBases.length > 0
        ? "Open knowledge base picker"
        : "No knowledge bases available",
    disabled: knowledgeBases.length === 0,
  },
  {
    id: "context-summary",
    kind: "command",
    label: "Context summary",
    title: "Open thread context summary",
  },
];

export const desktopMessagePresentationHints: ChatMessagePresentationHints = {
  preferMarkdownForText: true,
  assistantMaxWidth: "regular",
  userMaxWidth: "regular",
};
