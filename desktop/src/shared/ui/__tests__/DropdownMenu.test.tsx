// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import DropdownMenu from "../DropdownMenu";

const items = [
  { id: "copy", label: "Copy" },
  { id: "paste", label: "Paste", disabled: true },
  {
    id: "share",
    label: "Share",
    children: [{ id: "email", label: "Email" }],
  },
];

describe("DropdownMenu", () => {
  it("renders trigger", () => {
    render(
      <DropdownMenu trigger={<button type="button">Open</button>} items={items} onSelect={() => {}} />,
    );
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("opens menu and shows items", async () => {
    render(
      <DropdownMenu trigger={<button type="button">Open</button>} items={items} onSelect={() => {}} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByRole("menuitem", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Paste" })).toBeInTheDocument();
  });

  it("calls onSelect when item clicked", async () => {
    const handleSelect = vi.fn();
    render(
      <DropdownMenu trigger={<button type="button">Open</button>} items={items} onSelect={handleSelect} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Copy" }));
    expect(handleSelect).toHaveBeenCalledWith(expect.objectContaining({ id: "copy" }));
  });

  it("renders item with trailing text and checked state", async () => {
    const checkedItems = [{ id: "dark", label: "Dark mode", trailingText: "Cmd+D", checked: true }];
    render(
      <DropdownMenu trigger={<button type="button">Open</button>} items={checkedItems} onSelect={() => {}} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Open" }));
    expect(screen.getByText("Cmd+D")).toBeInTheDocument();
  });
});
