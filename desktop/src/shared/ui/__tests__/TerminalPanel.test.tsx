// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import TerminalPanel from "../TerminalPanel";

describe("TerminalPanel", () => {
  it("renders children", () => {
    render(<TerminalPanel>Output</TerminalPanel>);
    expect(screen.getByText("Output")).toBeInTheDocument();
  });

  it("renders title and badge", () => {
    render(
      <TerminalPanel title="Console" badge={<span data-testid="badge" />}>
        Output
      </TerminalPanel>,
    );
    expect(screen.getByText("Console")).toBeInTheDocument();
    expect(screen.getByTestId("badge")).toBeInTheDocument();
  });

  it("does not render header when title and badge are absent", () => {
    const { container } = render(<TerminalPanel>Output</TerminalPanel>);
    expect(container.querySelector(".border-b")).not.toBeInTheDocument();
  });

  it("renders meta section", () => {
    render(
      <TerminalPanel meta={<span data-testid="meta">Info</span>}>Output</TerminalPanel>,
    );
    expect(screen.getByTestId("meta")).toBeInTheDocument();
  });

  it("renders footer", () => {
    render(
      <TerminalPanel footer={<span data-testid="footer">Status</span>}>
        Output
      </TerminalPanel>,
    );
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("applies plain variant", () => {
    const { container } = render(
      <TerminalPanel variant="plain">Output</TerminalPanel>,
    );
    expect(container.firstChild).toHaveClass("rounded-none");
    expect(container.firstChild).toHaveClass("border-0");
  });

  it("forwards scrollRef", () => {
    const scrollRef = vi.fn();
    render(<TerminalPanel scrollRef={scrollRef}>Output</TerminalPanel>);
    expect(scrollRef).toHaveBeenCalled();
  });

  it("applies custom className", () => {
    const { container } = render(
      <TerminalPanel className="custom-class">Output</TerminalPanel>,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
