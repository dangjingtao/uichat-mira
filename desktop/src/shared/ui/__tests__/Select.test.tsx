// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Select from "../Select";

const options = [
  { value: "a", label: "Option A" },
  { value: "b", label: "Option B" },
  { value: "c", label: "Option C" },
];

describe("Select", () => {
  it("renders label and trigger", () => {
    render(
      <Select label="Pick" value="a" onChange={() => {}} options={options} />,
    );
    expect(screen.getByLabelText("Pick")).toBeInTheDocument();
  });

  it("renders placeholder when no value", () => {
    render(<Select value="" onChange={() => {}} options={options} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("ui.select.empty");
  });

  it("encodes value for radix", () => {
    const handleChange = vi.fn();
    render(<Select value="a" onChange={handleChange} options={options} />);
    expect(screen.getByRole("combobox")).toHaveTextContent("Option A");
  });

  it("disables trigger when disabled", () => {
    render(<Select value="a" onChange={() => {}} options={options} disabled />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });

  it("shows error message", () => {
    render(
      <Select
        label="Pick"
        value="a"
        onChange={() => {}}
        options={options}
        error="Required"
      />,
    );
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAttribute(
      "aria-invalid",
      "true",
    );
  });

  it("renders label help tooltip", () => {
    render(
      <Select
        label="Pick"
        value="a"
        onChange={() => {}}
        options={options}
        labelHelp="help text"
      />,
    );
    expect(document.querySelector("svg")).toBeInTheDocument();
  });

  it("renders end action and triggers callback without changing value", async () => {
    const user = userEvent.setup();
    const handleChange = vi.fn();
    const handleEndAction = vi.fn();

    render(
      <Select
        value="a"
        onChange={handleChange}
        options={options}
        endAction={{
          ariaLabel: "Delete option",
          icon: <span>X</span>,
          onClick: handleEndAction,
        }}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Delete option" }));

    expect(handleEndAction).toHaveBeenCalledTimes(1);
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("allows the dropdown to grow wider than a narrow trigger", async () => {
    const user = userEvent.setup();
    render(
      <div className="w-24">
        <Select
          value="en-US"
          onChange={() => {}}
          options={[
            { value: "en-US", label: "English" },
            { value: "zh-CN", label: "Simplified Chinese" },
          ]}
          compact
        />
      </div>,
    );

    await user.click(screen.getByRole("combobox"));

    const longLabel = await screen.findByText("Simplified Chinese");
    const viewport = document.querySelector("[data-radix-select-viewport]");
    const content = viewport?.parentElement;
    expect(longLabel).toHaveClass("break-words");
    expect(longLabel).not.toHaveClass("truncate");
    expect(viewport).toHaveClass("min-w-[var(--radix-select-trigger-width)]");
    expect(viewport).not.toHaveClass("w-[var(--radix-select-trigger-width)]");
    expect(content).toHaveClass(
      "max-w-[var(--radix-select-content-available-width)]",
    );
    expect(content).not.toHaveClass("max-w-[var(--radix-select-trigger-width)]");
  });
});
