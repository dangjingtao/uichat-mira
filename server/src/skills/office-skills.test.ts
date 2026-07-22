import { describe, expect, it } from "vitest";
import { getBuiltInSkillPackage, listBuiltInSkillPackages } from "./registry.js";

describe("WenShu built-in Skill packages", () => {
  it("publishes the three installable WenShu Office packages", () => {
    expect(listBuiltInSkillPackages().map((skill) => skill.id).sort()).toEqual([
      "pdf",
      "pptx",
      "xlsx",
    ]);
  });

  it("binds all three packages to the shared optional WenShu runtime pack", () => {
    for (const skill of listBuiltInSkillPackages()) {
      expect(skill.runtimePack).toEqual({
        id: "wenshu-office",
        version: "1.0.0",
        required: true,
      });
    }
  });

  it("keeps Agent/Harness integration explicitly deferred", () => {
    for (const skill of listBuiltInSkillPackages()) {
      expect(skill.agentIntegration.status).toBe("deferred");
      expect(skill.agentIntegration.requiredContracts).toContain("SkillInstance state/stage");
      expect(skill.agentIntegration.requiredContracts).toContain("Evidence-driven reducer");
      expect(skill.agentIntegration.requiredContracts).toContain("stage-specific tool constraints");
    }
  });

  it("keeps task-level runtime capability identity without registering it as a Skill action", () => {
    expect(getBuiltInSkillPackage("pdf")?.runtimeCapabilities).toEqual(["office_pdf"]);
    expect(getBuiltInSkillPackage("xlsx")?.runtimeCapabilities).toEqual(["office_spreadsheet"]);
    expect(getBuiltInSkillPackage("pptx")?.runtimeCapabilities).toEqual(["office_presentation"]);
  });

  it("returns null for unknown packages", () => {
    expect(getBuiltInSkillPackage("unknown")).toBeNull();
  });
});
