import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTimestampedTestArtifactPath } from "@/test-support/artifacts.js";

const mocks = vi.hoisted(() => ({
  getToolById: vi.fn(),
  streamTaskChatText: vi.fn(),
}));

vi.mock("./registry.js", () => ({ getToolById: mocks.getToolById }));
vi.mock("@/services/provider-proxy.service/index.js", () => ({
  providerProxyService: { streamTaskChatText: mocks.streamTaskChatText },
}));

import { executeTool } from "./executor.js";

const artifactRoot = createTimestampedTestArtifactPath("tools", "p0-executor");
const relativeArtifactRoot = path.relative(process.cwd(), artifactRoot);

describe("legacy tool executor boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fs.mkdirSync(path.join(artifactRoot, "workspace"), { recursive: true });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.TAVILY_API_KEY;
    fs.rmSync(artifactRoot, { recursive: true, force: true });
  });

  it("rejects unknown tools and unsupported runtime types", async () => {
    mocks.getToolById.mockReturnValue(undefined);
    await expect(executeTool("missing")).rejects.toThrow("Tool not found: missing");

    mocks.getToolById.mockReturnValue({
      id: "bad-runtime",
      sourceDir: artifactRoot,
      runtime: { type: "remote-shell" },
    });
    await expect(executeTool("bad-runtime")).rejects.toThrow(
      "Unsupported tool runtime type: remote-shell",
    );
  });

  it("keeps filesystem operations inside the configured base directory", async () => {
    mocks.getToolById.mockReturnValue({
      id: "workspace-files",
      sourceDir: artifactRoot,
      runtime: {
        type: "filesystem",
        baseDir: relativeArtifactRoot,
        allowedOperations: ["read", "write", "list"],
      },
    });

    await expect(
      executeTool("workspace-files", { operation: "read", path: "../outside.txt" }),
    ).rejects.toThrow("inside the allowed workspace");
    await expect(
      executeTool("workspace-files", { operation: "read", path: path.resolve("outside.txt") }),
    ).rejects.toThrow("Absolute file paths are not allowed");

    const written = await executeTool("workspace-files", {
      operation: "write",
      path: "workspace/note.txt",
      content: "hello",
    });
    expect(written.result).toEqual({ written: true, bytes: 5 });

    const read = await executeTool("workspace-files", {
      operation: "read",
      path: "workspace/note.txt",
    });
    expect(read.result).toEqual({ content: "hello" });

    const listed = await executeTool("workspace-files", {
      operation: "list",
      path: "workspace",
    });
    expect(listed.result).toContainEqual({ name: "note.txt", type: "file" });
  });

  it("renders prompt parameters and streams only through the task model role", async () => {
    const promptPath = path.join(artifactRoot, "prompt.txt");
    fs.writeFileSync(promptPath, "Summarize {{topic}} with {{options}}", "utf8");
    mocks.getToolById.mockReturnValue({
      id: "prompt-tool",
      sourceDir: artifactRoot,
      runtime: { type: "prompt", entry: "prompt.txt", modelRole: "task" },
    });
    mocks.streamTaskChatText.mockImplementation(async function* () {
      yield "answer ";
      yield "done";
    });

    const result = await executeTool("prompt-tool", {
      topic: "security",
      options: { concise: true },
    });
    expect(result.result).toBe("answer done");
    expect(mocks.streamTaskChatText).toHaveBeenCalledWith([
      {
        role: "user",
        content: 'Summarize security with {"concise":true}',
      },
    ]);
  });

  it("uses trusted Tavily configuration and reports upstream failures", async () => {
    process.env.TAVILY_API_KEY = "server-secret";
    mocks.getToolById.mockReturnValue({
      id: "search-tool",
      sourceDir: artifactRoot,
      runtime: { type: "search", engine: "tavily", maxResults: 2 },
    });
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        results: [{ title: "Result", url: "https://example.com", content: "Snippet" }],
      }),
    } as Response);

    const result = await executeTool("search-tool", { query: "mira" });
    expect(result.result).toEqual([
      { title: "Result", link: "https://example.com", snippet: "Snippet" },
    ]);
    const requestBody = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body));
    expect(requestBody).toMatchObject({ api_key: "server-secret", query: "mira", max_results: 2 });

    fetchMock.mockResolvedValue({ ok: false, status: 503 } as Response);
    await expect(executeTool("search-tool", { query: "mira" })).rejects.toThrow(
      "Tavily search failed: 503",
    );
  });
});
