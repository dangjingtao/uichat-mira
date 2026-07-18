import assert from "node:assert/strict";
import { test } from "vitest";
import { parseNextActionPlannerOutputWithDiagnostics } from "../planner/parse";
import { validateNextAction } from "../planner/validate";

test("normalizes an exposed direct tool action into canonical use_tool", () => {
  const parsed = parseNextActionPlannerOutputWithDiagnostics(
    JSON.stringify({
      type: "read_open",
      path: "index.html",
      reason: "需要先确认当前工作空间下 index.html 的内容，以便将其转换为 PPT。",
    }),
  );

  assert.equal(parsed.action, null);
  assert.equal(
    parsed.parseErrorReason,
    'Planner action type "read_open" is not a canonical action type.',
  );
  assert.deepEqual(parsed.rawDecision, {
    type: "read_open",
    path: "index.html",
    reason: "需要先确认当前工作空间下 index.html 的内容，以便将其转换为 PPT。",
  });

  const validated = validateNextAction(parsed, ["read_open"]);

  assert.deepEqual(validated.action, {
    type: "use_tool",
    toolId: "read_open",
    args: {
      path: "index.html",
    },
    reason: "需要先确认当前工作空间下 index.html 的内容，以便将其转换为 PPT。",
  });
  assert.equal(validated.parseErrorReason, undefined);
  assert.deepEqual(validated.parseWarnings, [
    "direct_tool_action_normalized",
  ]);
});

test("preserves an object-valued args field when normalizing a direct tool action", () => {
  const parsed = parseNextActionPlannerOutputWithDiagnostics(
    JSON.stringify({
      type: "read_open",
      args: {
        path: "index.html",
      },
    }),
  );

  const validated = validateNextAction(parsed, ["read_open"]);

  assert.deepEqual(validated.action, {
    type: "use_tool",
    toolId: "read_open",
    args: {
      path: "index.html",
    },
    reason: "Planner selected tool read_open.",
  });
  assert.deepEqual(validated.parseWarnings, [
    "missing_reason_defaulted",
    "direct_tool_action_normalized",
  ]);
});

test("does not reinterpret an unknown unexposed action as an executable tool", () => {
  const parsed = parseNextActionPlannerOutputWithDiagnostics(
    JSON.stringify({
      type: "invented_tool",
      path: "index.html",
    }),
  );

  const validated = validateNextAction(parsed, ["read_open"]);

  assert.equal(validated.action.type, "error");
  assert.match(validated.parseErrorReason ?? "", /invented_tool/);
});