// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { FullPageStatus } from "../FullPageStatus";

describe("FullPageStatus", () => {
  it("renders message", () => {
    render(<FullPageStatus message="Loading..." />);
    expect(screen.getByText("Loading...")).toBeInTheDocument();
  });

  it("uses main landmark", () => {
    render(<FullPageStatus message="Working" />);
    expect(screen.getByRole("main")).toHaveTextContent("Working");
  });
});
