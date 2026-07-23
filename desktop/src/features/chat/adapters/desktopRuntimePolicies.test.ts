import assert from "node:assert/strict";
import { test } from "vitest";
import {
  createDesktopComposerActions,
  createDesktopThreadCreationPolicy,
  desktopThreadSelectionPolicy,
} from "../core/runtimePolicies";
import type { ChatRuntimeState, ChatThread } from "@/shared/uchat/core";

const createThread = (overrides: Partial<ChatThread> = {}): ChatThread => ({
  id: overrides.id ?? "thread-1",
  title: overrides.title ?? "Thread 1",
  createdAt: overrides.createdAt ?? "2025-01-01T00:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2025-01-01T00:00:00.000Z",
  messages: overrides.messages ?? [],
  metadata: overrides.metadata,
});

const createState = (
  overrides: Partial<ChatRuntimeState> = {},
): ChatRuntimeState => ({
  threads: overrides.threads ?? [],
  activeThreadId: overrides.activeThreadId ?? null,
  composer: overrides.composer ?? {
    text: "",
    attachments: [],
  },
  composerDrafts: overrides.composerDrafts ?? {},
  threadListStatus: overrides.threadListStatus ?? "idle",
  threadStatus: overrides.threadStatus ?? "idle",
  runStatus: overrides.runStatus ?? { type: "idle" },
  hydratedThreadIds: overrides.hydratedThreadIds ?? [],
  capabilities: overrides.capabilities ?? {
    attachments: true,
    composerActions: [],
    messagePresentation: {},
  },
});

test("desktop thread selection policy keeps startup in empty-thread state", () => {
  assert.deepEqual(desktopThreadSelectionPolicy, {
    autoSelectAfterLoad: "none",
    hydrateOnSelect: true,
  });
});

test("desktop thread creation policy does not reuse the latest empty persisted thread", () => {
  const policy = createDesktopThreadCreationPolicy({});

  const reusableThreadId = policy.findReusableThread?.(
    createState({
      threads: [
        createThread({
          id: "thread-old",
          updatedAt: "2025-01-01T00:00:00.000Z",
          messages: [
            {
              id: "message-1",
              threadId: "thread-old",
              role: "user",
              parts: [{ type: "text", text: "hello" }],
              createdAt: "2025-01-01T00:00:00.000Z",
              parentId: null,
              status: "complete",
            },
          ],
        }),
        createThread({
          id: "thread-empty",
          updatedAt: "2025-01-02T00:00:00.000Z",
          messages: [],
        }),
      ],
    }),
  );

  assert.equal(reusableThreadId, undefined);
});

test("desktop thread creation policy does not reuse a thread with messages", () => {
  const policy = createDesktopThreadCreationPolicy({});

  const reusableThreadId = policy.findReusableThread?.(
    createState({
      threads: [
        createThread({
          id: "thread-empty-old",
          updatedAt: "2025-01-01T00:00:00.000Z",
          messages: [],
        }),
        createThread({
          id: "thread-used",
          updatedAt: "2025-01-02T00:00:00.000Z",
          messages: [
            {
              id: "message-1",
              threadId: "thread-used",
              role: "user",
              parts: [{ type: "text", text: "hello" }],
              createdAt: "2025-01-01T00:00:00.000Z",
              parentId: null,
              status: "complete",
            },
          ],
        }),
      ],
    }),
  );

  assert.equal(reusableThreadId, undefined);
});

test("desktop thread creation policy ignores older empty threads", () => {
  const policy = createDesktopThreadCreationPolicy({});

  const reusableThreadId = policy.findReusableThread?.(
    createState({
      threads: [
        createThread({
          id: "thread-empty-old",
          updatedAt: "2025-01-01T00:00:00.000Z",
          messages: [],
        }),
        createThread({
          id: "thread-newest-used",
          updatedAt: "2025-01-03T00:00:00.000Z",
          messages: [
            {
              id: "message-1",
              threadId: "thread-newest-used",
              role: "user",
              parts: [{ type: "text", text: "hello" }],
              createdAt: "2025-01-03T00:00:00.000Z",
              parentId: null,
              status: "complete",
            },
          ],
        }),
      ],
    }),
  );

  assert.equal(reusableThreadId, undefined);
});

test("desktop thread creation policy forwards draft knowledgeBaseId and roleId into create metadata", () => {
  const policy = createDesktopThreadCreationPolicy(() => ({
    knowledgeBaseId: "kb-1",
    roleId: "role-1",
  }));

  assert.deepEqual(policy.buildCreateInput?.(createState()), {
    metadata: {
      knowledgeBaseId: "kb-1",
      roleId: "role-1",
    },
  });
});

test("desktop thread creation policy keeps roleId on welcome-state drafts", () => {
  const policy = createDesktopThreadCreationPolicy(() => ({
    roleId: "role-welcome",
  }));

  assert.deepEqual(policy.buildCreateInput?.(createState()), {
    metadata: {
      roleId: "role-welcome",
    },
  });
});

test("desktop thread creation policy forwards welcome media switches", () => {
  const policy = createDesktopThreadCreationPolicy(() => ({
    ttsEnabled: true,
    imageEnabled: true,
  }));

  assert.deepEqual(policy.buildCreateInput?.(createState()), {
    metadata: {
      ttsEnabled: true,
      imageEnabled: true,
    },
  });
});

test("desktop composer actions keep knowledge base picker visible even when no knowledge base exists", () => {
  const actions = createDesktopComposerActions({});

  assert.deepEqual(
    actions.map((action) => ({
      id: action.id,
      disabled: action.disabled ?? false,
    })),
    [
      { id: "upload-image", disabled: false },
      { id: "role-picker", disabled: false },
      { id: "knowledge-base-picker", disabled: false },
      { id: "context-summary", disabled: false },
      { id: "workspace-actions", disabled: false },
    ],
  );

  assert.deepEqual(actions[0], {
    id: "upload-image",
    kind: "attachment",
    label: "Add image or file",
    title: "Add image or file",
    accept: ".png,.jpg,.jpeg,.webp,.gif,.bmp,.avif,.txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.yaml,.yml,.xml,.ini,.conf,.cfg,.env,.html,.css,.scss,.less,.log,.js,.jsx,.mjs,.cjs,.ts,.tsx,.py,.java,.kt,.go,.rs,.sh,.bash,.zsh,.ps1,.bat,.cmd,.sql,.toml,.properties,.gitignore,.npmrc,.editorconfig,.pdf,.docx,.pptx,.xlsx",
    multiple: true,
  });
});

test("desktop composer actions enable the knowledge base picker when data exists", () => {
  const actions = createDesktopComposerActions({
    knowledgeBases: [
      {
        id: "kb-1",
        name: "KB 1",
        description: "Demo",
        status: "ready",
        documentCount: 3,
        enabledDocumentCount: 2,
        createdAt: "2025-01-01T00:00:00.000Z",
        updatedAt: "2025-01-01T00:00:00.000Z",
      },
    ],
  });

  assert.equal(
    actions.find((action) => action.id === "knowledge-base-picker")?.disabled,
    undefined,
  );
});
