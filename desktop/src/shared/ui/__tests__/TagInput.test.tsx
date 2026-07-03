// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TagInput from "../TagInput";

describe("TagInput", () => {
  it("renders existing tags", () => {
    render(<TagInput value={["a", "b"]} onChange={() => {}} />);
    expect(screen.getByText("a")).toBeInTheDocument();
    expect(screen.getByText("b")).toBeInTheDocument();
  });

  it("renders label and help text", () => {
    render(
      <TagInput label="Tags" labelHelp="max 3" value={[]} onChange={() => {}} />,
    );
    expect(screen.getByText("Tags")).toBeInTheDocument();
    expect(screen.getByText("(max 3)")).toBeInTheDocument();
  });

  it("adds tag on Enter", async () => {
    const handleChange = vi.fn();
    render(<TagInput value={[]} onChange={handleChange} />);
    await userEvent.type(screen.getByRole("textbox"), "new{Enter}");
    expect(handleChange).toHaveBeenCalledWith(["new"]);
  });

  it("adds tag on blur", async () => {
    const handleChange = vi.fn();
    render(<TagInput value={[]} onChange={handleChange} />);
    await userEvent.type(screen.getByRole("textbox"), "new");
    fireEvent.blur(screen.getByRole("textbox"));
    expect(handleChange).toHaveBeenCalledWith(["new"]);
  });

  it("ignores empty tags", async () => {
    const handleChange = vi.fn();
    render(<TagInput value={[]} onChange={handleChange} />);
    await userEvent.type(screen.getByRole("textbox"), "   {Enter}");
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("ignores duplicate tags", async () => {
    const handleChange = vi.fn();
    render(<TagInput value={["existing"]} onChange={handleChange} />);
    await userEvent.type(screen.getByRole("textbox"), "EXISTING{Enter}");
    expect(handleChange).not.toHaveBeenCalledWith(["existing", "EXISTING"]);
  });

  it("removes tag when remove button clicked", async () => {
    const handleChange = vi.fn();
    render(<TagInput value={["a", "b"]} onChange={handleChange} />);
    await userEvent.click(
      screen.getByRole("button", { name: "Remove tag a" }),
    );
    expect(handleChange).toHaveBeenCalledWith(["b"]);
  });

  it("removes last tag on Backspace when input is empty", async () => {
    const handleChange = vi.fn();
    render(<TagInput value={["a", "b"]} onChange={handleChange} />);
    await userEvent.type(screen.getByRole("textbox"), "{Backspace}");
    expect(handleChange).toHaveBeenCalledWith(["a"]);
  });

  it("enforces maxTags limit", () => {
    render(
      <TagInput label="Tags" value={["a", "b", "c"]} onChange={() => {}} maxTags={3} />,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.getByText("3/3")).toBeInTheDocument();
  });

  it("hides input and remove buttons when disabled", () => {
    render(
      <TagInput value={["a"]} onChange={() => {}} disabled />,
    );
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Remove tag a" }),
    ).not.toBeInTheDocument();
  });
});
