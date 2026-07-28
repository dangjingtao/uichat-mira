import { afterEach, describe, expect, it } from "vitest";
import {
  clearHarnessRegistry,
  registerCapability,
} from "@/harness/registry.js";
import {
  githubActionsTool,
  githubIssueTool,
  githubPullRequestTool,
  githubRepositoryTool,
} from "@/mcp/tools/github-domain.tool.js";
import type { SkillContext, SkillPackageOrigin } from "@/skills/context/types.js";
import {
  prepareSubAgent,
  resolveSubAgentHarnessToolIds,
} from "./subagent-runtime.js";
import { projectProviderVisibleToolSchema as projectPiProviderVisibleToolSchema } from "./pi-core.js";

const githubTools = [
  "github_repository",
  "github_issue",
  "github_pull_request",
  "github_actions",
];

const createGitHubSkillContext = (origin: SkillPackageOrigin): SkillContext => ({
  instruction: "Use the GitHub collaboration Skill.",
  primary: {
    id: "github-collaboration",
    version: "0.1.0",
    name: "GitHub 协作",
    body: "Inspect the requested repository using governed GitHub tools.",
    origin,
    execution: {
      context: "fork",
      agent: "subAgent",
      allowedTools: githubTools,
      runtimeBindings: [],
      workspaceBound: false,
    },
  },
  resources: [],
  disclosedResources: [],
  match: {
    source: "explicit",
    reason: "Explicit Skill invocation",
    score: 1,
    secondarySkillIds: [],
  },
});

const registerGitHubTools = () => {
  registerCapability(githubRepositoryTool);
  registerCapability(githubIssueTool);
  registerCapability(githubPullRequestTool);
  registerCapability(githubActionsTool);
};

afterEach(() => {
  clearHarnessRegistry();
});

describe("resolveSubAgentHarnessToolIds", () => {
  it("lets a built-in Skill select its declared subAgent tools", () => {
    expect(
      resolveSubAgentHarnessToolIds({
        origin: "built-in",
        declaredToolIds: githubTools,
        canonicalToolIds: [],
      }),
    ).toEqual(githubTools);
  });

  it("still preserves canonical exposure without duplicating tools", () => {
    expect(
      resolveSubAgentHarnessToolIds({
        origin: "built-in",
        declaredToolIds: githubTools,
        canonicalToolIds: ["github_repository", "read_open"],
      }),
    ).toEqual([
      "github_repository",
      "read_open",
      "github_issue",
      "github_pull_request",
      "github_actions",
    ]);
  });

  it.each(["user", "external"] as const)(
    "does not grant declared tools to a %s Skill",
    (origin) => {
      expect(
        resolveSubAgentHarnessToolIds({
          origin,
          declaredToolIds: githubTools,
          canonicalToolIds: ["github_repository"],
        }),
      ).toEqual(["github_repository"]);
    },
  );
});

describe("prepareSubAgent GitHub exposure", () => {
  it("binds all registered GitHub tools for a built-in Skill even when Main exposure is empty", () => {
    registerGitHubTools();

    const prepared = prepareSubAgent({
      goal: "Inspect dangjingtao/uichat-mira",
      skillContext: createGitHubSkillContext("built-in"),
      exposedHarnessToolIds: [],
    });

    expect(prepared.tools.map((tool) => tool.id)).toEqual([
      "skill_read_resource",
      ...githubTools,
    ]);
    expect(prepared.availableCapabilityCount).toBe(4);
    expect(prepared.missingCapabilities).toEqual([]);
  });

  it("does not let a user Skill grant itself GitHub tools", () => {
    registerGitHubTools();

    const prepared = prepareSubAgent({
      goal: "Inspect dangjingtao/uichat-mira",
      skillContext: createGitHubSkillContext("user"),
      exposedHarnessToolIds: [],
    });

    expect(prepared.tools.map((tool) => tool.id)).toEqual(["skill_read_resource"]);
    expect(prepared.availableCapabilityCount).toBe(0);
    expect(prepared.missingCapabilities).toHaveLength(4);
  });
});

describe("Ark Plan provider-visible schemas", () => {
  const composedSchema = {
    oneOf: [
      {
        type: "object",
        required: ["operation", "repository"],
        properties: { operation: { const: "get" }, repository: { type: "string" } },
      },
      {
        type: "object",
        required: ["operation", "repository"],
        properties: {
          operation: { const: "list_commits" },
          repository: { type: "string" },
          limit: { type: "integer" },
        },
      },
    ],
  };

  it("projects composition only for Ark Plan while preserving the runtime schema", () => {
    expect(
      projectPiProviderVisibleToolSchema({
        schema: composedSchema,
        projectComplexToolSchemas: true,
      }),
    ).toEqual({
      type: "object",
      additionalProperties: true,
      required: ["operation", "repository"],
      properties: {
        operation: { type: "string", enum: ["get", "list_commits"] },
        repository: { type: "string" },
      },
    });
    expect(composedSchema).toHaveProperty("oneOf");
    expect(
      projectPiProviderVisibleToolSchema({
        schema: composedSchema,
        projectComplexToolSchemas: false,
      }),
    ).toBe(composedSchema);
  });
});
