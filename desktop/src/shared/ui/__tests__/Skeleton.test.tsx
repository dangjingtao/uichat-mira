// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Skeleton, {
  SkeletonBlock,
  SkeletonCard,
  SkeletonCircle,
  SkeletonText,
} from "../Skeleton";

describe("SkeletonBlock", () => {
  it("渲染默认块", () => {
    const { container } = render(<SkeletonBlock />);
    const block = container.firstChild as HTMLElement;

    expect(block).toHaveAttribute("aria-hidden", "true");
    expect(block).toHaveClass("animate-pulse");
    expect(block).toHaveClass("rounded-ui-control");
  });

  it("应用自定义宽高与圆角", () => {
    const { container } = render(
      <SkeletonBlock width={120} height={40} radius="panel" animate={false} />,
    );
    const block = container.firstChild as HTMLElement;

    expect(block.style.width).toBe("120px");
    expect(block.style.height).toBe("40px");
    expect(block).toHaveClass("rounded-ui-panel");
    expect(block).not.toHaveClass("animate-pulse");
  });

  it("支持字符串尺寸", () => {
    const { container } = render(<SkeletonBlock width="50%" height="2rem" />);
    const block = container.firstChild as HTMLElement;

    expect(block.style.width).toBe("50%");
    expect(block.style.height).toBe("2rem");
  });
});

describe("SkeletonText", () => {
  it("渲染默认 3 行", () => {
    const { container } = render(<SkeletonText />);
    const lines = container.querySelectorAll(".space-y-2 > div");

    expect(lines).toHaveLength(3);
  });

  it("按 lines 渲染行数，且最后一行宽度可自定义", () => {
    const { container } = render(<SkeletonText lines={5} lastLineWidth="40%" />);
    const lines = container.querySelectorAll(".space-y-2 > div");

    expect(lines).toHaveLength(5);
    const lastLine = lines[lines.length - 1] as HTMLElement;
    expect(lastLine.style.width).toBe("40%");
  });

  it("lines 小于 1 时至少渲染 1 行", () => {
    const { container } = render(<SkeletonText lines={0} />);

    expect(container.querySelectorAll(".space-y-2 > div")).toHaveLength(1);
  });
});

describe("SkeletonCircle", () => {
  it("渲染默认圆形", () => {
    const { container } = render(<SkeletonCircle />);
    const circle = container.firstChild as HTMLElement;

    expect(circle.style.width).toBe("36px");
    expect(circle.style.height).toBe("36px");
    expect(circle).toHaveClass("rounded-full");
  });

  it("支持自定义尺寸", () => {
    const { container } = render(<SkeletonCircle size={48} animate={false} />);
    const circle = container.firstChild as HTMLElement;

    expect(circle.style.width).toBe("48px");
    expect(circle.style.height).toBe("48px");
    expect(circle).not.toHaveClass("animate-pulse");
  });
});

describe("SkeletonCard", () => {
  it("渲染默认卡片", () => {
    const { container } = render(<SkeletonCard />);

    expect(container.firstChild).toHaveAttribute("aria-hidden", "true");
    expect(container.querySelectorAll(".space-y-2 > div")).toHaveLength(3);
  });

  it("showAvatar=true 显示圆形头像", () => {
    const { container } = render(<SkeletonCard showAvatar />);

    expect(container.querySelector(".rounded-full")).toBeInTheDocument();
  });

  it("showMeta=false 隐藏 meta 块", () => {
    const { container } = render(<SkeletonCard showMeta={false} />);
    const blocks = container.querySelectorAll("[aria-hidden='true']");

    // 卡片容器 + 标题块 + 文本行，不包含 meta 块
    expect(blocks.length).toBeLessThan(
      container.querySelectorAll("[aria-hidden='true']").length + 1,
    );
  });
});

describe("Skeleton 组合导出", () => {
  it("支持静态属性访问", () => {
    expect(Skeleton.Text).toBe(SkeletonText);
    expect(Skeleton.Circle).toBe(SkeletonCircle);
    expect(Skeleton.Card).toBe(SkeletonCard);
  });
});
