// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import PersonalizationSettings from "./index";

const memoryApi = vi.hoisted(() => ({
  getMemoryOverview: vi.fn(),
  updateMemorySettings: vi.fn(),
  createMemory: vi.fn(),
  updateMemory: vi.fn(),
  deleteMemory: vi.fn(),
}));

vi.mock("@/shared/api/memory", () => memoryApi);

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const emptyOverview = {
  enabled: true,
  records: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  memoryApi.getMemoryOverview.mockResolvedValue(emptyOverview);
  memoryApi.updateMemorySettings.mockImplementation(async (enabled: boolean) => ({
    enabled,
    records: [],
  }));
  memoryApi.createMemory.mockResolvedValue(emptyOverview);
  memoryApi.updateMemory.mockResolvedValue(emptyOverview);
  memoryApi.deleteMemory.mockResolvedValue(emptyOverview);
});

describe("PersonalizationSettings", () => {
  it("loads real memory state and opens the existing memory drawer", async () => {
    render(<PersonalizationSettings />);

    expect(
      screen.getByText("settings.personalization.tone.label"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("settings.personalization.instructions.label"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("settings.personalization.aboutYou.nickname"),
    ).toBeInTheDocument();

    await waitFor(() => {
      expect(memoryApi.getMemoryOverview).toHaveBeenCalledTimes(1);
    });

    await userEvent.click(
      screen.getByRole("button", {
        name: "settings.personalization.memory.manage",
      }),
    );

    expect(
      screen.getByText("settings.personalization.memory.drawerTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getByLabelText("settings.personalization.memory.updateLabel"),
    ).toBeInTheDocument();
  });

  it("persists the existing memory switch and disables management", async () => {
    render(<PersonalizationSettings />);

    await waitFor(() => {
      expect(memoryApi.getMemoryOverview).toHaveBeenCalledTimes(1);
    });
    await userEvent.click(
      screen.getByRole("switch", {
        name: "settings.personalization.memory.enable",
      }),
    );

    await waitFor(() => {
      expect(memoryApi.updateMemorySettings).toHaveBeenCalledWith(false);
    });
    expect(
      screen.getByRole("button", {
        name: "settings.personalization.memory.manage",
      }),
    ).toBeDisabled();
  });

  it("creates a manual memory from the existing drawer input", async () => {
    memoryApi.createMemory.mockResolvedValue({
      enabled: true,
      records: [
        {
          id: "mem-1",
          kind: "preference",
          content: "技术讨论先给结论。",
          origin: "manual",
          createdAt: "2026-08-01T00:00:00.000Z",
          updatedAt: "2026-08-01T00:00:00.000Z",
        },
      ],
    });
    render(<PersonalizationSettings />);

    await waitFor(() => {
      expect(memoryApi.getMemoryOverview).toHaveBeenCalledTimes(1);
    });
    await userEvent.click(
      screen.getByRole("button", {
        name: "settings.personalization.memory.manage",
      }),
    );
    await userEvent.type(
      screen.getByLabelText("settings.personalization.memory.updateLabel"),
      "技术讨论先给结论。",
    );
    await userEvent.click(
      screen.getByRole("button", {
        name: "settings.personalization.memory.add",
      }),
    );

    await waitFor(() => {
      expect(memoryApi.createMemory).toHaveBeenCalledWith({
        kind: "preference",
        content: "技术讨论先给结论。",
      });
    });
    expect(screen.getByText("技术讨论先给结论。")).toBeInTheDocument();
  });
});
