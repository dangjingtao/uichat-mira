import assert from "node:assert/strict";
import { test, vi } from "vitest";
import { providerProxyService } from "@/services/provider-proxy.service/index";
import {
  __taskCapabilitySelectorTestUtils,
  resolveSelectedToolIds,
  selectToolWithTaskModel,
} from "../task-capability-selector";

test("selectToolWithTaskModel returns none when task model rejects tool use", async () => {
  const streamTaskChatTextSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"mode":"none","reason":"Greeting only, no tool is needed."}';
    });

  try {
    const result = await selectToolWithTaskModel({
      query: "Hi",
      topCandidates: [
        {
          toolId: "read_open",
          title: "Read Open",
          description: "Open workspace files",
          score: 0.62,
          embeddingScore: 0.62,
          ruleScore: 0,
          source: "internal",
          domain: "read",
          tags: ["workspace", "read"],
        },
      ],
      messages: [
        {
          role: "user",
          content: "Hi",
          parts: [{ type: "text", text: "Hi" }],
        },
      ],
    });

    assert.equal(streamTaskChatTextSpy.mock.calls.length, 1);
    assert.deepEqual(result.selectedToolIds, []);
    assert.equal(result.decisionSource, "task-model");
    assert.equal(result.decisionReason, "Greeting only, no tool is needed.");
  } finally {
    streamTaskChatTextSpy.mockRestore();
  }
});

test("selectToolWithTaskModel returns the chosen tool when task model selects one", async () => {
  const streamTaskChatTextSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"mode":"use_tool","toolId":"web_search","reason":"The user explicitly asked for current web information."}';
    });

  try {
    const result = await selectToolWithTaskModel({
      query: "帮我列出最新新闻来源",
      topCandidates: [
        {
          toolId: "web_search",
          title: "Web Search",
          description: "Search the public web",
          score: 0.87,
          embeddingScore: 0.87,
          ruleScore: 0,
          source: "internal",
          domain: "web_search",
          tags: ["web", "search", "latest"],
        },
        {
          toolId: "read_list",
          title: "Read List",
          description: "List workspace files",
          score: 0.71,
          embeddingScore: 0.71,
          ruleScore: 0,
          source: "internal",
          domain: "read",
          tags: ["workspace", "list"],
        },
      ],
      messages: [
        {
          role: "user",
          content: "帮我列出最新新闻来源",
          parts: [{ type: "text", text: "帮我列出最新新闻来源" }],
        },
      ],
    });

    assert.equal(streamTaskChatTextSpy.mock.calls.length, 1);
    assert.deepEqual(result.selectedToolIds, ["web_search"]);
    assert.equal(result.decisionSource, "task-model");
    assert.equal(
      result.decisionReason,
      "The user explicitly asked for current web information.",
    );
  } finally {
    streamTaskChatTextSpy.mockRestore();
  }
});

test("selectToolWithTaskModel keeps workspace hints as model input instead of bypassing task model", async () => {
  const streamTaskChatTextSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"mode":"use_tool","toolId":"read_list","reason":"The user explicitly asked to inspect local workspace contents."}';
    });

  try {
    const result = await selectToolWithTaskModel({
      query: "帮我看看文件夹下有啥",
      topCandidates: [
        {
          toolId: "web_search",
          title: "Web Search",
          description: "Search the public web",
          score: 0.91,
          embeddingScore: 0.82,
          ruleScore: 0.14,
          rerankScore: 0.66,
          finalScore: 0.69,
          source: "internal",
          domain: "web_search",
          tags: ["web", "search", "current"],
        },
        {
          toolId: "read_list",
          title: "Read List",
          description: "List workspace files",
          score: 0.62,
          embeddingScore: 0,
          ruleScore: 0.4,
          rerankScore: 0.63,
          finalScore: 0.538,
          source: "internal",
          domain: "read",
          tags: ["workspace", "directory", "file"],
        },
      ],
      messages: [
        {
          role: "user",
          content: "帮我看看文件夹下有啥",
          parts: [{ type: "text", text: "帮我看看文件夹下有啥" }],
        },
      ],
    });

    assert.equal(streamTaskChatTextSpy.mock.calls.length, 1);
    assert.deepEqual(result.selectedToolIds, ["read_list"]);
    assert.equal(result.decisionSource, "task-model");
    const selectionMessages = streamTaskChatTextSpy.mock.calls[0]?.[0];
    const userMessage = selectionMessages?.[1];
    assert.equal(typeof userMessage?.content, "string");
    assert.match(
      userMessage.content,
      /Workspace hint only:/,
    );
  } finally {
    streamTaskChatTextSpy.mockRestore();
  }
});

test("selectToolWithTaskModel rejects use_tool payloads without toolId", async () => {
  const streamTaskChatTextSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"mode":"use_tool","reason":"Should select something."}';
    });

  try {
    const result = await selectToolWithTaskModel({
      query: "帮我看看文件夹下有啥",
      topCandidates: [
        {
          toolId: "read_list",
          title: "Read List",
          description: "List workspace files",
          score: 0.62,
          embeddingScore: 0.2,
          ruleScore: 0.4,
          rerankScore: 0.63,
          finalScore: 0.538,
          source: "internal",
          domain: "read",
          tags: ["workspace", "directory", "file"],
        },
      ],
      messages: [
        {
          role: "user",
          content: "帮我看看文件夹下有啥",
          parts: [{ type: "text", text: "帮我看看文件夹下有啥" }],
        },
      ],
    });

    assert.equal(streamTaskChatTextSpy.mock.calls.length, 1);
    assert.deepEqual(result.selectedToolIds, []);
    assert.equal(result.decisionSource, "task-model");
    assert.equal(result.decisionReason, "Task model returned invalid decision payload.");
  } finally {
    streamTaskChatTextSpy.mockRestore();
  }
});

test("resolveSelectedToolIds picks read_list for directory listing requests", () => {
  const result = resolveSelectedToolIds({
    query: "帮我看看文件夹下有啥",
    topCandidates: [
      {
        toolId: "read_list",
        title: "Read List",
        description: "List workspace files",
        score: 0.62,
        embeddingScore: 0,
        ruleScore: 0.4,
        rerankScore: 0.63,
        finalScore: 0.538,
        source: "internal",
        domain: "read",
        tags: ["workspace", "directory", "file"],
      },
    ],
    selectedToolIds: ["read_list"],
  });

  assert.deepEqual(result, ["read_list"]);
});

test("resolveSelectedToolIds demotes read alias behind explicit read tools", () => {
  const result = resolveSelectedToolIds({
    query: "open README.md",
    topCandidates: [
      {
        toolId: "read_open",
        title: "Read Open",
        description: "Open workspace files",
        score: 0.62,
        embeddingScore: 0,
        ruleScore: 0.4,
        rerankScore: 0.63,
        finalScore: 0.538,
        source: "internal",
        domain: "read",
        tags: ["workspace", "directory", "file"],
      },
    ],
    selectedToolIds: ["read_open"],
  });

  assert.deepEqual(result, ["read_open"]);
});

test("resolveSelectedToolIds prefers read_extract for explicit range requests", () => {
  const result = resolveSelectedToolIds({
    query: "read README.md line 10-20",
    topCandidates: [
      {
        toolId: "read_extract",
        title: "Read Extract",
        description: "Read a specific range from a file",
        score: 0.71,
        embeddingScore: 0.6,
        ruleScore: 0.3,
        rerankScore: 0.5,
        finalScore: 0.56,
        source: "internal",
        domain: "read",
        tags: ["workspace", "read"],
      },
    ],
    selectedToolIds: ["read_extract"],
  });

  assert.deepEqual(result, ["read_extract"]);
});

test("range detection recognizes explicit read ranges", () => {
  assert.equal(
    __taskCapabilitySelectorTestUtils.hasExplicitReadRange("read README.md line 10-20"),
    true,
  );
  assert.equal(
    __taskCapabilitySelectorTestUtils.hasExplicitReadRange("帮我看第 3 页"),
    true,
  );
  assert.equal(
    __taskCapabilitySelectorTestUtils.hasExplicitReadRange("open README.md"),
    false,
  );
});

test("selectToolWithTaskModel prefers workspace_edit for explicit file creation intent", async () => {
  const streamTaskChatTextSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"mode":"use_tool","toolId":"terminal_session","reason":"Use terminal."}';
    });

  try {
    const result = await selectToolWithTaskModel({
      query: "请创建文件 notes/todo.txt",
      topCandidates: [
        {
          toolId: "terminal_session",
          title: "Terminal Session",
          description: "Run a terminal command",
          score: 0.91,
          embeddingScore: 0.91,
          ruleScore: 0,
          source: "internal",
          domain: "terminal",
          tags: ["terminal", "command", "shell"],
        },
        {
          toolId: "edit_file",
          title: "Edit File",
          description: "Create or modify a file",
          score: 0.78,
          embeddingScore: 0.78,
          ruleScore: 0,
          source: "internal",
          domain: "edit",
          tags: ["workspace", "edit", "write", "mutation"],
        },
      ],
      messages: [
        {
          role: "user",
          content: "请创建文件 notes/todo.txt",
          parts: [{ type: "text", text: "请创建文件 notes/todo.txt" }],
        },
      ],
    });

    assert.equal(streamTaskChatTextSpy.mock.calls.length, 0);
    assert.deepEqual(result.selectedToolIds, ["edit_file"]);
    assert.equal(result.decisionSource, "rule");
  } finally {
    streamTaskChatTextSpy.mockRestore();
  }
});

test("resolveSelectedToolIds picks edit_file for explicit file creation requests", () => {
  const result = resolveSelectedToolIds({
    query: "请创建文件 notes/todo.txt",
    topCandidates: [
      {
        toolId: "edit_file",
        title: "Edit File",
        description: "Create or modify a file",
        score: 0.8,
        embeddingScore: 0.8,
        ruleScore: 0,
        source: "internal",
        domain: "edit",
        tags: ["workspace", "edit", "write"],
      },
    ],
    selectedToolIds: ["edit_file"],
  });

  assert.deepEqual(result, ["edit_file"]);
});

test("selectToolWithTaskModel prefers workspace_edit for explicit file write requests", async () => {
  const streamTaskChatTextSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"mode":"use_tool","toolId":"terminal_session","reason":"Use terminal."}';
    });

  try {
    const result = await selectToolWithTaskModel({
      query: "把 'hello world' 写入 docs/todo.md",
      topCandidates: [
        {
          toolId: "terminal_session",
          title: "Terminal Session",
          description: "Run a terminal command",
          score: 0.93,
          embeddingScore: 0.93,
          ruleScore: 0,
          source: "internal",
          domain: "terminal",
          tags: ["terminal", "command", "shell"],
        },
        {
          toolId: "edit_file",
          title: "Edit File",
          description: "Create or modify a file",
          score: 0.72,
          embeddingScore: 0.72,
          ruleScore: 0,
          source: "internal",
          domain: "edit",
          tags: ["workspace", "edit", "write", "mutation"],
        },
      ],
      messages: [
        {
          role: "user",
          content: "把 'hello world' 写入 docs/todo.md",
          parts: [{ type: "text", text: "把 'hello world' 写入 docs/todo.md" }],
        },
      ],
    });

    assert.equal(streamTaskChatTextSpy.mock.calls.length, 0);
    assert.deepEqual(result.selectedToolIds, ["edit_file"]);
    assert.equal(result.decisionSource, "rule");
  } finally {
    streamTaskChatTextSpy.mockRestore();
  }
});

test("resolveSelectedToolIds picks edit_file for explicit file write requests", () => {
  const result = resolveSelectedToolIds({
    query: "把 'hello world' 写入 docs/todo.md",
    topCandidates: [
      {
        toolId: "edit_file",
        title: "Edit File",
        description: "Create or modify a file",
        score: 0.8,
        embeddingScore: 0.8,
        ruleScore: 0,
        source: "internal",
        domain: "edit",
        tags: ["workspace", "edit", "write"],
      },
    ],
    selectedToolIds: ["edit_file"],
  });

  assert.deepEqual(result, ["edit_file"]);
});

test("selectToolWithTaskModel does not bypass task model for generic writing requests", async () => {
  const streamTaskChatTextSpy = vi
    .spyOn(providerProxyService, "streamTaskChatText")
    .mockImplementation(async function* () {
      yield '{"mode":"none","reason":"This is a generic writing request, not a file operation."}';
    });

  try {
    const result = await selectToolWithTaskModel({
      query: "帮我写一份项目总结",
      topCandidates: [
        {
          toolId: "terminal_session",
          title: "Terminal Session",
          description: "Run a terminal command",
          score: 0.6,
          embeddingScore: 0.6,
          ruleScore: 0,
          source: "internal",
          domain: "terminal",
          tags: ["terminal", "command", "shell"],
        },
        {
          toolId: "edit_file",
          title: "Edit File",
          description: "Create or modify a file",
          score: 0.55,
          embeddingScore: 0.55,
          ruleScore: 0,
          source: "internal",
          domain: "edit",
          tags: ["workspace", "edit", "write", "mutation"],
        },
      ],
      messages: [
        {
          role: "user",
          content: "帮我写一份项目总结",
          parts: [{ type: "text", text: "帮我写一份项目总结" }],
        },
      ],
    });

    assert.equal(streamTaskChatTextSpy.mock.calls.length, 1);
    assert.deepEqual(result.selectedToolIds, []);
    assert.equal(result.decisionSource, "task-model");
  } finally {
    streamTaskChatTextSpy.mockRestore();
  }
});
