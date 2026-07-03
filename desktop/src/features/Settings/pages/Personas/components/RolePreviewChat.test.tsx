// @vitest-environment jsdom
import assert from "node:assert/strict";
import { render, screen } from "@testing-library/react";
import { test, vi } from "vitest";
import "../i18n";
import RolePreviewChat from "./RolePreviewChat";

vi.mock("@/app/providers/ThemeProvider", () => ({
  useThemePreferences: () => ({
    colorTheme: "warm-neutral",
  }),
}));

test("RolePreviewChat renders a normal chat-style preview with role identity", () => {
  render(
    <RolePreviewChat
      roleName="Formal Reviewer"
      roleAvatarSrc={null}
      testInput="Can we ship this tomorrow?"
      assistantReply="I will respond according to the current role setup first."
      assistantTypingLabel="Formal Reviewer is replying"
    />,
  );

  assert.ok(screen.getByText("Formal Reviewer"));
  assert.ok(screen.getByText("Can we ship this tomorrow?"));
  assert.ok(screen.getByText("Formal Reviewer is replying"));
  assert.ok(
    screen.getByText("I will respond according to the current role setup first."),
  );
});
