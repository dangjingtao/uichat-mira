// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SegmentedTabs from "../SegmentedTabs";

const items = [
  { value: "a", label: "Tab A" },
  { value: "b", label: "Tab B" },
  { value: "c", label: "Tab C" },
];

describe("SegmentedTabs", () => {
  it("renders all tab buttons", () => {
    render(<SegmentedTabs value="a" onChange={() => {}} items={items} />);
    expect(screen.getByRole("button", { name: "Tab A" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tab B" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tab C" })).toBeInTheDocument();
  });

  it("highlights active tab", () => {
    render(<SegmentedTabs value="b" onChange={() => {}} items={items} />);
    const activeButton = screen.getByRole("button", { name: "Tab B" });
    expect(activeButton).toHaveClass("bg-surface-primary");
    expect(activeButton).toHaveClass("shadow-shadow-sm");
  });

  it("inactive tabs do not have active styles", () => {
    render(<SegmentedTabs value="b" onChange={() => {}} items={items} />);
    const inactiveButton = screen.getByRole("button", { name: "Tab A" });
    expect(inactiveButton).not.toHaveClass("bg-surface-primary");
    expect(inactiveButton).toHaveClass("text-text-secondary");
  });

  it("calls onChange when a tab is clicked", async () => {
    const handleChange = vi.fn();
    render(<SegmentedTabs value="a" onChange={handleChange} items={items} />);
    await userEvent.click(screen.getByRole("button", { name: "Tab B" }));
    expect(handleChange).toHaveBeenCalledWith("b");
  });

  it("applies custom className", () => {
    const { container } = render(
      <SegmentedTabs
        value="a"
        onChange={() => {}}
        items={items}
        className="custom-class"
      />,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });

  it("supports compact size", () => {
    render(
      <SegmentedTabs value="a" onChange={() => {}} items={items} size="sm" />,
    );
    expect(screen.getByRole("button", { name: "Tab A" })).toHaveClass("text-xs");
    expect(screen.getByRole("button", { name: "Tab A" })).toHaveClass("px-2.5");
  });
});
