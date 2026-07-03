// @vitest-environment jsdom
import assert from "node:assert/strict";
import { render, screen } from "@testing-library/react";
import { test, vi } from "vitest";
import "../i18n";
import RoleLlmProfileCard from "./RoleLlmProfileCard";

test("RoleLlmProfileCard shows the configured count and summary", () => {
  render(
    <RoleLlmProfileCard
      profile={{ temperature: 0.6, topP: 0.9, maxTokens: 768 }}
      onClick={vi.fn()}
    />,
  );

  assert.ok(screen.getByText("Model Parameters"));
  assert.ok(screen.getByText("3 configured"));
  assert.ok(screen.getByText("Temperature 0.6 · Top P 0.9 · Max Output 768"));
});

test("RoleLlmProfileCard falls back to the empty summary", () => {
  render(<RoleLlmProfileCard profile={{}} onClick={vi.fn()} />);

  assert.ok(
    screen.getByText(
      "No role-specific generation settings yet. Chat defaults will be used.",
    ),
  );
});
