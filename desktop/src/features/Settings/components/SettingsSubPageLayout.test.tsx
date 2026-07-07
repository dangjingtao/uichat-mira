// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SettingsSubPageLayout from "./SettingsSubPageLayout";

vi.mock("./Header", () => ({
  default: ({
    miniTitle,
    title,
    description,
    slot,
  }: {
    miniTitle: string;
    title: string;
    description?: string;
    slot?: React.ReactNode;
  }) => (
    <div data-testid="settings-header">
      <span>{miniTitle}</span>
      <span>{title}</span>
      {description ? <span>{description}</span> : null}
      {slot}
    </div>
  ),
}));

describe("SettingsSubPageLayout", () => {
  it("renders the same header and body shell as the main settings layout", () => {
    const { container } = render(
      <SettingsSubPageLayout
        miniTitle="Micro Apps"
        title="News Hub"
        description="Second-level workspace"
        slot={<button type="button">Action</button>}
      >
        <div>Body content</div>
      </SettingsSubPageLayout>,
    );

    expect(screen.getByTestId("settings-header")).toBeInTheDocument();
    expect(screen.getByText("Micro Apps")).toBeInTheDocument();
    expect(screen.getByText("News Hub")).toBeInTheDocument();
    expect(screen.getByText("Second-level workspace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
    expect(screen.getByText("Body content")).toBeInTheDocument();
    expect(container.firstChild).toHaveClass("mx-auto");
    expect(container.firstChild).toHaveClass("flex");
    expect(container.firstChild).toHaveClass("overflow-hidden");
    expect(container.querySelector(".stable-scrollbar")).toBeInTheDocument();
  });
});
