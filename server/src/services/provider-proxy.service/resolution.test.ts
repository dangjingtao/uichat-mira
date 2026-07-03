import assert from "node:assert/strict";
import { test } from "vitest";
import { applyRoleSpecificProviderParams } from "./resolution.js";

test("applyRoleSpecificProviderParams disables thinking only for task ollama", () => {
  assert.deepEqual(
    applyRoleSpecificProviderParams("task", "ollama", { temperature: 0 }),
    {
      temperature: 0,
      think: false,
    },
  );
});

test("applyRoleSpecificProviderParams disables thinking only for task volcengine", () => {
  assert.deepEqual(
    applyRoleSpecificProviderParams("task", "volcengine", { temperature: 0 }),
    {
      temperature: 0,
      thinking: false,
    },
  );
});

test("applyRoleSpecificProviderParams leaves non-task roles unchanged", () => {
  const params = { temperature: 0.7 };

  assert.deepEqual(applyRoleSpecificProviderParams("llm", "ollama", params), params);
  assert.deepEqual(
    applyRoleSpecificProviderParams("evaluation", "volcengine", params),
    params,
  );
});
