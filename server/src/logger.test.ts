import assert from "node:assert/strict";
import { test } from "vitest";
import { subscribeToLogLines, writeStructuredLog } from "@/logger";

test("writeStructuredLog notifies live subscribers with the written line", () => {
  const seen: string[] = [];
  const unsubscribe = subscribeToLogLines((line) => {
    seen.push(line);
  });

  writeStructuredLog("info", {
    msg: "logger subscriber test",
    event: "logger-test",
  });
  unsubscribe();

  assert.equal(seen.length, 1);
  assert.match(seen[0] ?? "", /logger subscriber test/);
});
