// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DevelopmentDocs from "../pages/Docs/index";

describe("DevelopmentDocs", () => {
  it("renders the developer docs iframe", () => {
    render(<DevelopmentDocs />);

    expect(screen.getByTitle("Developer Docs")).toHaveAttribute("src", "/docs/");
  });
});
