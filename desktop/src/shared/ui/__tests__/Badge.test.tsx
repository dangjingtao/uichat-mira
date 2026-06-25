// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Badge from "../Badge";

describe("Badge", () => {
  it("renders children", () => {
    render(<Badge>Label</Badge>);
    expect(screen.getByText("Label")).toBeInTheDocument();
  });

  it("applies variant class names", () => {
    const { rerender } = render(<Badge variant="primary">Primary</Badge>);
    expect(screen.getByText("Primary")).toHaveClass("bg-primary/10");

    rerender(<Badge variant="success">Success</Badge>);
    expect(screen.getByText("Success")).toHaveClass("bg-success/10");

    rerender(<Badge variant="danger">Danger</Badge>);
    expect(screen.getByText("Danger")).toHaveClass("bg-danger/10");
  });

  it("applies size class names", () => {
    const { rerender } = render(<Badge size="sm">Small</Badge>);
    expect(screen.getByText("Small")).toHaveClass("text-[11px]");

    rerender(<Badge size="md">Medium</Badge>);
    expect(screen.getByText("Medium")).toHaveClass("text-xs");
  });

  it("renders outline style with transparent background", () => {
    render(
      <Badge variant="primary" outline>
        Outline
      </Badge>,
    );
    const badge = screen.getByText("Outline");
    expect(badge).toHaveClass("border");
    expect(badge).toHaveClass("bg-transparent");
  });

  it("renders filled style by default", () => {
    render(<Badge variant="primary">Filled</Badge>);
    const badge = screen.getByText("Filled");
    expect(badge).toHaveClass("border-transparent");
  });
});
