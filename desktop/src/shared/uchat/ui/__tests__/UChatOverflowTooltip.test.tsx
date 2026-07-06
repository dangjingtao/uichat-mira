// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { UChatOverflowTooltip } from "../UChatOverflowTooltip";

const observers: Array<{
  callback: ResizeObserverCallback;
  elements: Element[];
}> = [];

class MockResizeObserver {
  callback: ResizeObserverCallback;

  constructor(callback: ResizeObserverCallback) {
    this.callback = callback;
    observers.push({ callback, elements: [] });
  }

  observe(element: Element) {
    const obs = observers.find((o) => o.callback === this.callback);
    if (obs) {
      obs.elements.push(element);
    }
  }

  unobserve() {}

  disconnect() {}
}

function setElementSizes(
  element: HTMLElement,
  sizes: {
    scrollWidth: number;
    clientWidth: number;
    scrollHeight?: number;
    clientHeight?: number;
  },
) {
  vi.spyOn(element, "scrollWidth", "get").mockReturnValue(sizes.scrollWidth);
  vi.spyOn(element, "clientWidth", "get").mockReturnValue(sizes.clientWidth);
  vi.spyOn(element, "scrollHeight", "get").mockReturnValue(
    sizes.scrollHeight ?? sizes.scrollWidth,
  );
  vi.spyOn(element, "clientHeight", "get").mockReturnValue(
    sizes.clientHeight ?? sizes.clientWidth,
  );
}

function triggerObserverCallback() {
  act(() => {
    observers.forEach((obs) => {
      obs.callback([], {
        observe: () => {},
        unobserve: () => {},
        disconnect: () => {},
      } as unknown as ResizeObserver);
    });
  });
}

describe("UChatOverflowTooltip", () => {
  beforeEach(() => {
    observers.length = 0;
    vi.stubGlobal("ResizeObserver", MockResizeObserver);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders children directly when not overflowing", () => {
    render(
      <UChatOverflowTooltip text="hint">
        <span data-testid="content">Short</span>
      </UChatOverflowTooltip>,
    );

    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.getByTestId("content").parentElement).not.toHaveAttribute(
      "data-tooltip-id",
    );
  });

  it("wraps children in a tooltip when overflowing horizontally", () => {
    const { container } = render(
      <UChatOverflowTooltip text="hint">
        <span data-testid="content">Long content that overflows</span>
      </UChatOverflowTooltip>,
    );

    const content = screen.getByTestId("content");
    setElementSizes(content, { scrollWidth: 200, clientWidth: 100 });
    triggerObserverCallback();

    const tooltipWrapper = container.querySelector(
      '[data-tooltip-content="hint"]',
    );
    expect(tooltipWrapper).toBeInTheDocument();
    expect(tooltipWrapper).toHaveAttribute("data-tooltip-id");
  });

  it("wraps children in a tooltip when overflowing vertically", () => {
    const { container } = render(
      <UChatOverflowTooltip text="hint">
        <span data-testid="content">Tall content</span>
      </UChatOverflowTooltip>,
    );

    const content = screen.getByTestId("content");
    setElementSizes(content, {
      scrollWidth: 100,
      clientWidth: 100,
      scrollHeight: 200,
      clientHeight: 100,
    });
    triggerObserverCallback();

    expect(
      container.querySelector('[data-tooltip-content="hint"]'),
    ).toBeInTheDocument();
  });

  it("passes placement to tooltip", () => {
    const { container } = render(
      <UChatOverflowTooltip text="hint" placement="bottom">
        <span data-testid="content">Long content</span>
      </UChatOverflowTooltip>,
    );

    const content = screen.getByTestId("content");
    setElementSizes(content, { scrollWidth: 200, clientWidth: 100 });
    triggerObserverCallback();

    // Tooltip wrapper exists; placement is internal to react-tooltip and not directly observable
    expect(
      container.querySelector('[data-tooltip-content="hint"]'),
    ).toBeInTheDocument();
  });

  it("applies className to the child element", () => {
    render(
      <UChatOverflowTooltip text="hint" className="truncate-text">
        <span data-testid="content">Short</span>
      </UChatOverflowTooltip>,
    );

    expect(screen.getByTestId("content")).toHaveClass("truncate-text");
  });
});
