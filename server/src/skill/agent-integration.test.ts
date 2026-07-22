import { describe, expect, it } from "vitest";
import {
  decorateTaskFrameWithSkill,
  filterToolExposureForSkill,
} from "./agent-integration";
import type { SkillRuntimeFrame } from "./types";

const skillFrame: SkillRuntimeFrame = {
  skillId: "document_review",
  skillVersion: "1.0.0",
  skillInstanceId: "skill-instance-1",
  name: "Document Review",
  status: "running",
  stage: "inspect",
  semanticContext: "Inspect the document before editing it.",
  allowedToolIds: ["read_open"],
  completionCriteria: ["Document risks are reviewed."],
  qualityCriteria: "Every conclusion is grounded in document evidence.",
};

describe("Skill Agent integration", () => {
  it("intersects Skill tool scope with the existing Harness exposure", () => {
    const filtered = filterToolExposureForSkill(
      {
        exposedTools: ["read_open", "edit_file", "web_search"],
        toolMeta: [
          {
            toolId: "read_open",
            title: "Read",
            description: "Read a file",
          },
          {
            toolId: "edit_file",
            title: "Edit",
            description: "Edit a file",
          },
          {
            toolId: "web_search",
            title: "Web",
            description: "Search the web",
          },
        ],
      },
      skillFrame,
    );

    expect(filtered.exposedTools).toEqual(["read_open"]);
    expect(filtered.toolMeta.map((item) => item.toolId)).toEqual(["read_open"]);
  });

  it("injects Skill semantics into a transient Planner task frame", () => {
    const frame = decorateTaskFrameWithSkill(
      {
        currentGoal: "Review contract.docx",
        currentSubtask: "Inspect the document",
        confirmedObjects: [],
        completionCriteria: ["The user request is fully handled."],
      },
      skillFrame,
    );

    expect(frame?.completionCriteria).toContain(
      "[Skill:document_review] Document risks are reviewed.",
    );
    expect(frame?.confirmedObjects[0]?.id).toBe(
      "skill-runtime:skill-instance-1",
    );
    expect(frame?.confirmedObjects[0]?.label).toContain(
      "Inspect the document before editing it.",
    );
    expect(frame?.remainingWork?.[0]).toContain("Active Skill: Document Review");
  });

  it("does not expand Harness exposure when no Skill is active", () => {
    const exposure = {
      exposedTools: ["read_open"],
      toolMeta: [
        {
          toolId: "read_open",
          title: "Read",
          description: "Read a file",
        },
      ],
    };

    expect(filterToolExposureForSkill(exposure, undefined)).toEqual(exposure);
  });
});
