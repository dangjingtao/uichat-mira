// @vitest-environment jsdom
import assert from "node:assert/strict";
import { act, renderHook, waitFor } from "@testing-library/react";
import { beforeEach, test, vi } from "vitest";
import "../i18n";
import { useRoles } from "./useRoles";

const listRolesMock = vi.fn();
const updateRoleMock = vi.fn();
const messageSuccessMock = vi.fn();
const messageErrorMock = vi.fn();

vi.mock("@/shared/api/roles", () => ({
  createRole: vi.fn(),
  deleteRole: vi.fn(),
  listRoles: (...args: unknown[]) => listRolesMock(...args),
  updateRole: (...args: unknown[]) => updateRoleMock(...args),
}));

vi.mock("@/shared/ui/Message", () => ({
  message: {
    success: (...args: unknown[]) => messageSuccessMock(...args),
    error: (...args: unknown[]) => messageErrorMock(...args),
    info: vi.fn(),
  },
}));

vi.mock("@/shared/ui/Modal", () => ({
  Modal: {
    confirm: vi.fn(),
  },
}));

const baseRole = {
  id: "role-1",
  name: "Formal Reviewer",
  summary: "Persisted summary",
  avatarId: null,
  status: "active" as const,
  tags: ["review"],
  prompt: {
    description: "Persisted description",
    worldview: "Persisted worldview",
    persona: "Persisted persona",
    scenario: "Persisted scenario",
    exampleDialogues: "",
    style: "",
    constraints: "",
  },
  llmProfile: {
    temperature: 0.4,
  },
  createdAt: "2025-01-01T00:00:00.000Z",
  updatedAt: "2025-01-01T00:00:00.000Z",
};

beforeEach(() => {
  listRolesMock.mockReset();
  updateRoleMock.mockReset();
  messageSuccessMock.mockReset();
  messageErrorMock.mockReset();
  listRolesMock.mockResolvedValue([baseRole]);
});

test("useRoles persists llm profile from the drawer without sending unrelated form drafts", async () => {
  updateRoleMock.mockResolvedValue({
    ...baseRole,
    llmProfile: {
      temperature: 0.8,
      maxTokens: 512,
    },
  });

  const { result } = renderHook(() => useRoles());

  await waitFor(() => {
    assert.equal(result.current.isLoading, false);
  });

  act(() => {
    result.current.setDraftName("Unsaved draft name");
    result.current.patchDraftLlmProfile("temperature", "0.8");
    result.current.patchDraftLlmProfile("maxTokens", "512");
  });

  act(() => {
    result.current.handleSaveLlmProfile();
  });

  await waitFor(() => {
    assert.equal(updateRoleMock.mock.calls.length, 1);
  });

  assert.deepEqual(updateRoleMock.mock.calls[0], [
    "role-1",
    {
      llmProfile: {
        temperature: 0.8,
        maxTokens: 512,
      },
    },
  ]);

  await waitFor(() => {
    assert.deepEqual(result.current.draftLlmProfile, {
      temperature: 0.8,
      maxTokens: 512,
    });
  });

  assert.equal(result.current.draftName, "Unsaved draft name");
  assert.deepEqual(messageSuccessMock.mock.calls[0], [
    "Role model parameters saved",
  ]);
});
