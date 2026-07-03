// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";
import NavItem from "../NavItem";

describe("NavItem", () => {
  it("renders link with children and icon", () => {
    render(
      <MemoryRouter>
        <NavItem to="/settings" icon={<span data-testid="icon" />}>
          Settings
        </NavItem>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Settings" })).toBeInTheDocument();
    expect(screen.getByTestId("icon")).toBeInTheDocument();
  });

  it("links to provided path", () => {
    render(
      <MemoryRouter>
        <NavItem to="/home" icon={null}>
          Home
        </NavItem>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link")).toHaveAttribute("href", "/home");
  });

  it("applies active class when route matches", () => {
    render(
      <MemoryRouter initialEntries={["/settings"]}>
        <NavItem to="/settings" icon={null}>
          Settings
        </NavItem>
      </MemoryRouter>,
    );
    expect(screen.getByRole("link")).toHaveClass("bg-primary/10");
  });

  it("does not apply active class for non-matching route", () => {
    render(
      <MemoryRouter initialEntries={["/home"]}>
        <NavItem to="/settings" icon={null}>
          Settings
        </NavItem>
      </MemoryRouter>,
    );
    const link = screen.getByRole("link");
    expect(link).not.toHaveClass("bg-primary/10");
    expect(link).toHaveClass("text-text-secondary");
  });
});
