// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Tooltip from "../Tooltip";

describe("Tooltip", () => {
  it("renders children", () => {
    render(
      <Tooltip text="Hint">
        <span data-testid="child">Hover me</span>
      </Tooltip>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("sets tooltip attributes on wrapper", () => {
    render(
      <Tooltip text="Hint">
        <span data-testid="child">Hover me</span>
      </Tooltip>,
    );
    const wrapper = screen.getByTestId("child").parentElement;
    expect(wrapper).toHaveAttribute("data-tooltip-content", "Hint");
    expect(wrapper).toHaveAttribute("data-tooltip-id");
  });

  it("renders children only when text is empty", () => {
    const { container } = render(
      <Tooltip text="  ">
        <span data-testid="child">Hover me</span>
      </Tooltip>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(container.querySelector("[data-tooltip-id]")).not.toBeInTheDocument();
  });
});
