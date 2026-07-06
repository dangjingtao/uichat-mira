// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import SearchSelectModalChrome from "../SearchSelectModalChrome";
import type { SearchSelectModalItem } from "../SearchSelectModal";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

const sampleItems: SearchSelectModalItem[] = [
  {
    id: "item-1",
    label: "选项一",
    description: "描述一",
    meta: "v1",
  },
  {
    id: "item-2",
    label: "选项二",
    disabled: true,
  },
  {
    id: "item-3",
    label: "选项三",
  },
];

function renderChrome(
  props: Partial<React.ComponentProps<typeof SearchSelectModalChrome>> = {},
) {
  const defaultProps: React.ComponentProps<typeof SearchSelectModalChrome> = {
    open: true,
    title: "选择",
    searchText: "",
    searchPlaceholder: "搜索…",
    loading: false,
    loadingText: "加载中…",
    errorText: null,
    emptyText: "无结果",
    selectedId: null,
    submittingId: null,
    items: sampleItems,
    onSearchTextChange: vi.fn(),
    onItemClick: vi.fn(),
    onClose: vi.fn(),
  };

  return render(<SearchSelectModalChrome {...defaultProps} {...props} />);
}

describe("SearchSelectModalChrome", () => {
  it("关闭时不在文档中", () => {
    renderChrome({ open: false });

    expect(screen.queryByPlaceholderText("搜索…")).not.toBeInTheDocument();
  });

  it("渲染标题与搜索框", () => {
    renderChrome();

    expect(screen.getByText("选择")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("搜索…")).toBeInTheDocument();
  });

  it("输入时触发 onSearchTextChange", () => {
    const handleChange = vi.fn();
    renderChrome({ onSearchTextChange: handleChange });

    fireEvent.change(screen.getByPlaceholderText("搜索…"), {
      target: { value: "hello" },
    });

    expect(handleChange).toHaveBeenCalledWith("hello");
  });

  it("加载状态显示 loadingText", () => {
    renderChrome({ loading: true, items: [] });

    expect(screen.getByText("加载中…")).toBeInTheDocument();
  });

  it("错误状态显示 errorText", () => {
    renderChrome({ errorText: "请求失败", items: [] });

    expect(screen.getByText("请求失败")).toBeInTheDocument();
  });

  it("空数据状态显示 emptyText", () => {
    renderChrome({ items: [] });

    expect(screen.getByText("无结果")).toBeInTheDocument();
  });

  it("点击选项触发 onItemClick", async () => {
    const handleClick = vi.fn();
    renderChrome({ onItemClick: handleClick });

    await userEvent.click(screen.getByRole("button", { name: /选项一/ }));
    expect(handleClick).toHaveBeenCalledWith(sampleItems[0]);
  });

  it("禁用项不可点击", () => {
    renderChrome();

    expect(screen.getByRole("button", { name: /选项二/ })).toBeDisabled();
  });

  it("提交中禁用所有选项", () => {
    renderChrome({ submittingId: "item-1" });

    expect(screen.getByRole("button", { name: /选项一/ })).toBeDisabled();
    expect(screen.getByRole("button", { name: /选项三/ })).toBeDisabled();
  });

  it("已选项高亮", () => {
    renderChrome({ selectedId: "item-1" });

    const selectedButton = screen.getByRole("button", { name: /选项一/ });
    expect(selectedButton).toHaveClass("border-primary/25");
  });

  it("点击关闭按钮触发 onClose", async () => {
    const handleClose = vi.fn();
    renderChrome({ onClose: handleClose });

    await userEvent.click(screen.getByLabelText("Close search dialog"));
    expect(handleClose).toHaveBeenCalledTimes(1);
  });
});
