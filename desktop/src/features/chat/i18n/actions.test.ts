import assert from "node:assert/strict";
import { test } from "vitest";
import i18n from "@/shared/i18n";

test("chat message copy feedback resolves in every supported language", () => {
  const zh = i18n.getFixedT("zh-CN");
  const en = i18n.getFixedT("en-US");

  assert.equal(zh("chat.thread.actions.copySuccess"), "已复制");
  assert.equal(zh("chat.thread.actions.copyFailed"), "复制失败，请重试");
  assert.equal(en("chat.thread.actions.copySuccess"), "Copied");
  assert.equal(
    en("chat.thread.actions.copyFailed"),
    "Copy failed, please try again",
  );
});
