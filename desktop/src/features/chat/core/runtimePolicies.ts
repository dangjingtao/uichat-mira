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
          workspaceId?: string | null;
          knowledgeBaseId?: string | null;
          roleId?: string | null;
          agentEnabled?: boolean | null;
        }
      | undefined,
  ): ChatThreadCreationPolicy => ({
    buildCreateInput() {
      const createInput = getCreateThreadInput?.();
      const metadata: Record<string, unknown> = {};

      if (
        createInput &&
        (typeof createInput.workspaceId === "string" ||
          createInput.workspaceId === null)
      ) {
        metadata.workspaceId = createInput.workspaceId;
      }

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

      if (
        createInput &&
        (typeof createInput.agentEnabled === "boolean" ||
          createInput.agentEnabled === null)
      ) {
        metadata.agentEnabled = createInput.agentEnabled;
      }

      return Object.keys(metadata).length > 0 ? { metadata } : undefined;
    },
  });

export const desktopThreadSelectionPolicy: ChatThreadSelectionPolicy = {
  autoSelectAfterLoad: "none",
  hydrateOnSelect: true,
};

export const desktopSendLifecyclePolicy: ChatSendLifecyclePolicy = {};

const windowsAbsolutePathPattern = /^[a-zA-Z]:[\\/](?:.*)?$/;
const windowsUncPathPattern = /^\\\\[^\\\/]+[\\\/][^\\\/]+/;
const unixAbsolutePathPattern = /^\//;

export const isValidWorkspaceRootPath = (value: string, platform: string) => {
  const rootPath = value.trim();
  if (!rootPath) {
    return false;
  }

  const isWindowsAbsolutePath =
    windowsAbsolutePathPattern.test(rootPath) ||
    windowsUncPathPattern.test(rootPath);
  const isUnixAbsolutePath = unixAbsolutePathPattern.test(rootPath);

  if (platform === "win32") {
    return isWindowsAbsolutePath;
  }

  if (platform === "browser") {
    return isWindowsAbsolutePath || isUnixAbsolutePath;
  }

  return isUnixAbsolutePath;
};

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
    title: "Open knowledge base picker",
  },
  {
    id: "context-summary",
    kind: "command",
    label: "Context summary",
    title: "Open thread context summary",
  },
  {
    id: "workspace-actions",
    kind: "menu",
    label: "Workspace",
    title: "Workspace actions",
    children: [
      {
        id: "workspace-add-thread",
        kind: "command",
        label: "Add to workspace",
        title: "Add thread to workspace",
      },
      {
        id: "workspace-create",
        kind: "command",
        label: "Create workspace",
        title: "Create workspace",
      },
    ],
  },
];

export const desktopMessagePresentationHints: ChatMessagePresentationHints = {
  preferMarkdownForText: true,
  assistantMaxWidth: "regular",
  userMaxWidth: "regular",
};
