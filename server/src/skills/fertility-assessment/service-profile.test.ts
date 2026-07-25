import { describe, expect, it } from "vitest";
import { resolveFertilityServiceProfile } from "./service-profile.js";

describe("fertility service profile source selection", () => {
  it("keeps report and scoring profile ids as internal service context", () => {
    const profile = resolveFertilityServiceProfile({
      serviceProfile: {
        displayName: "林女士",
        assessmentScope: "female",
        currentGoal: "natural_conception",
        reportProfileId: "clinic-a",
        scoringProfileId: "doctor-reviewed-v2",
      },
    });

    expect(profile).toMatchObject({
      displayName: "林女士",
      assessmentScope: "female",
      reportProfileId: "clinic-a",
      scoringProfileId: "doctor-reviewed-v2",
    });
  });

  it("accepts the legacy reportTemplateId alias but rejects unsafe ids", () => {
    const legacy = resolveFertilityServiceProfile({
      serviceProfile: {
        displayName: "陈先生",
        assessmentScope: "male",
        currentGoal: "general",
        reportTemplateId: "mira-default",
      },
    });
    const unsafe = resolveFertilityServiceProfile({
      serviceProfile: {
        displayName: "陈先生",
        assessmentScope: "male",
        currentGoal: "general",
        reportProfileId: "../../outside",
        scoringProfileId: "bad id!",
      },
    });

    expect(legacy.reportProfileId).toBe("mira-default");
    expect(unsafe.reportProfileId).toBeUndefined();
    expect(unsafe.scoringProfileId).toBeUndefined();
  });
});