// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Switch from "../Switch";

describe("Switch", () => {
  it("renders with switch role", () => {
    render(<Switch checked={false} onChange={() => {}} />);
    expect(screen.getByRole("switch")).toBeInTheDocument();
  });

  it("reflects checked state in aria-checked", () => {
    const { rerender } = render(<Switch checked={false} onChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "false");

    rerender(<Switch checked onChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveAttribute("aria-checked", "true");
  });

  it("calls onChange when clicked", async () => {
    const handleChange = vi.fn();
    render(<Switch checked={false} onChange={handleChange} />);
    await userEvent.click(screen.getByRole("switch"));
    expect(handleChange).toHaveBeenCalledTimes(1);
  });

  it("does not call onChange when disabled", async () => {
    const handleChange = vi.fn();
    render(<Switch checked={false} onChange={handleChange} disabled />);
    const switchButton = screen.getByRole("switch");
    expect(switchButton).toBeDisabled();
    await userEvent.click(switchButton);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("applies aria-label", () => {
    render(
      <Switch checked={false} onChange={() => {}} ariaLabel="Airplane mode" />,
    );
    expect(
      screen.getByRole("switch", { name: "Airplane mode" }),
    ).toBeInTheDocument();
  });

  it("applies size classes", () => {
    const { rerender } = render(
      <Switch checked={false} onChange={() => {}} size="sm" />,
    );
    expect(screen.getByRole("switch")).toHaveClass("h-5");

    rerender(<Switch checked={false} onChange={() => {}} size="md" />);
    expect(screen.getByRole("switch")).toHaveClass("h-6");
  });

  it("applies checked background color", () => {
    const { rerender } = render(<Switch checked={false} onChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveClass("bg-surface-tertiary");

    rerender(<Switch checked onChange={() => {}} />);
    expect(screen.getByRole("switch")).toHaveClass("bg-primary");
  });
});
