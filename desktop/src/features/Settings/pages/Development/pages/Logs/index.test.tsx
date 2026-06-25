// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import DevelopmentLogs, { pushCappedLogEntries } from "./index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) =>
      options?.count ? `${key}:${options.count}` : key,
  }),
}));

vi.mock("@/shared/api/logs", () => ({
  streamRuntimeLogs: vi.fn(async (_input, onEvent) => {
    await onEvent({
      type: "snapshot",
      entries: Array.from({ length: 105 }, (_, index) => `line-${index + 1}`),
    });
    await new Promise(() => {});
  }),
}));

describe("DevelopmentLogs", () => {
  it("caps appended entries to the latest limit", () => {
    const result = pushCappedLogEntries(
      Array.from({ length: 99 }, (_, index) => `line-${index + 1}`),
      ["line-100", "line-101"],
      100,
    );

    expect(result).toHaveLength(100);
    expect(result[0]).toBe("line-2");
    expect(result.at(-1)).toBe("line-101");
  });

  it("renders only the latest 100 streamed log lines", async () => {
    const { container } = render(<DevelopmentLogs />);

    expect(
      await screen.findByText("settings.development.logs.status.live"),
    ).toBeInTheDocument();
    expect(container.textContent).toContain("line-105");
    expect(container.textContent).toContain("line-6");
    expect(container.textContent).not.toContain("line-1\nline-2\n");
  });
});
