// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Drawer from "../Drawer";

describe("Drawer", () => {
  it("renders null when closed", () => {
    const { container } = render(
      <Drawer open={false} onClose={() => {}}>
        Content
      </Drawer>,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders children when open", () => {
    render(
      <Drawer open onClose={() => {}}>
        <span data-testid="content">Drawer body</span>
      </Drawer>,
    );
    expect(screen.getByTestId("content")).toBeInTheDocument();
  });

  it("renders header", () => {
    render(
      <Drawer open onClose={() => {}} header={<span data-testid="header" />}>
        Content
      </Drawer>,
    );
    expect(screen.getByTestId("header")).toBeInTheDocument();
  });

  it("renders footer", () => {
    render(
      <Drawer open onClose={() => {}} footer={<span data-testid="footer" />}>
        Content
      </Drawer>,
    );
    expect(screen.getByTestId("footer")).toBeInTheDocument();
  });

  it("calls onClose when mask clicked", async () => {
    const handleClose = vi.fn();
    render(
      <Drawer open onClose={handleClose}>
        Content
      </Drawer>,
    );
    await userEvent.click(screen.getByLabelText("Close drawer"));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button clicked", async () => {
    const handleClose = vi.fn();
    render(
      <Drawer open onClose={handleClose} closeLabel="Close">
        Content
      </Drawer>,
    );
    const buttons = screen.getAllByRole("button", { name: "Close" });
    await userEvent.click(buttons[buttons.length - 1]);
    expect(handleClose).toHaveBeenCalledTimes(1);
  });

  it("hides close button when showCloseButton is false", () => {
    render(
      <Drawer open onClose={() => {}} showCloseButton={false}>
        Content
      </Drawer>,
    );
    expect(screen.getAllByRole("button").length).toBe(1);
  });

  it("applies custom width", () => {
    render(
      <Drawer open onClose={() => {}} width={400}>
        Content
      </Drawer>,
    );
    expect(screen.getByRole("complementary")).toHaveStyle({ width: "400px" });
  });
});
