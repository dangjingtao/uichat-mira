// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Result from "../Result";

describe("Result", () => {
  it("renders the centered empty state with its content", () => {
    render(
      <Result
        title="暂无内容"
        description="内容会显示在这里。"
        action={<button type="button">添加内容</button>}
      />,
    );

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "暂无内容" })).toBeInTheDocument();
    expect(screen.getByText("内容会显示在这里。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "添加内容" })).toBeInTheDocument();
  });

  it("passes the empty-state size and variant to the visual treatment", () => {
    render(<Result size="lg" variant="success" title="完成" />);

    expect(screen.getByRole("status").querySelector("div")).toHaveClass("h-16", "w-16", "bg-success-soft", "text-success");
  });

  it("renders content directly without the empty state", () => {
    render(
      <Result type="content">
        <div data-testid="content">Actual content</div>
      </Result>,
    );

    expect(screen.getByTestId("content")).toBeInTheDocument();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });
});
