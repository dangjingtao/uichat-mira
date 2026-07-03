// @vitest-environment jsdom
import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Divider from "../Divider";

describe("Divider", () => {
  it("renders a horizontal rule", () => {
    render(<Divider />);
    const hr = document.querySelector("hr");
    expect(hr).toBeInTheDocument();
    expect(hr).toHaveClass("bg-cloudy-3/70");
  });
});
