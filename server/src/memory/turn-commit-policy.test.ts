import assert from "node:assert/strict";
import { describe, it } from "vitest";
import { shouldCommitTurnToMemory } from "./turn-commit-policy.js";

describe("shouldCommitTurnToMemory", () => {
  it("accepts ordinary Chat turns", () => {
    assert.equal(shouldCommitTurnToMemory(undefined), true);
    assert.equal(shouldCommitTurnToMemory({}), true);
  });

  it("accepts only completed Agent turns", () => {
    assert.equal(
      shouldCommitTurnToMemory({ agent: { status: "completed" } }),
      true,
    );
    for (const status of [
      "queued",
      "running",
      "waiting_approval",
      "waiting_user",
      "failed",
      "blocked",
      "cancelled",
    ]) {
      assert.equal(shouldCommitTurnToMemory({ agent: { status } }), false);
    }
  });

  it("keeps RAG outside V1", () => {
    assert.equal(
      shouldCommitTurnToMemory({ rag: { enabled: true } }),
      false,
    );
  });
});
