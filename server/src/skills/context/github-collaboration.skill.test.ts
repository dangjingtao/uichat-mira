import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SkillLoader } from "./loader.js";
import { SkillScanner } from "./scanner.js";

const skillsRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);

describe("GitHub collaboration Skill package", () => {
  it("discovers the public package and exposes its progressive resources", async () => {
    const manifests = await new SkillScanner().scan([skillsRoot]);
    const manifest = manifests.find((item) => item.id === "github-collaboration");

    expect(manifest).toMatchObject({
      id: "github-collaboration",
      name: "GitHub 协作",
      version: "0.1.0",
      category: "工程研发",
      source: "Mira Lab",
      origin: "built-in",
      execution: {
        context: "fork",
        agent: "subAgent",
        allowedTools: [
          "github_repository",
          "github_issue",
          "github_pull_request",
          "github_actions",
        ],
        workspaceBound: false,
      },
    });

    const resources = await new SkillLoader().listResources(manifest!);
    expect(resources.map((item) => item.uri).sort()).toEqual(
      [
        "skill://github-collaboration/references/actions-triage.md",
        "skill://github-collaboration/references/delivery-flow.md",
        "skill://github-collaboration/references/issue-stewardship.md",
        "skill://github-collaboration/references/pr-review.md",
        "skill://github-collaboration/references/project-pulse.md",
        "skill://github-collaboration/templates/delivery-summary.md",
        "skill://github-collaboration/templates/issue-template.md",
        "skill://github-collaboration/templates/pr-review-template.md",
      ].sort(),
    );
  });
});
