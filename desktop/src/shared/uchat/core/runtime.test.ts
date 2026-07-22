import assert from "node:assert/strict";
import { test } from "vitest";
import { ChatRuntime } from "./runtime";
import type {
  ChatAttachmentDriver,
  ChatMessage,
  ChatRepository,
  ChatRunDriver,
  ChatThread,
  ChatThreadSummary,
  ChatRole,
  ChatMessagePart,
} from "./types";

const createThreadSummary = (
  overrides: Partial<ChatThreadSummary> = {},
): ChatThreadSummary => ({
  id: overrides.id ?? "thread-1",
  title: overrides.title ?? "Thread 1",
  createdAt: overrides.createdAt ?? "2025-01-01T00:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2025-01-01T00:00:00.000Z",
  metadata: overrides.metadata,
});

const createThread = (overrides: Partial<ChatThread> = {}): ChatThread => ({
  id: overrides.id ?? "thread-1",
  title: overrides.title ?? "Thread 1",
  createdAt: overrides.createdAt ?? "2025-01-01T00:00:00.000Z",
  updatedAt: overrides.updatedAt ?? "2025-01-01T00:00:00.000Z",
  messages: overrides.messages ?? [],
  metadata: overrides.metadata,
});

// The fake repository keeps tests focused on runtime behavior instead of any
// app-specific transport or persistence implementation.
function createRepositoryStub(input?: {
  summaries?: ChatThreadSummary[];
  thread?: ChatThread;
  updatedThread?: ChatThread;
  onGetThread?: () => void;
  onListThreads?: () => void;
  listThreadsImpl?: () => Promise<ChatThreadSummary[]> | ChatThreadSummary[];
  getThreadImpl?: () => Promise<ChatThread> | ChatThread;
  createMessageImpl?: (
    threadId: string,
    input: {
      id?: string;
      role: ChatRole;
      content: string;
      parentId?: string | null;
      parts?: ChatMessagePart[];
      metadata?: Record<string, unknown>;
    },
  ) => Promise<ChatMessage> | ChatMessage;
  onCreateThread?: (input?: {
    title?: string;
    metadata?: Record<string, unknown>;
  }) => void;
}): ChatRepository {
  const summaries = input?.summaries ?? [createThreadSummary()];
  const thread = input?.thread ?? createThread();
  const updatedThread =
    input?.updatedThread ??
    createThread({
      ...thread,
      title: "Updated Thread",
      updatedAt: "2025-01-02T00:00:00.000Z",
      metadata: {
        knowledgeBaseId: "kb-1",
      },
    });

  return {
    async listThreads() {
      input?.onListThreads?.();
      if (input?.listThreadsImpl) {
        return await input.listThreadsImpl();
      }
      return summaries;
    },
    async getThread() {
      input?.onGetThread?.();
      if (input?.getThreadImpl) {
        return await input.getThreadImpl();
      }
      return thread;
    },
    async createThread(createInput) {
      input?.onCreateThread?.(createInput);
      return createThread({
        id: "thread-created",
        title: "Created Thread",
      });
    },
    async createMessage(threadId, createInput) {
      if (input?.createMessageImpl) {
        return await input.createMessageImpl(threadId, createInput);
      }
      const baseThread = input?.thread ?? createThread();
      const nextMessage: ChatMessage = {
        id: createInput.id ?? "message-created",
        threadId,
        role: createInput.role,
        parts: createInput.content
          ? [{ type: "text", text: createInput.content }]
          : [],
        createdAt: "2025-01-01T00:00:00.000Z",
        parentId: createInput.parentId ?? null,
        status: "complete",
        metadata: createInput.metadata,
      };
      return nextMessage;
    },
    async updateThread() {
      return updatedThread;
    },
    async archiveThread() {},
    async deleteThread() {},
  };
}

// The default run driver emits a short streamed assistant reply.
const createRunDriverStub = (): ChatRunDriver => ({
  async run(_context, onEvent) {
    await onEvent({
      type: "message:part",
      part: {
        type: "text",
        text: "hello",
      },
    });
    await onEvent({ type: "message:finish" });
    await onEvent({ type: "run:finish" });
  },
});

// The attachment driver converts a File into a canonical uploaded image part.
const createAttachmentDriverStub = (): ChatAttachmentDriver => ({
  async upload(file) {
    return {
      type: "image",
      source: `/attachments/${file.name}`,
      name: file.name,
      mimeType: file.type || "image/png",
      assetId: `asset-${file.name}`,
    };
  },
});

test("uchat runtime loads thread summaries into the store", async () => {
  const runtime = new ChatRuntime({
    repository: createRepositoryStub(),
    runDriver: createRunDriverStub(),
  });

  const threads = await runtime.loadThreads();

  assert.equal(threads.length, 1);
  assert.equal(runtime.getState().threads.length, 1);
  assert.equal(runtime.getState().activeThreadId, "thread-1");
  assert.equal(runtime.getState().threadListStatus, "ready");
});

test("uchat runtime updates thread summary fields without dropping hydrated messages", async () => {
  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({
        messages: [
          {
            id: "user-1",
            threadId: "thread-1",
            role: "user",
            parts: [{ type: "text", text: "hi" }],
            createdAt: "2025-01-01T00:00:00.000Z",
            parentId: null,
            status: "complete",
          },
        ],
      }),
    }),
    runDriver: createRunDriverStub(),
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  const beforeMessages = runtime.getThread("thread-1")?.messages.length;

  await runtime.updateThread("thread-1", {
    metadata: {
      knowledgeBaseId: "kb-1",
    },
  });

  const updated = runtime.getThread("thread-1");
  assert.equal(beforeMessages, 1);
  assert.equal(updated?.messages.length, 1);
  assert.equal(updated?.title, "Updated Thread");
  assert.equal(updated?.metadata?.knowledgeBaseId, "kb-1");
});

test("uchat runtime preserves hydrated messages across thread list reloads", async () => {
  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      summaries: [createThreadSummary({ id: "thread-1", title: "Reloaded Thread" })],
      thread: createThread({
        id: "thread-1",
        title: "Thread 1",
        messages: [
          {
            id: "assistant-1",
            threadId: "thread-1",
            role: "assistant",
            parts: [{ type: "text", text: "persisted reply" }],
            createdAt: "2025-01-01T00:00:00.000Z",
            parentId: null,
            status: "complete",
          },
        ],
      }),
    }),
    runDriver: createRunDriverStub(),
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  await runtime.loadThreads();

  const thread = runtime.getThread("thread-1");
  assert.equal(thread?.title, "Reloaded Thread");
  assert.equal(thread?.messages.length, 1);
  assert.equal(
    (thread?.messages[0]?.parts[0] as { text?: string } | undefined)?.text,
    "persisted reply",
  );
});

test("uchat runtime sends composer text and appends streamed assistant output", async () => {
  let getThreadCalls = 0;
  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      getThreadImpl: () => {
        getThreadCalls += 1;
        if (getThreadCalls === 1) {
          return createThread({
            messages: [],
          });
        }

        return createThread({
          updatedAt: "2025-01-01T00:00:01.000Z",
          messages: [
            {
              id: "user-persisted",
              threadId: "thread-1",
              role: "user",
              parts: [{ type: "text", text: "hello runtime" }],
              createdAt: "2025-01-01T00:00:00.000Z",
              parentId: null,
              status: "complete",
            },
            {
              id: "assistant-persisted",
              threadId: "thread-1",
              role: "assistant",
              parts: [{ type: "text", text: "hello" }],
              createdAt: "2025-01-01T00:00:01.000Z",
              parentId: "user-persisted",
              status: "complete",
            },
          ],
        });
      },
    }),
    runDriver: createRunDriverStub(),
    attachmentDriver: createAttachmentDriverStub(),
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  runtime.setComposerText("hello runtime");

  await runtime.send();

  const thread = runtime.getThread("thread-1");
  assert.equal(thread?.messages.length, 2);
  assert.equal(thread?.messages[0]?.role, "user");
  assert.equal(thread?.messages[0]?.parts[0]?.type, "text");
  assert.equal(thread?.messages[1]?.role, "assistant");
  assert.equal(thread?.messages[1]?.parts[0]?.type, "text");
  assert.equal(
    (thread?.messages[1]?.parts[0] as { text?: string } | undefined)?.text,
    "hello",
  );
  assert.equal(runtime.getState().composer.text, "");
  assert.equal(runtime.getState().runStatus.type, "idle");
});

test("uchat runtime derives UI capabilities from configured drivers", () => {
  const runtime = new ChatRuntime({
    repository: createRepositoryStub(),
    runDriver: createRunDriverStub(),
    attachmentDriver: createAttachmentDriverStub(),
  });

  assert.deepEqual(runtime.getState().capabilities, {
    renameThread: true,
    archiveThread: true,
    deleteThread: true,
    editMessage: true,
    attachments: true,
    agentEnabled: false,
    composerActions: [],
    messagePresentation: {},
  });
});

test("uchat runtime can disable auto-select on thread load through policy", async () => {
  const runtime = new ChatRuntime({
    repository: createRepositoryStub(),
    runDriver: createRunDriverStub(),
    policies: {
      threadSelection: {
        autoSelectAfterLoad: "none",
      },
    },
  });

  await runtime.loadThreads();

  assert.equal(runtime.getState().activeThreadId, null);
});

test("uchat runtime can enter welcome state without creating a thread", async () => {
  let createThreadCalls = 0;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      onCreateThread: () => {
        createThreadCalls += 1;
      },
    }),
    runDriver: createRunDriverStub(),
  });

  await runtime.loadThreads();
  runtime.setComposerText("draft before welcome");
  runtime.store.getState().setThreadStatus("ready");
  runtime.store.getState().setRunStatus({ type: "running" });

  runtime.enterWelcomeState();

  assert.equal(createThreadCalls, 0);
  assert.equal(runtime.getState().activeThreadId, null);
  assert.equal(runtime.getState().composer.text, "");
  assert.equal(runtime.getState().threadStatus, "idle");
  assert.deepEqual(runtime.getState().runStatus, { type: "idle" });
});

test("uchat runtime keeps welcome draft separate from persisted thread drafts", async () => {
  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({
        id: "thread-1",
        messages: [],
      }),
    }),
    runDriver: createRunDriverStub(),
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  runtime.setComposerText("thread draft");

  runtime.enterWelcomeState();
  assert.equal(runtime.getState().composer.text, "");

  runtime.setComposerText("welcome draft");
  await runtime.selectThread("thread-1");
  assert.equal(runtime.getState().composer.text, "thread draft");

  runtime.enterWelcomeState();
  assert.equal(runtime.getState().composer.text, "welcome draft");
});

test("uchat runtime clears welcome draft when entering a fresh conversation", async () => {
  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({
        id: "thread-1",
        messages: [],
      }),
    }),
    runDriver: createRunDriverStub(),
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  runtime.setComposerText("thread draft");

  runtime.enterWelcomeState();
  runtime.setComposerText("welcome draft");
  runtime.store.getState().resetComposer();

  assert.equal(runtime.getState().composer.text, "");
  assert.deepEqual(runtime.getState().composer.attachments, []);
});

test("uchat runtime reuses a thread returned by thread creation policy", async () => {
  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      summaries: [createThreadSummary({ id: "thread-1" })],
      thread: createThread({ id: "thread-1" }),
    }),
    runDriver: createRunDriverStub(),
    policies: {
      threadCreation: {
        findReusableThread: () => "thread-1",
      },
    },
  });

  await runtime.loadThreads();
  const thread = await runtime.ensureThread();

  assert.equal(thread?.id, "thread-1");
});

test("uchat runtime passes create input from thread creation policy", async () => {
  let capturedInput:
    | {
        title?: string;
        metadata?: Record<string, unknown>;
      }
    | undefined;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      onCreateThread: (input) => {
        capturedInput = input;
      },
    }),
    runDriver: createRunDriverStub(),
    policies: {
      threadCreation: {
        buildCreateInput: () => ({
          title: "Draft Thread",
          metadata: { knowledgeBaseId: "kb-1" },
        }),
      },
    },
  });

  await runtime.ensureThread();

  assert.deepEqual(capturedInput, {
    title: "Draft Thread",
    metadata: { knowledgeBaseId: "kb-1" },
  });
});

test("uchat runtime createThread merges runtime create overrides into repository input", async () => {
  let capturedInput:
    | {
        title?: string;
        metadata?: Record<string, unknown>;
      }
    | undefined;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      onCreateThread: (input) => {
        capturedInput = input;
      },
    }),
    runDriver: createRunDriverStub(),
  });

  await runtime.ensureThread(null, {
    metadata: { workspaceId: "workspace-1" },
  });

  assert.deepEqual(capturedInput, {
    metadata: { workspaceId: "workspace-1" },
  });
});

test("uchat runtime creates a new thread on first send when no thread is active", async () => {
  let createThreadCalls = 0;
  let getThreadCalls = 0;
  let listThreadCalls = 0;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      listThreadsImpl: () => {
        listThreadCalls += 1;
        return listThreadCalls === 1
          ? [createThreadSummary()]
          : [
              createThreadSummary({
                id: "thread-created",
                title: "Created Thread",
                updatedAt: "2025-01-01T00:00:01.000Z",
              }),
            ];
      },
      getThreadImpl: () => {
        getThreadCalls += 1;
        return createThread({
          id: "thread-created",
          title: "Created Thread",
          updatedAt: "2025-01-01T00:00:01.000Z",
          messages:
            getThreadCalls === 1
              ? [
                  {
                    id: "user-persisted",
                    threadId: "thread-created",
                    role: "user",
                    parts: [{ type: "text", text: "hello from welcome state" }],
                    createdAt: "2025-01-01T00:00:00.000Z",
                    parentId: null,
                    status: "complete",
                  },
                  {
                    id: "assistant-persisted",
                    threadId: "thread-created",
                    role: "assistant",
                    parts: [{ type: "text", text: "hello" }],
                    createdAt: "2025-01-01T00:00:01.000Z",
                    parentId: "user-persisted",
                    status: "complete",
                  },
                ]
              : [
                  {
                    id: "user-persisted",
                    threadId: "thread-created",
                    role: "user",
                    parts: [{ type: "text", text: "hello from welcome state" }],
                    createdAt: "2025-01-01T00:00:00.000Z",
                    parentId: null,
                    status: "complete",
                  },
                  {
                    id: "assistant-persisted",
                    threadId: "thread-created",
                    role: "assistant",
                    parts: [{ type: "text", text: "hello" }],
                    createdAt: "2025-01-01T00:00:01.000Z",
                    parentId: "user-persisted",
                    status: "complete",
                  },
                ],
        });
      },
      onCreateThread: () => {
        createThreadCalls += 1;
      },
    }),
    runDriver: createRunDriverStub(),
    policies: {
      threadSelection: {
        autoSelectAfterLoad: "none",
      },
    },
  });

  await runtime.loadThreads();
  runtime.setComposerText("hello from welcome state");

  await runtime.send();

  const thread = runtime.getActiveThread();
  assert.equal(createThreadCalls, 1);
  assert.equal(runtime.getState().activeThreadId, "thread-created");
  assert.equal(thread?.id, "thread-created");
  assert.equal(thread?.messages.length, 2);
  assert.equal(thread?.messages[0]?.role, "user");
  assert.equal(thread?.messages[1]?.role, "assistant");
});

test("uchat runtime ignores a repeated send while the first send is preparing", async () => {
  let createThreadCalls = 0;
  let runCalls = 0;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      onCreateThread: () => {
        createThreadCalls += 1;
      },
    }),
    runDriver: {
      async run(_context, onEvent) {
        runCalls += 1;
        await onEvent({ type: "message:finish" });
        await onEvent({ type: "run:finish" });
      },
    },
  });

  runtime.enterWelcomeState();
  runtime.setComposerText("send once");

  await Promise.all([runtime.send(), runtime.send()]);

  assert.equal(createThreadCalls, 1);
  assert.equal(runCalls, 1);
});

test("uchat runtime creates the thread only after welcome-state send", async () => {
  let createThreadCalls = 0;
  let getThreadCalls = 0;
  let listThreadCalls = 0;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      listThreadsImpl: () => {
        listThreadCalls += 1;
        return listThreadCalls === 1
          ? [createThreadSummary()]
          : [
              createThreadSummary({
                id: "thread-created",
                title: "Created Thread",
                updatedAt: "2025-01-01T00:00:01.000Z",
              }),
            ];
      },
      getThreadImpl: () => {
        getThreadCalls += 1;
        return createThread({
          id: "thread-created",
          title: "Created Thread",
          updatedAt: "2025-01-01T00:00:01.000Z",
          messages: [
            {
              id: "user-persisted",
              threadId: "thread-created",
              role: "user",
              parts: [{ type: "text", text: "hello after welcome" }],
              createdAt: "2025-01-01T00:00:00.000Z",
              parentId: null,
              status: "complete",
            },
            {
              id: "assistant-persisted",
              threadId: "thread-created",
              role: "assistant",
              parts: [{ type: "text", text: "hello" }],
              createdAt: "2025-01-01T00:00:01.000Z",
              parentId: "user-persisted",
              status: "complete",
            },
          ],
        });
      },
      onCreateThread: () => {
        createThreadCalls += 1;
      },
    }),
    runDriver: createRunDriverStub(),
  });

  await runtime.loadThreads();
  runtime.enterWelcomeState();
  assert.equal(createThreadCalls, 0);

  runtime.setComposerText("hello after welcome");
  await runtime.send();

  assert.equal(createThreadCalls, 1);
  assert.equal(runtime.getState().activeThreadId, "thread-created");
  assert.equal(runtime.getActiveThread()?.id, "thread-created");
  assert.equal(runtime.getActiveThread()?.messages.length, 2);
});

test("uchat runtime does not create a thread when welcome-state send has no content", async () => {
  let createThreadCalls = 0;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      onCreateThread: () => {
        createThreadCalls += 1;
      },
    }),
    runDriver: createRunDriverStub(),
  });

  await runtime.loadThreads();
  runtime.enterWelcomeState();

  await runtime.send();

  assert.equal(createThreadCalls, 0);
  assert.equal(runtime.getState().activeThreadId, null);
  assert.equal(runtime.getState().threads.length, 1);
});

test("uchat runtime can skip hydration on thread select through policy", async () => {
  let getThreadCalls = 0;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      onGetThread: () => {
        getThreadCalls += 1;
      },
    }),
    runDriver: createRunDriverStub(),
    policies: {
      threadSelection: {
        hydrateOnSelect: false,
      },
    },
  });

  await runtime.loadThreads();
  const thread = await runtime.selectThread("thread-1");

  assert.equal(getThreadCalls, 0);
  assert.equal(thread?.id, "thread-1");
  assert.deepEqual(thread?.messages, []);
  assert.equal(runtime.getState().activeThreadId, "thread-1");
});

test("uchat runtime invokes send lifecycle hooks", async () => {
  const calls: string[] = [];
  let afterSuccessThread: ChatThread | null = null;
  let afterSuccessAssistant: ChatMessage | null = null;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({ messages: [] }),
    }),
    runDriver: createRunDriverStub(),
    policies: {
      sendLifecycle: {
        beforeSend({ activeThread }) {
          calls.push(`before:${activeThread?.id ?? "none"}`);
        },
        afterSendSuccess({ thread, assistantMessage }) {
          calls.push(`success:${thread.id}`);
          afterSuccessThread = thread;
          afterSuccessAssistant = assistantMessage;
        },
      },
    },
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  runtime.setComposerText("hello runtime");

  await runtime.send();

  assert.deepEqual(calls, ["before:thread-1", "success:thread-1"]);
  assert.equal(afterSuccessThread?.id, "thread-1");
  assert.equal(afterSuccessAssistant?.status, "complete");
});

test("uchat runtime refreshes persisted thread state after successful send", async () => {
  let getThreadCalls = 0;
  let listThreadCalls = 0;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      summaries: [
        createThreadSummary({
          id: "thread-1",
          title: "Persisted Title",
          updatedAt: "2025-01-02T00:00:00.000Z",
        }),
      ],
      thread: createThread({
        id: "thread-1",
        title: "Persisted Title",
        updatedAt: "2025-01-02T00:00:00.000Z",
        messages: [
          {
            id: "user-persisted",
            threadId: "thread-1",
            role: "user",
            parts: [{ type: "text", text: "hello runtime" }],
            createdAt: "2025-01-01T00:00:00.000Z",
            parentId: null,
            status: "complete",
          },
          {
            id: "assistant-persisted",
            threadId: "thread-1",
            role: "assistant",
            parts: [{ type: "text", text: "hello" }],
            createdAt: "2025-01-01T00:00:01.000Z",
            parentId: "user-persisted",
            status: "complete",
            metadata: {
              rag: {
                sources: [{ chunkId: "chunk-1" }],
              },
            },
          },
        ],
      }),
      onGetThread: () => {
        getThreadCalls += 1;
      },
      onListThreads: () => {
        listThreadCalls += 1;
      },
    }),
    runDriver: createRunDriverStub(),
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  runtime.setComposerText("hello runtime");

  await runtime.send();

  const thread = runtime.getThread("thread-1");
  assert.ok(getThreadCalls >= 2);
  assert.ok(listThreadCalls >= 2);
  assert.equal(thread?.title, "Persisted Title");
  assert.equal(thread?.messages.length, 2);
  assert.equal(thread?.messages[1]?.id, "assistant-persisted");
  assert.deepEqual(thread?.messages[1]?.metadata, {
    rag: {
      sources: [{ chunkId: "chunk-1" }],
    },
  });
});

test("uchat runtime edits user message and regenerates assistant through linear tail replacement", async () => {
  let persistedThread = createThread({
    id: "thread-1",
    messages: [
      {
        id: "user-1",
        threadId: "thread-1",
        role: "user",
        parts: [{ type: "text", text: "hello" }],
        createdAt: "2025-01-01T00:00:00.000Z",
        parentId: null,
        status: "complete",
      },
      {
        id: "assistant-1",
        threadId: "thread-1",
        role: "assistant",
        parts: [{ type: "text", text: "old answer" }],
        createdAt: "2025-01-01T00:00:01.000Z",
        parentId: "user-1",
        status: "complete",
        metadata: {
          rag: {
            sources: [{ chunkId: "chunk-1" }],
          },
        },
      },
      {
        id: "user-2",
        threadId: "thread-1",
        role: "user",
        parts: [{ type: "text", text: "stale tail" }],
        createdAt: "2025-01-01T00:00:02.000Z",
        parentId: "assistant-1",
        status: "complete",
      },
    ],
  });

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: persistedThread,
      getThreadImpl: () => persistedThread,
      createMessageImpl: async (_threadId, input) => {
        const nextMessage: ChatMessage = {
          id: input.id ?? "user-1",
          threadId: "thread-1",
          role: input.role,
          parts: input.parts ?? [{ type: "text", text: input.content }],
          createdAt: "2025-01-01T00:00:03.000Z",
          parentId: input.parentId ?? null,
          status: "complete",
          metadata: input.metadata,
        };

        persistedThread = createThread({
          ...persistedThread,
          messages: [
            nextMessage,
            {
              id: "assistant-regenerated",
              threadId: "thread-1",
              role: "assistant",
              parts: [{ type: "text", text: "generated answer" }],
              createdAt: "2025-01-01T00:00:04.000Z",
              parentId: nextMessage.id,
              status: "complete",
            },
          ],
        });

        return nextMessage;
      },
    }),
    runDriver: {
      async run(_context, onEvent) {
        await onEvent({
          type: "message:part",
          part: { type: "text", text: "generated answer" },
        });
        await onEvent({ type: "message:finish" });
        await onEvent({ type: "run:finish" });
      },
    },
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  await runtime.editUserMessage("user-1", "new question");

  const thread = runtime.getThread("thread-1");
  assert.equal(thread?.messages.length, 2);
  assert.equal(thread?.messages[0]?.id, "user-1");
  assert.equal(
    (thread?.messages[0]?.parts[0] as { text?: string } | undefined)?.text,
    "new question",
  );
  assert.equal(thread?.messages[1]?.role, "assistant");
  assert.equal(
    (thread?.messages[1]?.parts[0] as { text?: string } | undefined)?.text,
    "generated answer",
  );
});

test("uchat runtime preserves user attachment parts when editing a message", async () => {
  let capturedInput: Parameters<NonNullable<ChatRepository["createMessage"]>>[1] | null =
    null;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({
        id: "thread-1",
        messages: [
          {
            id: "user-1",
            threadId: "thread-1",
            role: "user",
            parts: [
              { type: "text", text: "hello" },
              {
                type: "image",
                source: "/attachments/image-1.webp",
                name: "image-1.webp",
                mimeType: "image/webp",
                assetId: "asset-1",
              },
            ],
            createdAt: "2025-01-01T00:00:00.000Z",
            parentId: null,
            status: "complete",
          },
        ],
      }),
      createMessageImpl: async (_threadId, input) => {
        capturedInput = input;
        return {
          id: input.id ?? "user-1",
          threadId: "thread-1",
          role: input.role,
          parts: input.parts ?? [{ type: "text", text: input.content }],
          createdAt: "2025-01-01T00:00:03.000Z",
          parentId: input.parentId ?? null,
          status: "complete",
          metadata: input.metadata,
        };
      },
    }),
    runDriver: createRunDriverStub(),
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  await runtime.editUserMessage("user-1", "new question", [
    { type: "text", text: "new question" },
    {
      type: "image",
      source: "/attachments/image-1.webp",
      name: "image-1.webp",
      mimeType: "image/webp",
      assetId: "asset-1",
    },
  ]);

  assert.equal(capturedInput?.content, "new question");
  assert.equal(capturedInput?.parts?.length, 2);
});

test("uchat runtime preserves multiple image attachment parts when editing a message", async () => {
  let capturedInput: Parameters<NonNullable<ChatRepository["createMessage"]>>[1] | null =
    null;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({
        id: "thread-1",
        messages: [
          {
            id: "user-1",
            threadId: "thread-1",
            role: "user",
            parts: [
              { type: "text", text: "hello" },
              {
                type: "image",
                source: "/attachments/image-1.webp",
                name: "image-1.webp",
                mimeType: "image/webp",
                assetId: "asset-1",
              },
              {
                type: "image",
                source: "/attachments/image-2.webp",
                name: "image-2.webp",
                mimeType: "image/webp",
                assetId: "asset-2",
              },
            ],
            createdAt: "2025-01-01T00:00:00.000Z",
            parentId: null,
            status: "complete",
          },
        ],
      }),
      createMessageImpl: async (_threadId, input) => {
        capturedInput = input;
        return {
          id: input.id ?? "user-1",
          threadId: "thread-1",
          role: input.role,
          parts: input.parts ?? [{ type: "text", text: input.content }],
          createdAt: "2025-01-01T00:00:03.000Z",
          parentId: input.parentId ?? null,
          status: "complete",
          metadata: input.metadata,
        };
      },
    }),
    runDriver: createRunDriverStub(),
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  await runtime.editUserMessage("user-1", "new question", [
    { type: "text", text: "new question" },
    {
      type: "image",
      source: "/attachments/image-1.webp",
      name: "image-1.webp",
      mimeType: "image/webp",
      assetId: "asset-1",
    },
    {
      type: "image",
      source: "/attachments/image-2.webp",
      name: "image-2.webp",
      mimeType: "image/webp",
      assetId: "asset-2",
    },
  ]);

  assert.equal(capturedInput?.content, "new question");
  assert.equal(capturedInput?.parts?.length, 3);
  assert.equal(capturedInput?.parts?.filter((part) => part.type === "image").length, 2);
});

test("uchat runtime keeps image attachments visible when editing a message", async () => {
  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({
        id: "thread-1",
        messages: [
          {
            id: "user-1",
            threadId: "thread-1",
            role: "user",
            parts: [
              { type: "text", text: "hello" },
              {
                type: "image",
                source: "/attachments/image-1.webp",
                name: "image-1.webp",
                mimeType: "image/webp",
                assetId: "asset-1",
              },
            ],
            createdAt: "2025-01-01T00:00:00.000Z",
            parentId: null,
            status: "complete",
          },
        ],
      }),
    }),
    runDriver: createRunDriverStub(),
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");

  const thread = runtime.getThread("thread-1");
  assert.equal(thread?.messages[0]?.parts[1]?.type, "image");
  assert.equal(
    (thread?.messages[0]?.parts[1] as { name?: string } | undefined)?.name,
    "image-1.webp",
  );
});

test("uchat runtime sends edited user text instead of stale text parts", async () => {
  let capturedRunMessage: ChatMessage | null = null;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({
        id: "thread-1",
        messages: [
          {
            id: "user-1",
            threadId: "thread-1",
            role: "user",
            parts: [{ type: "text", text: "old text" }],
            createdAt: "2025-01-01T00:00:00.000Z",
            parentId: null,
            status: "complete",
          },
          {
            id: "assistant-1",
            threadId: "thread-1",
            role: "assistant",
            parts: [{ type: "text", text: "old answer" }],
            createdAt: "2025-01-01T00:00:01.000Z",
            parentId: "user-1",
            status: "complete",
          },
        ],
      }),
      createMessageImpl: async (_threadId, input) => ({
        id: input.id ?? "user-1",
        threadId: "thread-1",
        role: input.role,
        parts: input.parts ?? [{ type: "text", text: input.content }],
        createdAt: "2025-01-01T00:00:02.000Z",
        parentId: input.parentId ?? null,
        status: "complete",
        metadata: input.metadata,
      }),
    }),
    runDriver: {
      async run(context, onEvent) {
        capturedRunMessage = context.message;
        await onEvent({
          type: "message:part",
          part: { type: "text", text: "new answer" },
        });
        await onEvent({ type: "message:finish" });
        await onEvent({ type: "run:finish" });
      },
    },
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  await runtime.editUserMessage("user-1", "new text", [
    { type: "text", text: "new text" },
  ]);

  assert.equal(
    (capturedRunMessage?.parts[0] as { text?: string } | undefined)?.text,
    "new text",
  );
});

test("uchat runtime regenerates without duplicating the active user message in driver history", async () => {
  let capturedHistory: ChatMessage[] | null = null;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({
        id: "thread-1",
        messages: [
          {
            id: "user-1",
            threadId: "thread-1",
            role: "user",
            parts: [{ type: "text", text: "hello" }],
            createdAt: "2025-01-01T00:00:00.000Z",
            parentId: null,
            status: "complete",
          },
          {
            id: "assistant-1",
            threadId: "thread-1",
            role: "assistant",
            parts: [{ type: "text", text: "old answer" }],
            createdAt: "2025-01-01T00:00:01.000Z",
            parentId: "user-1",
            status: "complete",
          },
        ],
      }),
    }),
    runDriver: {
      async run(context, onEvent) {
        capturedHistory = context.history;
        await onEvent({
          type: "message:part",
          part: { type: "text", text: "new answer" },
        });
        await onEvent({ type: "message:finish" });
        await onEvent({ type: "run:finish" });
      },
    },
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  await runtime.regenerate("assistant-1");

  assert.equal(capturedHistory?.length, 0);
  assert.equal(runtime.getThread("thread-1")?.messages.length, 2);
});

test("uchat runtime preserves runtime-only rag trace parts during thread refresh", async () => {
  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({
        id: "thread-1",
        title: "Persisted Title",
        updatedAt: "2025-01-02T00:00:00.000Z",
        metadata: {
          knowledgeBaseId: null,
        },
        messages: [
          {
            id: "assistant-1",
            threadId: "thread-1",
            role: "assistant",
            parts: [{ type: "text", text: "persisted reply" }],
            createdAt: "2025-01-01T00:00:01.000Z",
            parentId: "user-1",
            status: "complete",
            metadata: {
              rag: {
                sources: [
                  {
                    chunkId: "chunk-1",
                    documentName: "Doc 1",
                    score: 0.9,
                    content: "Persisted source",
                  },
                ],
              },
            },
          },
        ],
      }),
    }),
    runDriver: createRunDriverStub(),
  });

  await runtime.loadThreads();
  runtime.store.getState().upsertThread(
    createThread({
      id: "thread-1",
      title: "Local Title",
      updatedAt: "2025-01-01T00:00:00.000Z",
      metadata: {
        knowledgeBaseId: "kb-1",
      },
      messages: [
        {
          id: "assistant-1",
          threadId: "thread-1",
          role: "assistant",
          parts: [
            { type: "text", text: "streamed reply" },
            {
              type: "data",
              name: "rag-node",
              value: {
                nodeId: "retrieve-1",
                nodeType: "retrieve",
                phase: "done",
                label: "Retrieve",
              },
            },
          ],
          createdAt: "2025-01-01T00:00:01.000Z",
          parentId: "user-1",
          status: "complete",
          metadata: {
            rag: {
              sources: [
                {
                  chunkId: "chunk-local",
                  documentName: "Doc Local",
                  score: 0.8,
                  content: "Local source",
                },
              ],
            },
          },
        },
      ],
    }),
  );
  runtime.store.getState().markHydrated("thread-1");

  const refreshed = await runtime.refreshThread("thread-1");
  const assistantMessage = refreshed.messages[0];

  assert.equal(refreshed.metadata?.knowledgeBaseId, null);
  assert.equal(assistantMessage?.parts.length, 2);
  assert.deepEqual(assistantMessage?.parts[0], {
    type: "text",
    text: "persisted reply",
  });
  assert.deepEqual(assistantMessage?.parts[1], {
    type: "data",
    name: "rag-node",
    value: {
      nodeId: "retrieve-1",
      nodeType: "retrieve",
      phase: "done",
      label: "Retrieve",
    },
  });
  assert.deepEqual(assistantMessage?.metadata, {
    rag: {
      sources: [
        {
          chunkId: "chunk-1",
          documentName: "Doc 1",
          score: 0.9,
          content: "Persisted source",
        },
      ],
    },
  });
});

test("uchat runtime upgrades tool events into first-class toolTrace and updates the same tool call in place", async () => {
  const ids = ["user-persisted", "assistant-persisted"];
  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({
        id: "thread-1",
        messages: [],
      }),
      getThreadImpl: () =>
        createThread({
          id: "thread-1",
          updatedAt: "2025-01-01T00:00:01.000Z",
          messages: [
            {
              id: "user-persisted",
              threadId: "thread-1",
              role: "user",
              parts: [{ type: "text", text: "today?" }],
              createdAt: "2025-01-01T00:00:00.000Z",
              parentId: null,
              status: "complete",
            },
            {
              id: "assistant-persisted",
              threadId: "thread-1",
              role: "assistant",
              parts: [{ type: "text", text: "answer" }],
              createdAt: "2025-01-01T00:00:01.000Z",
              parentId: "user-persisted",
              status: "complete",
            },
          ],
        }),
    }),
    runDriver: {
      async run(_context, onEvent) {
        await onEvent({
          type: "message:tool",
          toolCallId: "call-1",
          toolName: "web_search",
          status: "requested",
          input: { query: "今天是什么日子" },
        });
        await onEvent({
          type: "message:tool",
          toolCallId: "call-1",
          toolName: "web_search",
          status: "running",
          input: { query: "今天是什么日子" },
        });
        await onEvent({
          type: "message:tool",
          toolCallId: "call-1",
          toolName: "web_search",
          status: "succeeded",
          output: { results: [{ title: "today" }] },
        });
        await onEvent({
          type: "message:part",
          part: { type: "text", text: "answer" },
        });
        await onEvent({ type: "message:finish" });
        await onEvent({ type: "run:finish" });
      },
    },
    createId: () => ids.shift() ?? crypto.randomUUID(),
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  runtime.setComposerText("today?");

  await runtime.send();

  const thread = runtime.getThread("thread-1");
  const assistantMessage = thread?.messages.find(
    (message) => message.role === "assistant",
  );
  assert.deepEqual(assistantMessage?.toolTrace, [
    {
      toolCallId: "call-1",
      toolName: "web_search",
      status: "succeeded",
      input: { query: "今天是什么日子" },
      output: { results: [{ title: "today" }] },
    },
  ]);
});

test("uchat runtime preserves runtime toolTrace when refreshed thread does not persist tool events yet", async () => {
  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({
        id: "thread-1",
        messages: [
          {
            id: "assistant-1",
            threadId: "thread-1",
            role: "assistant",
            parts: [{ type: "text", text: "persisted reply" }],
            createdAt: "2025-01-01T00:00:01.000Z",
            parentId: "user-1",
            status: "complete",
          },
        ],
      }),
    }),
    runDriver: createRunDriverStub(),
  });

  await runtime.loadThreads();
  runtime.store.getState().upsertThread(
    createThread({
      id: "thread-1",
      messages: [
        {
          id: "assistant-1",
          threadId: "thread-1",
          role: "assistant",
          parts: [{ type: "text", text: "local reply" }],
          createdAt: "2025-01-01T00:00:01.000Z",
          parentId: "user-1",
          status: "complete",
          toolTrace: [
            {
              toolCallId: "call-1",
              toolName: "web_search",
              status: "succeeded",
              output: { results: 2 },
            },
          ],
        },
      ],
    }),
  );
  runtime.store.getState().markHydrated("thread-1");

  const refreshed = await runtime.refreshThread("thread-1");
  assert.deepEqual(refreshed.messages[0]?.toolTrace, [
    {
      toolCallId: "call-1",
      toolName: "web_search",
      status: "succeeded",
      output: { results: 2 },
    },
  ]);
});

test("uchat runtime preserves streamed execution-node data parts across refresh", async () => {
  let getThreadCalls = 0;
  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      getThreadImpl: () => {
        getThreadCalls += 1;
        if (getThreadCalls === 1) {
          return createThread({
            id: "thread-1",
            messages: [],
          });
        }

        return createThread({
          id: "thread-1",
          updatedAt: "2025-01-01T00:00:01.000Z",
          messages: [
            {
              id: "user-persisted",
              threadId: "thread-1",
              role: "user",
              parts: [{ type: "text", text: "今天是什么时候？" }],
              createdAt: "2025-01-01T00:00:00.000Z",
              parentId: null,
              status: "complete",
            },
            {
              id: "assistant-persisted",
              threadId: "thread-1",
              role: "assistant",
              parts: [{ type: "text", text: "今天是 2026-06-26。" }],
              createdAt: "2025-01-01T00:00:01.000Z",
              parentId: "user-persisted",
              status: "complete",
            },
          ],
        });
      },
    }),
    runDriver: {
      async run(_context, onEvent) {
        await onEvent({
          type: "message:part",
          part: {
            type: "data",
            name: "execution-node",
            value: {
              nodeId: "tool-1",
              nodeType: "tool",
              phase: "start",
              label: "web_search",
              summary: "Running web_search",
            },
          },
        });
        await onEvent({
          type: "message:part",
          part: {
            type: "text",
            text: "今天是 2026-06-26。",
          },
        });
        await onEvent({ type: "message:finish" });
        await onEvent({ type: "run:finish" });
      },
    },
    createId: () => {
      const ids = ["user-persisted", "assistant-persisted"];
      return ids.shift() ?? crypto.randomUUID();
    },
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  runtime.setComposerText("今天是什么时候？");

  await runtime.send();

  const thread = runtime.getThread("thread-1");
  const assistantMessage = thread?.messages.find(
    (message) => message.id === "assistant-persisted",
  );

  assert.ok(assistantMessage);
  assert.deepEqual(assistantMessage?.parts, [
    { type: "text", text: "今天是 2026-06-26。" },
    {
      type: "data",
      name: "execution-node",
      value: {
        nodeId: "tool-1",
        nodeType: "tool",
        phase: "start",
        label: "web_search",
        summary: "Running web_search",
      },
    },
  ]);
  assert.equal(assistantMessage?.status, "complete");
});

test("uchat runtime invokes afterSendError hook when run driver throws", async () => {
  const calls: string[] = [];

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({ messages: [] }),
    }),
    runDriver: {
      async run() {
        throw new Error("stream failed");
      },
    },
    policies: {
      sendLifecycle: {
        beforeSend() {
          calls.push("before");
        },
        afterSendError({ error }) {
          calls.push(`error:${error.message}`);
        },
      },
    },
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  runtime.setComposerText("hello runtime");

  await assert.rejects(() => runtime.send(), /stream failed/);
  assert.deepEqual(calls, ["before", "error:stream failed"]);
});

test("uchat runtime removes optimistic assistant placeholder when send fails", async () => {
  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({ messages: [] }),
    }),
    runDriver: {
      async run(_context, onEvent) {
        await onEvent({
          type: "message:part",
          part: { type: "text", text: "partial" },
        });
        throw new Error("stream failed");
      },
    },
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  runtime.setComposerText("hello runtime");

  await assert.rejects(() => runtime.send(), /stream failed/);

  const thread = runtime.getThread("thread-1");
  assert.equal(thread?.messages.length, 1);
  assert.equal(thread?.messages[0]?.role, "user");
  assert.equal(thread?.messages[0]?.status, "complete");
  assert.equal(runtime.getState().runStatus.type, "error");
});

test("uchat runtime attempts reconciliation after send error", async () => {
  let getThreadCalls = 0;
  let listThreadCalls = 0;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({
        id: "thread-1",
        messages: [],
      }),
      onGetThread: () => {
        getThreadCalls += 1;
      },
      onListThreads: () => {
        listThreadCalls += 1;
      },
    }),
    runDriver: {
      async run() {
        throw new Error("stream failed");
      },
    },
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  runtime.setComposerText("hello runtime");

  await assert.rejects(() => runtime.send(), /stream failed/);
  assert.ok(getThreadCalls >= 2);
  assert.ok(listThreadCalls >= 2);
});

test("uchat runtime preserves local errored assistant messages when refreshed thread only contains the user message", async () => {
  let getThreadCalls = 0;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      getThreadImpl: () => {
        getThreadCalls += 1;
        if (getThreadCalls === 1) {
          return createThread({
            id: "thread-1",
            messages: [],
          });
        }

        return createThread({
          id: "thread-1",
          updatedAt: "2025-01-01T00:00:01.000Z",
          messages: [
            {
              id: "user-persisted",
              threadId: "thread-1",
              role: "user",
              parts: [{ type: "text", text: "hello rag" }],
              createdAt: "2025-01-01T00:00:00.000Z",
              parentId: null,
              status: "complete",
            },
          ],
        });
      },
    }),
    runDriver: {
      async run(_context, onEvent) {
        await onEvent({
          type: "message:part",
          part: { type: "text", text: "partial answer" },
        });
        await onEvent({
          type: "run:error",
          errorMessage: "embed fetch failed",
        });
      },
    },
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  runtime.setComposerText("hello rag");

  await runtime.send();

  const thread = runtime.getThread("thread-1");
  assert.equal(thread?.messages.length, 2);
  assert.equal(thread?.messages[0]?.role, "user");
  assert.equal(thread?.messages[1]?.role, "assistant");
  assert.equal(thread?.messages[1]?.status, "error");
  assert.equal(thread?.messages[1]?.errorMessage, "embed fetch failed");
  assert.deepEqual(thread?.messages[1]?.parts, [
    { type: "text", text: "partial answer" },
  ]);
});

test("uchat runtime keeps assistant in error state when stream finishes with finishReason=error", async () => {
  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      getThreadImpl: () =>
        createThread({
          id: "thread-1",
          updatedAt: "2025-01-01T00:00:01.000Z",
          messages: [
            {
              id: "user-persisted",
              threadId: "thread-1",
              role: "user",
              parts: [{ type: "text", text: "hello rag" }],
              createdAt: "2025-01-01T00:00:00.000Z",
              parentId: null,
              status: "complete",
            },
          ],
        }),
    }),
    runDriver: {
      async run(_context, onEvent) {
        await onEvent({
          type: "message:part",
          part: {
            type: "data",
            name: "rag-node",
            value: {
              nodeId: "embed-1",
              nodeType: "embed",
              phase: "error",
              label: "embed",
              summary: "fetch failed",
            },
          },
        });
        await onEvent({
          type: "run:error",
          errorMessage: "fetch failed",
        });
        await onEvent({ type: "run:finish" });
      },
    },
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  runtime.setComposerText("hello rag");

  await runtime.send();

  const thread = runtime.getThread("thread-1");
  assert.equal(thread?.messages.length, 2);
  assert.equal(thread?.messages[1]?.role, "assistant");
  assert.equal(thread?.messages[1]?.status, "error");
  assert.equal(thread?.messages[1]?.errorMessage, "fetch failed");
});

test("uchat runtime preserves stream error assistant when backend persisted only the user", async () => {
  let getThreadCalls = 0;
  let afterSendSuccessCalls = 0;
  let afterSendErrorMessage = "";
  const ids = ["user-1", "assistant-1"];

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      getThreadImpl: () => {
        getThreadCalls += 1;
        if (getThreadCalls === 1) {
          return createThread({
            id: "thread-1",
            messages: [],
          });
        }

        return createThread({
          id: "thread-1",
          updatedAt: "2025-01-01T00:00:01.000Z",
          messages: [
            {
              id: "user-1",
              threadId: "thread-1",
              role: "user",
              parts: [
                {
                  type: "image",
                  source: "/attachments/image.webp",
                  name: "image.webp",
                  mimeType: "image/webp",
                },
              ],
              createdAt: "2025-01-01T00:00:00.000Z",
              parentId: null,
              status: "complete",
            },
          ],
        });
      },
    }),
    runDriver: {
      async run(_context, onEvent) {
        await onEvent({
          type: "message:part",
          part: { type: "text", text: "partial vision answer" },
        });
        await onEvent({
          type: "run:error",
          errorMessage: "vision stream failed",
        });
        await onEvent({ type: "run:finish" });
      },
    },
    policies: {
      sendLifecycle: {
        afterSendSuccess() {
          afterSendSuccessCalls += 1;
        },
        afterSendError({ error }) {
          afterSendErrorMessage = error.message;
        },
      },
    },
    createId: () => ids.shift() ?? crypto.randomUUID(),
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  runtime.store.getState().setComposerAttachments([
    {
      id: "draft-image",
      kind: "image",
      file: new File(["fake"], "image.webp", { type: "image/webp" }),
      status: "uploaded",
      uploadedPart: {
        type: "image",
        source: "/attachments/image.webp",
        name: "image.webp",
        mimeType: "image/webp",
      },
    },
  ]);

  await runtime.send();

  const thread = runtime.getThread("thread-1");
  assert.equal(afterSendSuccessCalls, 0);
  assert.equal(afterSendErrorMessage, "vision stream failed");
  assert.equal(runtime.getState().runStatus.type, "error");
  assert.equal(thread?.messages.length, 2);
  assert.equal(thread?.messages[0]?.id, "user-1");
  assert.equal(thread?.messages[0]?.role, "user");
  assert.equal(thread?.messages[1]?.id, "assistant-1");
  assert.equal(thread?.messages[1]?.role, "assistant");
  assert.equal(thread?.messages[1]?.status, "error");
  assert.equal(thread?.messages[1]?.errorMessage, "vision stream failed");
  assert.deepEqual(thread?.messages[1]?.parts, [
    { type: "text", text: "partial vision answer" },
  ]);
});

test("uchat runtime preserves completed assistant when backend refresh only has the user", async () => {
  let getThreadCalls = 0;
  let afterSendSuccessCalls = 0;
  const ids = ["user-1", "assistant-1"];

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      getThreadImpl: () => {
        getThreadCalls += 1;
        if (getThreadCalls === 1) {
          return createThread({
            id: "thread-1",
            messages: [],
          });
        }

        return createThread({
          id: "thread-1",
          updatedAt: "2025-01-01T00:00:01.000Z",
          messages: [
            {
              id: "user-1",
              threadId: "thread-1",
              role: "user",
              parts: [
                {
                  type: "image",
                  source: "/attachments/image.webp",
                  name: "image.webp",
                  mimeType: "image/webp",
                },
              ],
              createdAt: "2025-01-01T00:00:00.000Z",
              parentId: null,
              status: "complete",
            },
          ],
        });
      },
    }),
    runDriver: {
      async run(_context, onEvent) {
        await onEvent({
          type: "message:part",
          part: { type: "text", text: "vision answer" },
        });
        await onEvent({ type: "message:finish" });
        await onEvent({ type: "run:finish" });
      },
    },
    policies: {
      sendLifecycle: {
        afterSendSuccess() {
          afterSendSuccessCalls += 1;
        },
      },
    },
    createId: () => ids.shift() ?? crypto.randomUUID(),
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  runtime.store.getState().setComposerAttachments([
    {
      id: "draft-image",
      kind: "image",
      file: new File(["fake"], "image.webp", { type: "image/webp" }),
      status: "uploaded",
      uploadedPart: {
        type: "image",
        source: "/attachments/image.webp",
        name: "image.webp",
        mimeType: "image/webp",
      },
    },
  ]);

  await runtime.send();

  const thread = runtime.getThread("thread-1");
  assert.equal(afterSendSuccessCalls, 1);
  assert.equal(runtime.getState().runStatus.type, "idle");
  assert.equal(thread?.messages.length, 2);
  assert.equal(thread?.messages[0]?.id, "user-1");
  assert.equal(thread?.messages[0]?.role, "user");
  assert.equal(thread?.messages[1]?.id, "assistant-1");
  assert.equal(thread?.messages[1]?.role, "assistant");
  assert.equal(thread?.messages[1]?.status, "complete");
  assert.deepEqual(thread?.messages[1]?.parts, [
    { type: "text", text: "vision answer" },
  ]);
});

test("uchat runtime exposes configured composer actions and message presentation hints", () => {
  const runtime = new ChatRuntime({
    repository: createRepositoryStub(),
    runDriver: createRunDriverStub(),
    attachmentDriver: createAttachmentDriverStub(),
    policies: {
      composerActions: [
        {
          id: "upload-image",
          kind: "attachment",
          label: "Send image",
          accept: "image/*",
          attachmentKind: "image",
        },
      ],
      messagePresentation: {
        preferMarkdownForText: true,
        assistantMaxWidth: "wide",
        userMaxWidth: "regular",
      },
    },
  });

  assert.deepEqual(runtime.getState().capabilities, {
    renameThread: true,
    archiveThread: true,
    deleteThread: true,
    editMessage: true,
    attachments: true,
    agentEnabled: false,
    composerActions: [
      {
        id: "upload-image",
        kind: "attachment",
        label: "Send image",
        accept: "image/*",
        attachmentKind: "image",
      },
    ],
    messagePresentation: {
      preferMarkdownForText: true,
      assistantMaxWidth: "wide",
      userMaxWidth: "regular",
    },
  });
});

test("uchat runtime can refresh UI capabilities without recreating the store", () => {
  const runtime = new ChatRuntime({
    repository: createRepositoryStub(),
    runDriver: createRunDriverStub(),
    policies: {
      composerActions: [
        {
          id: "knowledge-base-picker",
          kind: "command",
          label: "Knowledge base",
          disabled: true,
        },
      ],
      messagePresentation: {
        preferMarkdownForText: true,
      },
    },
  });

  const initialStore = runtime.store;

  runtime.setCapabilities({
    ...runtime.getState().capabilities,
    composerActions: [
      {
        id: "knowledge-base-picker",
        kind: "command",
        label: "Knowledge base",
        disabled: false,
      },
    ],
  });

  assert.equal(runtime.store, initialStore);
  assert.deepEqual(runtime.getState().capabilities, {
    renameThread: true,
    archiveThread: true,
    deleteThread: true,
    editMessage: true,
    attachments: false,
    agentEnabled: false,
    composerActions: [
      {
        id: "knowledge-base-picker",
        kind: "command",
        label: "Knowledge base",
        disabled: false,
      },
    ],
    messagePresentation: {
      preferMarkdownForText: true,
    },
  });
});

test("uchat runtime forwards per-send agentEnabled to the run driver", async () => {
  let capturedOptions:
    | {
        agentEnabled?: boolean;
      }
    | undefined;

  const runtime = new ChatRuntime({
    repository: createRepositoryStub({
      thread: createThread({
        id: "thread-1",
        messages: [],
      }),
    }),
    runDriver: {
      async run(context, onEvent) {
        capturedOptions = context.options;
        await onEvent({
          type: "message:part",
          part: { type: "text", text: "agent answer" },
        });
        await onEvent({ type: "message:finish" });
        await onEvent({ type: "run:finish" });
      },
    },
  });

  await runtime.loadThreads();
  await runtime.selectThread("thread-1");
  runtime.setComposerText("hello agent");

  await runtime.send({ agentEnabled: true });

  assert.deepEqual(capturedOptions, { agentEnabled: true });
});
