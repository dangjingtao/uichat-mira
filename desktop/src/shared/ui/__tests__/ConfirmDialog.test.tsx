// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ConfirmDialog from "../ConfirmDialog";

describe("ConfirmDialog", () => {
  it("renders title and description", () => {
    render(
      <ConfirmDialog
        title="Delete?"
        description="This cannot be undone."
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("Delete?")).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
  });

  it("calls onCancel when cancel button clicked", async () => {
    const handleCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Delete?"
        description="Confirm"
        onCancel={handleCancel}
        onConfirm={() => {}}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "取消" }));
    expect(handleCancel).toHaveBeenCalledTimes(1);
  });

  it("calls onConfirm when confirm button clicked", async () => {
    const handleConfirm = vi.fn();
    render(
      <ConfirmDialog
        title="Delete?"
        description="Confirm"
        onCancel={() => {}}
        onConfirm={handleConfirm}
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "确认" }));
    expect(handleConfirm).toHaveBeenCalledTimes(1);
  });

  it("renders custom button texts", () => {
    render(
      <ConfirmDialog
        title="Delete?"
        description="Confirm"
        confirmText="Yes"
        cancelText="No"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Yes" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "No" })).toBeInTheDocument();
  });

  it("disables buttons when loading", () => {
    render(
      <ConfirmDialog
        title="Delete?"
        description="Confirm"
        loading
        loadingText="Deleting..."
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "Deleting..." })).toBeDisabled();
    expect(screen.getByRole("button", { name: "取消" })).toBeDisabled();
  });

  it("displays error message", () => {
    render(
      <ConfirmDialog
        title="Delete?"
        description="Confirm"
        errorMessage="Something went wrong"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
  });

  it("applies tone styles", () => {
    const { rerender } = render(
      <ConfirmDialog
        title="Info"
        description="Confirm"
        tone="default"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "确认" })).toHaveClass(
      "bg-surface-primary",
    );

    rerender(
      <ConfirmDialog
        title="Warning"
        description="Confirm"
        tone="warning"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "确认" })).toHaveClass(
      "bg-danger",
    );

    rerender(
      <ConfirmDialog
        title="Danger"
        description="Confirm"
        tone="danger"
        onCancel={() => {}}
        onConfirm={() => {}}
      />,
    );
    expect(screen.getByRole("button", { name: "确认" })).toHaveClass(
      "bg-danger",
    );
  });
});
