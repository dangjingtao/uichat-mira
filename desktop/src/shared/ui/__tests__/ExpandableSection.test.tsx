// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import ExpandableSection from "../ExpandableSection";

describe("ExpandableSection", () => {
  it("renders collapsed label by default", () => {
    render(
      <ExpandableSection collapsedLabel="Show more" expandedLabel="Show less">
        Hidden content
      </ExpandableSection>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Show more");
  });

  it("renders expanded label when defaultExpanded is true", () => {
    render(
      <ExpandableSection
        defaultExpanded
        collapsedLabel="Show more"
        expandedLabel="Show less"
      >
        Visible content
      </ExpandableSection>,
    );
    expect(screen.getByRole("button")).toHaveTextContent("Show less");
  });

  it("toggles expanded state on click", async () => {
    render(
      <ExpandableSection collapsedLabel="Show more" expandedLabel="Show less">
        Hidden content
      </ExpandableSection>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(button);
    expect(button).toHaveTextContent("Show less");
    expect(button).toHaveAttribute("aria-expanded", "true");

    await userEvent.click(button);
    expect(button).toHaveTextContent("Show more");
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("renders children and associates content with aria-controls", () => {
    render(
      <ExpandableSection>
        <span data-testid="content">Details</span>
      </ExpandableSection>,
    );
    const button = screen.getByRole("button");
    const contentId = button.getAttribute("aria-controls");
    expect(document.getElementById(contentId ?? "")).toContainElement(
      screen.getByTestId("content"),
    );
  });

  it("applies trigger and content class names", () => {
    render(
      <ExpandableSection
        triggerClassName="trigger-class"
        contentClassName="content-class"
        defaultExpanded
      >
        Content
      </ExpandableSection>,
    );
    expect(screen.getByRole("button")).toHaveClass("trigger-class");
    expect(screen.getByText("Content")).toHaveClass("content-class");
  });
});
