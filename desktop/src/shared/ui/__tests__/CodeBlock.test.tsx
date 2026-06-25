// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CodeBlock from "../CodeBlock";

describe("CodeBlock", () => {
  it("renders children", () => {
    render(<CodeBlock>const x = 1;</CodeBlock>);
    expect(screen.getByText("const x = 1;")).toBeInTheDocument();
  });

  it("applies tone class names", () => {
    const { container, rerender } = render(
      <CodeBlock tone="default">Default</CodeBlock>,
    );
    expect(container.firstChild).toHaveClass("bg-surface-secondary/55");

    rerender(<CodeBlock tone="terminal">Terminal</CodeBlock>);
    expect(container.firstChild).toHaveClass("bg-surface-secondary/55");
  });

  it("applies custom className", () => {
    const { container } = render(
      <CodeBlock className="custom-class">Content</CodeBlock>,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
