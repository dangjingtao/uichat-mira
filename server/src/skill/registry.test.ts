import { beforeEach, describe, expect, it } from "vitest";
import {
  clearSkillRegistryForTests,
  getSkillRegistration,
  listSkillDefinitions,
  registerSkill,
  resolveMatchingSkillRegistration,
} from "./registry";

const createRegistration = (input: {
  id: string;
  version: string;
  score: number;
}) => ({
  definition: {
    id: input.id,
    version: input.version,
    name: input.id,
    description: input.id,
    allowedToolIds: [],
    semantics: {
      purpose: input.id,
      usageGuidance: input.id,
      decisionPolicy: input.id,
      qualityCriteria: input.id,
      completionCriteria: [input.id],
    },
  },
  match: () => input.score,
  adapter: {
    initialize: () => ({}),
    getRuntimeFrame: () => ({}),
    reduceEvidence: (state: unknown) => state,
    evaluate: () => ({ status: "running" as const }),
  },
});

describe("Skill Registry", () => {
  beforeEach(() => {
    clearSkillRegistryForTests();
  });

  it("keeps versioned registrations and exposes the latest definition", () => {
    registerSkill(createRegistration({ id: "alpha", version: "1.0.0", score: 0.6 }));
    registerSkill(createRegistration({ id: "alpha", version: "2.0.0", score: 0.7 }));

    expect(getSkillRegistration("alpha", "1.0.0")?.definition.version).toBe(
      "1.0.0",
    );
    expect(getSkillRegistration("alpha")?.definition.version).toBe("2.0.0");
    expect(listSkillDefinitions()).toHaveLength(1);
  });

  it("selects the best semantic match above its threshold", async () => {
    registerSkill(createRegistration({ id: "alpha", version: "1.0.0", score: 0.6 }));
    registerSkill(createRegistration({ id: "beta", version: "1.0.0", score: 0.9 }));

    const resolved = await resolveMatchingSkillRegistration({
      runId: "run-1",
      goalText: "test",
    });

    expect(resolved?.definition.id).toBe("beta");
  });

  it("does not reselect excluded skills", async () => {
    registerSkill(createRegistration({ id: "alpha", version: "1.0.0", score: 0.9 }));
    registerSkill(createRegistration({ id: "beta", version: "1.0.0", score: 0.8 }));

    const resolved = await resolveMatchingSkillRegistration(
      {
        runId: "run-1",
        goalText: "test",
      },
      { excludedSkillIds: ["alpha"] },
    );

    expect(resolved?.definition.id).toBe("beta");
  });
});
