// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SettingsLayoutFrame from "./SettingsLayoutFrame";

describe("SettingsLayoutFrame", () => {
  it("keeps fill mode by default and supports padded document flow", () => {
    const { rerender } = render(
      <SettingsLayoutFrame miniTitle="Settings" title="General">
        <div data-testid="page-content">Content</div>
      </SettingsLayoutFrame>,
    );

    const contentLayer = screen.getByTestId("page-content").parentElement;
    const scrollLayer = contentLayer?.parentElement;
    expect(scrollLayer).toHaveClass("overflow-y-auto");
    expect(scrollLayer).not.toHaveClass("pb-6");
    expect(contentLayer).toHaveClass("h-full", "min-h-0", "pb-6");
    expect(contentLayer).not.toHaveClass("min-h-full");

    rerender(
      <SettingsLayoutFrame
        miniTitle="Settings"
        title="General"
        contentMode="flow"
      >
        <div data-testid="page-content">Content</div>
      </SettingsLayoutFrame>,
    );

    const flowContentLayer = screen.getByTestId("page-content").parentElement;
    expect(flowContentLayer).toHaveClass("min-h-full", "pb-6");
    expect(flowContentLayer).not.toHaveClass("h-full", "min-h-0");
  });
});
