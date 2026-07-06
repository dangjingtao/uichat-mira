// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import MicroFrontend from "../MicroFrontend";

describe("MicroFrontend", () => {
  it("checkExists=false 时直接渲染 iframe", () => {
    render(<MicroFrontend src="https://example.com/app" checkExists={false} />);

    expect(screen.getByTitle("micro-frontend")).toBeInTheDocument();
    expect(screen.getByTitle("micro-frontend")).toHaveAttribute(
      "src",
      "https://example.com/app",
    );
  });

  it("默认先展示加载中，随后渲染 iframe", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true } as Response),
    );

    render(<MicroFrontend src="https://example.com/app" title="测试面板" />);

    expect(screen.getByText("加载中…")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTitle("测试面板")).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it("HEAD 返回非 ok 时展示 emptyText", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false } as Response),
    );

    render(
      <MicroFrontend
        src="https://example.com/missing"
        emptyText="暂无内容"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("暂无内容")).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it("fetch 失败时展示 errorText 与错误信息", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockRejectedValue(new Error("Network error")),
    );

    render(
      <MicroFrontend
        src="https://example.com/app"
        errorText="加载异常"
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("加载异常")).toBeInTheDocument();
      expect(screen.getByText("Network error")).toBeInTheDocument();
    });

    vi.unstubAllGlobals();
  });

  it("点击外部打开按钮调用 window.open", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true } as Response),
    );
    const openSpy = vi.spyOn(window, "open").mockImplementation(() => null);

    render(
      <MicroFrontend
        src="https://example.com/app"
        title="测试面板"
        headerAside={<span>辅助内容</span>}
      />,
    );

    await waitFor(() => {
      expect(screen.getByLabelText("在新窗口打开")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByLabelText("在新窗口打开"));
    expect(openSpy).toHaveBeenCalledWith(
      "https://example.com/app",
      "_blank",
      "noopener,noreferrer",
    );

    openSpy.mockRestore();
    vi.unstubAllGlobals();
  });

  it("标题为空且无 headerAside 时不渲染 header", () => {
    const { container } = render(
      <MicroFrontend src="https://example.com/app" checkExists={false} />,
    );

    expect(container.querySelector("h2")).not.toBeInTheDocument();
  });
});
