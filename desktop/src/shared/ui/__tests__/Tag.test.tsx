// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Tag from "../Tag";

describe("Tag", () => {
  it("renders label", () => {
    render(<Tag label="Apple" />);
    expect(screen.getByText("Apple")).toBeInTheDocument();
  });

  it("sets title attribute for truncation hint", () => {
    render(<Tag label="Apple" />);
    expect(screen.getByTitle("Apple")).toBeInTheDocument();
  });

  it("shows remove button when onRemove is provided", () => {
    render(<Tag label="Apple" onRemove={() => {}} />);
    expect(
      screen.getByRole("button", { name: "Remove tag Apple" }),
    ).toBeInTheDocument();
  });

  it("hides remove button when disabled", () => {
    render(<Tag label="Apple" onRemove={() => {}} disabled />);
    expect(
      screen.queryByRole("button", { name: "Remove tag Apple" }),
    ).not.toBeInTheDocument();
  });

  it("calls onRemove when remove button is clicked", async () => {
    const handleRemove = vi.fn();
    render(<Tag label="Apple" onRemove={handleRemove} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Remove tag Apple" }),
    );
    expect(handleRemove).toHaveBeenCalledTimes(1);
  });

  it("applies custom className", () => {
    render(<Tag label="Apple" className="custom-class" />);
    expect(screen.getByTitle("Apple")).toHaveClass("custom-class");
  });
});
