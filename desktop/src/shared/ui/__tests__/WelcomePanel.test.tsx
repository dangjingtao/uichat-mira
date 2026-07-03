// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import WelcomePanel from "../WelcomePanel";

describe("WelcomePanel", () => {
  it("renders when visible", () => {
    render(
      <WelcomePanel
        visible
        stateKey="welcome"
        hero={<div data-testid="hero" />}
        title="Welcome"
      />,
    );
    expect(screen.getByText("Welcome")).toBeInTheDocument();
    expect(screen.getByTestId("hero")).toBeInTheDocument();
  });

  it("hides content when not visible", () => {
    const { container } = render(
      <WelcomePanel
        visible={false}
        stateKey="welcome"
        hero={<div data-testid="hero" />}
        title="Welcome"
      />,
    );
    expect(container.firstChild).toHaveClass("opacity-0");
    expect(container.firstChild).toHaveClass("pointer-events-none");
  });

  it("renders badge and description", () => {
    render(
      <WelcomePanel
        visible
        stateKey="welcome"
        hero={<div />}
        title="Welcome"
        badge={<span data-testid="badge">New</span>}
        description="Get started"
      />,
    );
    expect(screen.getByTestId("badge")).toBeInTheDocument();
    expect(screen.getByText("Get started")).toBeInTheDocument();
  });

  it("uses stateKey as React key", () => {
    const { rerender } = render(
      <WelcomePanel visible stateKey="a" hero={<div />} title="Welcome" />,
    );
    rerender(
      <WelcomePanel visible stateKey="b" hero={<div />} title="Welcome" />,
    );
    expect(screen.getByText("Welcome")).toBeInTheDocument();
  });
});
