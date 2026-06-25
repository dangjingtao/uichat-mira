// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import TabCard from "../TabCard";

const items = [
  { value: "general", label: "General" },
  { value: "advanced", label: "Advanced" },
];

describe("TabCard", () => {
  it("renders tab buttons", () => {
    render(
      <TabCard items={items} value="general" onChange={() => {}}>
        Body
      </TabCard>,
    );
    expect(screen.getByRole("button", { name: "General" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Advanced" })).toBeInTheDocument();
  });

  it("renders children", () => {
    render(
      <TabCard items={items} value="general" onChange={() => {}}>
        <span data-testid="body">Body content</span>
      </TabCard>,
    );
    expect(screen.getByTestId("body")).toBeInTheDocument();
  });

  it("calls onChange when tab is clicked", async () => {
    const handleChange = vi.fn();
    render(
      <TabCard items={items} value="general" onChange={handleChange}>
        Body
      </TabCard>,
    );
    await userEvent.click(screen.getByRole("button", { name: "Advanced" }));
    expect(handleChange).toHaveBeenCalledWith("advanced");
  });

  it("renders headerAside", () => {
    render(
      <TabCard
        items={items}
        value="general"
        onChange={() => {}}
        headerAside={<span data-testid="aside">Hint</span>}
      >
        Body
      </TabCard>,
    );
    expect(screen.getByTestId("aside")).toBeInTheDocument();
  });

  it("applies body className", () => {
    render(
      <TabCard
        items={items}
        value="general"
        onChange={() => {}}
        bodyClassName="body-class"
      >
        <span data-testid="body">Body</span>
      </TabCard>,
    );
    expect(screen.getByTestId("body").parentElement).toHaveClass("body-class");
  });
});
