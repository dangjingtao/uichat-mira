// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Card from "../Card";

describe("Card", () => {
  it("renders children", () => {
    render(
      <Card>
        <span data-testid="child">content</span>
      </Card>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
  });

  it("renders label/value/description when no children", () => {
    render(<Card label="Total" value="100" description="All records" />);
    expect(screen.getByText("Total")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("All records")).toBeInTheDocument();
  });

  it("prefers children over label/value/description", () => {
    render(
      <Card label="Total" value="100">
        <span data-testid="child">custom</span>
      </Card>,
    );
    expect(screen.getByTestId("child")).toBeInTheDocument();
    expect(screen.queryByText("Total")).not.toBeInTheDocument();
  });

  it("applies variant class names", () => {
    const { container, rerender } = render(
      <Card variant="default">Default</Card>,
    );
    expect(container.firstChild).toHaveClass("bg-surface-primary");

    rerender(<Card variant="subtle">Subtle</Card>);
    expect(container.firstChild).toHaveClass("bg-surface-secondary");

    rerender(<Card variant="dashed">Dashed</Card>);
    expect(container.firstChild).toHaveClass("border-dashed");

    rerender(<Card variant="ghost">Ghost</Card>);
    expect(container.firstChild).toHaveClass("border-0");
  });

  it("applies padding class names", () => {
    const { container, rerender } = render(<Card padding="none">None</Card>);
    expect(container.firstChild).toHaveClass("p-0");

    rerender(<Card padding="lg">Large</Card>);
    expect(container.firstChild).toHaveClass("p-5");
  });

  it("applies interactive hover styles", () => {
    const { container } = render(<Card interactive>Interactive</Card>);
    expect(container.firstChild).toHaveClass("hover:-translate-y-0.5");
  });
});
