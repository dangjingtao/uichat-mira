import { describe, expect, it } from "vitest";
import { resolveSubAgentHarnessToolIds } from "./subagent-runtime.js";

describe("resolveSubAgentHarnessToolIds", () => {
  const githubTools = [
    "github_repository",
    "github_issue",
    "github_pull_request",
    "github_actions",
  ];

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
