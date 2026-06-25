// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { NumberInput, TextArea, TextInput } from "../Input";

describe("TextInput", () => {
  it("renders label and input", () => {
    render(<TextInput label="Name" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Name")).toBeInTheDocument();
  });

  it("calls onChange with new value", () => {
    const handleChange = vi.fn();
    render(<TextInput value="" onChange={handleChange} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "hello" },
    });
    expect(handleChange).toHaveBeenCalledWith("hello");
  });

  it("renders placeholder", () => {
    render(<TextInput value="" onChange={() => {}} placeholder="Enter name" />);
    expect(screen.getByPlaceholderText("Enter name")).toBeInTheDocument();
  });

  it("shows error message and aria-invalid", () => {
    render(<TextInput value="" onChange={() => {}} error="Required" />);
    expect(screen.getByText("Required")).toBeInTheDocument();
    expect(screen.getByRole("textbox")).toHaveAttribute("aria-invalid", "true");
  });

  it("disables input", () => {
    render(<TextInput value="" onChange={() => {}} disabled />);
    expect(screen.getByRole("textbox")).toBeDisabled();
  });

  it("uses provided type", () => {
    render(<TextInput type="password" value="" onChange={() => {}} />);
    expect(
      document.querySelector("input[type='password']"),
    ).toBeInTheDocument();
  });

  it("applies compact size class", () => {
    render(<TextInput value="" onChange={() => {}} compact />);
    expect(screen.getByRole("textbox")).toHaveClass("h-8");
  });
});

describe("NumberInput", () => {
  it("renders label and number input", () => {
    render(<NumberInput label="Age" value={0} onChange={() => {}} />);
    expect(screen.getByLabelText("Age")).toBeInTheDocument();
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("calls onChange with parsed number", () => {
    const handleChange = vi.fn();
    render(<NumberInput label="Age" value={0} onChange={handleChange} />);
    fireEvent.change(screen.getByRole("spinbutton"), {
      target: { value: "25" },
    });
    expect(handleChange).toHaveBeenCalledWith(25);
  });

  it("shows error message", () => {
    render(
      <NumberInput label="Age" value={0} onChange={() => {}} error="Invalid" />,
    );
    expect(screen.getByText("Invalid")).toBeInTheDocument();
  });
});

describe("TextArea", () => {
  it("renders label and textarea", () => {
    render(<TextArea label="Note" value="" onChange={() => {}} />);
    expect(screen.getByLabelText("Note")).toBeInTheDocument();
  });

  it("calls onChange with new value", () => {
    const handleChange = vi.fn();
    render(<TextArea label="Note" value="" onChange={handleChange} />);
    fireEvent.change(screen.getByRole("textbox"), {
      target: { value: "notes" },
    });
    expect(handleChange).toHaveBeenCalledWith("notes");
  });

  it("sets rows attribute", () => {
    render(<TextArea label="Note" value="" onChange={() => {}} rows={8} />);
    expect(screen.getByRole("textbox")).toHaveAttribute("rows", "8");
  });
});
