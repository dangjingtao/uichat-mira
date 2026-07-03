// @vitest-environment jsdom
import assert from "node:assert/strict";
import { fireEvent, render, screen } from "@testing-library/react";
import { test, vi } from "vitest";
import "../i18n";
import RoleLlmProfileDrawer from "./RoleLlmProfileDrawer";

test("RoleLlmProfileDrawer renders the six role-level model fields", () => {
  render(
    <RoleLlmProfileDrawer
      open
      profile={{ temperature: 0.7, topP: 0.9 }}
      onClose={vi.fn()}
      onChange={vi.fn()}
      onReset={vi.fn()}
      onSave={vi.fn()}
    />,
  );

  assert.equal(screen.getAllByRole("spinbutton").length, 6);
  assert.ok(screen.getByDisplayValue("0.7"));
  assert.ok(screen.getByDisplayValue("0.9"));
});

test("RoleLlmProfileDrawer forwards field edits", () => {
  const onChange = vi.fn();

  render(
    <RoleLlmProfileDrawer
      open
      profile={{}}
      onClose={vi.fn()}
      onChange={onChange}
      onReset={vi.fn()}
      onSave={vi.fn()}
    />,
  );

  fireEvent.change(screen.getByLabelText("Temperature"), {
    target: { value: "0.8" },
  });

  assert.deepEqual(onChange.mock.calls[0], ["temperature", "0.8"]);
});
