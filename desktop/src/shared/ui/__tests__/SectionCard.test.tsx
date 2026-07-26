// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SectionCard, { SectionCardRow } from "../SectionCard";

describe("SectionCard", () => {
  it("renders a single bordered section with header metadata and divided rows", () => {
    const { container } = render(
      <SectionCard title="Workspace" icon={<span>icon</span>} meta="Windows x64" divided>
        <SectionCardRow>First row</SectionCardRow>
        <SectionCardRow>Second row</SectionCardRow>
      </SectionCard>,
    );

    const section = container.querySelector("section");
    expect(section).toHaveClass("border", "rounded-ui-panel", "overflow-hidden");
    expect(screen.getByRole("heading", { name: "Workspace" })).toBeInTheDocument();
    expect(screen.getByText("Windows x64")).toBeInTheDocument();
    expect(section?.querySelector("header + div")).toHaveClass("divide-y");
    expect(section?.querySelectorAll("section")).toHaveLength(0);
  });

  it("supports interactive rows without adding another card shell", async () => {
    const onClick = vi.fn();
    render(
      <SectionCard title="Actions">
        <SectionCardRow as="button" type="button" onClick={onClick}>
          Open
        </SectionCardRow>
      </SectionCard>,
    );

    const row = screen.getByRole("button", { name: "Open" });
    expect(row).not.toHaveClass("border", "rounded-ui-panel");
    await userEvent.click(row);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("places an optional action at the right side of the header", () => {
    render(
      <SectionCard title="Repository" action={<button type="button">Check updates</button>}>
        <SectionCardRow>Current branch</SectionCardRow>
      </SectionCard>,
    );

    const action = screen.getByRole("button", { name: "Check updates" });
    expect(action.parentElement).toHaveClass("ml-auto", "shrink-0");
  });
});
