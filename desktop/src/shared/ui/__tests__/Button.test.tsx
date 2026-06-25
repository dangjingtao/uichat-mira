// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button, IconButton } from "../Button";

describe("Button", () => {
  it("renders children", () => {
    render(<Button>Click me</Button>);
    expect(
      screen.getByRole("button", { name: "Click me" }),
    ).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const handleClick = vi.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    await userEvent.click(screen.getByRole("button"));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick when disabled", async () => {
    const handleClick = vi.fn();
    render(
      <Button disabled onClick={handleClick}>
        Click me
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toBeDisabled();
    await userEvent.click(button);
    expect(handleClick).not.toHaveBeenCalled();
  });

  it("applies variant class names", () => {
    const { rerender } = render(<Button variant="primary">Primary</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-primary");

    rerender(<Button variant="danger">Danger</Button>);
    expect(screen.getByRole("button")).toHaveClass("bg-danger");

    rerender(<Button variant="link">Link</Button>);
    expect(screen.getByRole("button")).toHaveClass("hover:underline");
  });

  it("normalizes legacy size names", () => {
    const { rerender } = render(<Button size="small">Small</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-8");

    rerender(<Button size="medium">Medium</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-10");

    rerender(<Button size="large">Large</Button>);
    expect(screen.getByRole("button")).toHaveClass("h-11");
  });

  it("has type button by default", () => {
    render(<Button>Submit</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "button");
  });
});

describe("IconButton", () => {
  it("renders with aria-label", () => {
    render(<IconButton ariaLabel="Close">×</IconButton>);
    expect(screen.getByRole("button", { name: "Close" })).toBeInTheDocument();
  });

  it("applies tone and style class names", () => {
    const { rerender } = render(
      <IconButton tone="danger" styleType="outline" ariaLabel="Delete">
        ×
      </IconButton>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveClass("border-danger-border");
    expect(button).toHaveClass("text-danger-text");

    rerender(
      <IconButton tone="primary" styleType="filled" ariaLabel="Add">
        +
      </IconButton>,
    );
    expect(screen.getByRole("button")).toHaveClass("bg-primary/10");
  });

  it("respects disabled state", () => {
    render(
      <IconButton disabled ariaLabel="Disabled">
        ×
      </IconButton>,
    );
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
