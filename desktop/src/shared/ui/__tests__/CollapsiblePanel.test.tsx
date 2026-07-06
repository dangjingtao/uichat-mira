// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import CollapsiblePanel from "../CollapsiblePanel";

describe("CollapsiblePanel", () => {
  it("默认收起内容", () => {
    render(
      <CollapsiblePanel title="标题">
        <span data-testid="content">内容</span>
      </CollapsiblePanel>,
    );

    const button = screen.getByRole("button", { name: "标题" });
    expect(button).toHaveAttribute("aria-expanded", "false");

    const content =
      screen.getByTestId("content").parentElement?.parentElement?.parentElement;
    expect(content).toHaveAttribute("aria-hidden", "true");
    expect(content).toHaveClass("grid-rows-[0fr]");
  });

  it("defaultExpanded=true 时默认展开", () => {
    render(
      <CollapsiblePanel title="标题" defaultExpanded>
        <span data-testid="content">内容</span>
      </CollapsiblePanel>,
    );

    expect(screen.getByRole("button")).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("content")).toBeVisible();
  });

  it("点击按钮切换展开/收起", async () => {
    render(
      <CollapsiblePanel title="标题">
        <span data-testid="content">内容</span>
      </CollapsiblePanel>,
    );

    const button = screen.getByRole("button", { name: "标题" });
    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByTestId("content")).toBeVisible();

    await userEvent.click(button);
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("渲染标题与 meta 信息", () => {
    render(
      <CollapsiblePanel title="主标题" meta="辅助说明">
        内容
      </CollapsiblePanel>,
    );

    expect(screen.getByText("主标题")).toBeInTheDocument();
    expect(screen.getByText("辅助说明")).toBeInTheDocument();
  });

  it("自定义 className 应用到外层容器", () => {
    const { container } = render(
      <CollapsiblePanel
        title="标题"
        className="custom-panel"
        headerClassName="custom-header"
        contentClassName="custom-content"
      >
        内容
      </CollapsiblePanel>,
    );

    expect(container.firstChild).toHaveClass("custom-panel");
    expect(screen.getByRole("button")).toHaveClass("custom-header");
  });
});
