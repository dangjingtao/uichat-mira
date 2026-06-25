// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { StatusIndicator } from "../StatusIndicator";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("StatusIndicator", () => {
  const getDot = (container: HTMLElement) =>
    container.querySelector("span > span");

  it("renders running status dot", () => {
    const { container } = render(<StatusIndicator status="running" />);
    expect(getDot(container)).toHaveClass("bg-success");
  });

  it("renders stopped status dot", () => {
    const { container } = render(<StatusIndicator status="stopped" />);
    expect(getDot(container)).toHaveClass("bg-danger");
  });

  it("renders unknown status dot", () => {
    const { container } = render(<StatusIndicator status="unknown" />);
    expect(getDot(container)).toHaveClass("bg-warning");
  });

  it("applies small size", () => {
    const { container } = render(<StatusIndicator status="running" size="sm" />);
    const dot = getDot(container);
    expect(dot).toHaveClass("h-2.5");
    expect(dot).toHaveClass("w-2.5");
  });

  it("applies medium size by default", () => {
    const { container } = render(<StatusIndicator status="running" />);
    const dot = getDot(container);
    expect(dot).toHaveClass("h-3");
    expect(dot).toHaveClass("w-3");
  });
});
