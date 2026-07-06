// @vitest-environment jsdom
import type { SVGProps } from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { UChatThreadHeader } from "../UChatThreadHeader";

const MockIcon = (props: SVGProps<SVGSVGElement>) => (
  <svg data-testid="mock-icon" {...props} />
);

describe("UChatThreadHeader", () => {
  it("renders title", () => {
    render(<UChatThreadHeader title="Thread A" badges={[]} />);
    expect(screen.getByText("Thread A")).toBeInTheDocument();
  });

  it("renders badges with icons", () => {
    render(
      <UChatThreadHeader
        title="Thread A"
        badges={[
          { key: "kb", name: "Knowledge Base", icon: MockIcon },
          { key: "agent", name: "Agent", icon: MockIcon },
        ]}
      />,
    );

    expect(screen.getAllByTestId("mock-icon")).toHaveLength(2);
    const wrappers = screen
      .getAllByTestId("mock-icon")
      .map((el) => el.parentElement?.parentElement);
    expect(wrappers[0]).toHaveAttribute("data-tooltip-content", "Knowledge Base");
    expect(wrappers[1]).toHaveAttribute("data-tooltip-content", "Agent");
  });

  it("renders no badges when badges is empty", () => {
    const { container } = render(
      <UChatThreadHeader title="Thread A" badges={[]} />,
    );
    expect(container.querySelector("[data-tooltip-id]")).not.toBeInTheDocument();
  });

  it("truncates long title", () => {
    render(
      <UChatThreadHeader title="A very long thread title that should be truncated" badges={[]} />,
    );
    const title = screen.getByText("A very long thread title that should be truncated");
    expect(title).toHaveClass("truncate");
  });
});
