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
});
