// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StepIndicator } from "../StepIndicator";

const steps = [
  { step: 1, label: "Upload" },
  { step: 2, label: "Process" },
  { step: 3, label: "Finish" },
];

describe("StepIndicator", () => {
  it("renders all step labels", () => {
    render(<StepIndicator currentStep={1} steps={steps} />);
    expect(screen.getByText("Upload")).toBeInTheDocument();
    expect(screen.getByText("Process")).toBeInTheDocument();
    expect(screen.getByText("Finish")).toBeInTheDocument();
  });

  it("highlights active step", () => {
    render(<StepIndicator currentStep={2} steps={steps} />);
    expect(screen.getByText("STEP 2")).toBeInTheDocument();
  });

  it("shows completed step style", () => {
    render(<StepIndicator currentStep={3} steps={steps} />);
    const completedBadge = screen.getByText("1");
    expect(completedBadge).toHaveClass("bg-primary/10");
  });

  it("shows pending step style", () => {
    render(<StepIndicator currentStep={1} steps={steps} />);
    const pendingBadge = screen.getByText("3");
    expect(pendingBadge).toHaveClass("border");
    expect(pendingBadge).toHaveClass("text-text-tertiary");
  });

  it("renders separators between steps", () => {
    const { container } = render(
      <StepIndicator currentStep={1} steps={steps} />,
    );
    const separators = container.querySelectorAll(".h-px");
    expect(separators.length).toBe(steps.length - 1);
  });

  it("applies custom className", () => {
    const { container } = render(
      <StepIndicator currentStep={1} steps={steps} className="custom-class" />,
    );
    expect(container.firstChild).toHaveClass("custom-class");
  });
});
