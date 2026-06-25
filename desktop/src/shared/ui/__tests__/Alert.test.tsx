// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Alert from "../Alert";

describe("Alert", () => {
  it("renders title and children", () => {
    render(
      <Alert title="Heads up">Something happened.</Alert>,
    );
    expect(screen.getByText("Heads up")).toBeInTheDocument();
    expect(screen.getByText("Something happened.")).toBeInTheDocument();
  });

  it("applies variant class names", () => {
    const { rerender } = render(<Alert variant="info">Info</Alert>);
    expect(screen.getByRole("status")).toHaveClass("border-info-border");

    rerender(<Alert variant="danger">Danger</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("border-danger-border");

    rerender(<Alert variant="warning">Warning</Alert>);
    expect(screen.getByRole("alert")).toHaveClass("border-warning-border");

    rerender(<Alert variant="success">Success</Alert>);
    expect(screen.getByRole("status")).toHaveClass("border-success-border");
  });

  it("renders default icon by variant", () => {
    render(<Alert variant="info">Info</Alert>);
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("renders custom icon", () => {
    render(<Alert icon={<span data-testid="custom-icon" />}>Info</Alert>);
    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("hides icon when icon is null", () => {
    render(<Alert icon={null}>No icon</Alert>);
    expect(document.querySelector("svg")).not.toBeInTheDocument();
  });

  it("does not render body when title and children are absent", () => {
    const { container } = render(<Alert />);
    expect(container.querySelector(".min-w-0")).not.toBeInTheDocument();
  });

  it("renders action", () => {
    render(
      <Alert action={<button type="button">Undo</button>}>Alert</Alert>,
    );
    expect(screen.getByRole("button", { name: "Undo" })).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const handleClose = vi.fn();
    render(<Alert onClose={handleClose}>Closable</Alert>);
    await userEvent.click(
      screen.getByRole("button", { name: "Close alert" }),
    );
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("uses custom close aria-label", () => {
    render(<Alert onClose={() => {}} closeAriaLabel="Dismiss">Alert</Alert>);
    expect(
      screen.getByRole("button", { name: "Dismiss" }),
    ).toBeInTheDocument();
  });
});
