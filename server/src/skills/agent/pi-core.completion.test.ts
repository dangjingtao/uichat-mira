import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SkillAgentExecutionInput } from "./types.js";

const mocks = vi.hoisted(() => ({
  completion: "",
}));

vi.mock("@/providers/catalog.js", () => ({
  getProviderDefinition: () => ({ chatAdapter: "openai-compatible" }),
}));

vi.mock("@/services/provider-proxy.service/resolution.js", () => ({
  resolveAgentTaskProvider: () => ({
    providerCode: "test-provider",
    providerTemplateCode: "openai-compatible-custom",
    baseUrl: "http://localhost:1234/v1",
    model: "test-model",
    apiKey: "test-key",
    params: {},
  }),
}));

vi.mock("@earendil-works/pi-agent-core", () => {
  class Agent {
    state: { messages: unknown[] };

    constructor() {
      this.state = { messages: [] };
    }

    async prompt() {
      this.state.messages.push({ role: "assistant", content: "" });
      this.state.messages.push({
        role: "assistant",
        content: [{ type: "text", text: mocks.completion }],
      });
    }
  }
  return { Agent };
});

import { runPiSkillAgent } from "./pi-core.js";

const execution = (): SkillAgentExecutionInput => ({
  goal: "Inspect the repository",
  skillContext: {
    instruction: "Use the GitHub Skill.",
    primary: {
      id: "github-collaboration",
      version: "0.1.0",
      name: "GitHub 协作",
      body: "Inspect with the supplied governed tools.",
    },
    resources: [],
    disclosedResources: [],
  },
  threadId: "thread-1",
});

describe("runPiSkillAgent completion requirements", () => {
  beforeEach(() => {
    mocks.completion = "";
  });

  it.each([
    JSON.stringify({ status: "completed", summary: "done" }),
    "```json\n" + JSON.stringify({ status: "completed", summary: "done" }) + "\n```",
  ])("accepts a valid completed JSON envelope", async (completion) => {
    mocks.completion = completion;
    const result = await runPiSkillAgent({ execution: execution(), tools: [] });
    expect(result.status).toBe("completed");
  });

  it("does not let an empty needs_input requirement list reach Parent", async () => {
    mocks.completion = JSON.stringify({
      status: "needs_input",
      summary: "need a repository",
      requirements: [],
    });
    const result = await runPiSkillAgent({ execution: execution(), tools: [] });
    expect(result).toMatchObject({
      status: "failed",
      recoverable: true,
      error: "subAgent returned needs_input without valid requirements",
    });
  });

  it("does not coerce an unknown requirement kind into user_input", async () => {
    mocks.completion = JSON.stringify({
      status: "needs_input",
      requirements: [
        { kind: "unknown", description: "need something", requiredFor: "goal" },
      ],
    });
    const result = await runPiSkillAgent({ execution: execution(), tools: [] });
    expect(result.status).toBe("failed");
  });

  it("preserves a valid user_input requirement", async () => {
    mocks.completion = JSON.stringify({
      status: "needs_input",
      requirements: [
        {
          kind: "user_input",
          description: "Provide the repository URL.",
          requiredFor: "repository",
        },
      ],
    });
    const result = await runPiSkillAgent({ execution: execution(), tools: [] });
    expect(result).toMatchObject({
      status: "needs_input",
      requirements: [
        {
          kind: "user_input",
          description: "Provide the repository URL.",
          requiredFor: "repository",
        },
      ],
    });
  });
});
