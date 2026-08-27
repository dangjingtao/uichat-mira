// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import MarkdownText from "../MarkdownText";

describe("MarkdownText LaTeX rendering", () => {
  it("renders inline and block LaTeX with KaTeX", () => {
    const { container } = render(
      <MarkdownText>{"Inline $x^2$\n\n$$\ny = \\frac{1}{2}\n$$"}</MarkdownText>,
    );

    expect(container.querySelectorAll(".katex")).toHaveLength(2);
    expect(container.querySelector(".katex-display")).toBeInTheDocument();
  });
});
