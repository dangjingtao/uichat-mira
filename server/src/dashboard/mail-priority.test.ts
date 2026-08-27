import { describe, expect, it } from "vitest";
import { priorityFromScore, scoreMailPriority } from "./mail-priority.js";

const signals = {
  deadlineWithin24Hours: false,
  explicitActionRequired: false,
  blocksWork: false,
  securityOrLegalRisk: false,
  financialImpact: false,
  directlyAddressed: false,
  bulkOrMarketing: false,
  informationalOnly: false,
};

describe("mail priority rubric", () => {
  it("uses stable score thresholds for attention levels", () => {
    expect(priorityFromScore(24)).toBeNull();
    expect(priorityFromScore(25)).toBe("normal");
    expect(priorityFromScore(50)).toBe("high");
    expect(priorityFromScore(75)).toBe("urgent");
  });

  it("combines analyzed signals with trusted mailbox flags", () => {
    expect(scoreMailPriority(
      { ...signals, deadlineWithin24Hours: true, explicitActionRequired: true },
      { isRead: false, isFlagged: false },
    )).toBe(50);
    expect(scoreMailPriority(
      { ...signals, explicitActionRequired: true, bulkOrMarketing: true },
      { isRead: false, isFlagged: false },
    )).toBe(0);
  });
});
