import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SkillLoader } from "../context/loader.js";
import { SkillScanner } from "../context/scanner.js";
import { getSkillDirectiveHandoffRuntime } from "../flow/registry.js";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const skillsRoot = path.resolve(currentDir, "..");

describe("fertility-assessment Skill package", () => {
  it("exposes one discoverable Skill with progressive-disclosure references", async () => {
    const manifests = await new SkillScanner().scan([skillsRoot]);
    const fertilitySkills = manifests.filter((manifest) =>
      manifest.id.startsWith("fertility-"),
    );

    expect(fertilitySkills.map((manifest) => manifest.id)).toEqual([
      "fertility-assessment",
    ]);

    const manifest = fertilitySkills[0];
    expect(manifest).toBeDefined();

    const resources = await new SkillLoader().listResources(manifest!);
    expect(resources.map((resource) => resource.uri)).toEqual(
      expect.arrayContaining([
        "skill://fertility-assessment/references/assessment-framework.md",
        "skill://fertility-assessment/references/report-contract.md",
      ]),
    );
  });

  it("keeps report generation as an internal handoff owned by fertility-assessment", () => {
    expect(getSkillDirectiveHandoffRuntime("fertility-report")).toMatchObject({
      skillId: "fertility-assessment",
      version: "1.0.0",
    });
  });
});
