// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarkdownText from "../MarkdownText";

const streamdownPropsSpy = vi.hoisted(() => vi.fn());

vi.mock("streamdown", () => ({
  Streamdown: ({ children, className, ...props }: {
    children?: string;
    className?: string;
    animated?: boolean;
    isAnimating?: boolean;
  }) => {
    streamdownPropsSpy({ children, className, ...props });
    return <div className={className}>{children}</div>;
  },
}));

describe("MarkdownText", () => {
  beforeEach(() => {
    streamdownPropsSpy.mockClear();
  });

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

  it("forwards streaming animation state", () => {
    render(
      <MarkdownText animated isAnimating>
        streaming
      </MarkdownText>,
    );

    expect(streamdownPropsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        animated: true,
        isAnimating: true,
        children: "streaming",
      }),
    );
  });

  it("enables LaTeX rendering for full markdown", () => {
    render(<MarkdownText>{"Inline $x^2$ and block $$y^2$$"}</MarkdownText>);

    expect(streamdownPropsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        plugins: expect.objectContaining({
          math: expect.objectContaining({
            name: "katex",
            type: "math",
          }),
        }),
      }),
    );
  });

  it("keeps optional plugins disabled for basic markdown", () => {
    render(<MarkdownText features="basic">{"$x^2$"}</MarkdownText>);

    expect(streamdownPropsSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ plugins: {} }),
    );
  });

  it("does not rerender unchanged markdown", () => {
    const { rerender } = render(<MarkdownText>stable</MarkdownText>);

    rerender(<MarkdownText>stable</MarkdownText>);

    expect(streamdownPropsSpy).toHaveBeenCalledTimes(1);
  });
});
