// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MarkdownText from "../MarkdownText";

describe("MarkdownText", () => {
  it("renders children", () => {
    render(<MarkdownText>hello world</MarkdownText>);
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("renders empty string by default", () => {
    const { container } = render(<MarkdownText />);
    expect(container.firstChild).toBeInTheDocument();
  });

  it("applies default markdown className", () => {
    const { container } = render(<MarkdownText>text</MarkdownText>);
    expect(container.firstChild).toHaveClass("max-w-none");
    expect(container.firstChild).toHaveClass("break-words");
  });

  it("appends custom className", () => {
    const { container } = render(
      <MarkdownText className="custom-class">text</MarkdownText>,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
