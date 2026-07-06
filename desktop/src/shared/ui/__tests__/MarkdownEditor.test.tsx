// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import MarkdownEditor from "../MarkdownEditor";

interface MockCrepeInstance {
  on: ReturnType<typeof vi.fn>;
  setReadonly: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
  _defaultValue: string;
  _markdownUpdatedHandler?: (
    ctx: unknown,
    markdown: string,
    prevMarkdown: string,
  ) => void;
}

const crepeInstances: MockCrepeInstance[] = [];

vi.mock("@milkdown/crepe", () => ({
  Crepe: class MockCrepe {
    on: ReturnType<typeof vi.fn>;
    setReadonly: ReturnType<typeof vi.fn>;
    destroy: ReturnType<typeof vi.fn>;
    _defaultValue: string;
    _markdownUpdatedHandler?: (
      ctx: unknown,
      markdown: string,
      prevMarkdown: string,
    ) => void;

    constructor(options: { root: HTMLElement; defaultValue: string }) {
      this.on = vi.fn(
        (
          callback: (listener: {
            markdownUpdated: (
              handler: (
                ctx: unknown,
                markdown: string,
                prevMarkdown: string,
              ) => void,
            ) => void;
          }) => void,
        ) => {
          callback({
            markdownUpdated: (handler) => {
              this._markdownUpdatedHandler = handler;
            },
          });
        },
      );
      this.setReadonly = vi.fn();
      this.destroy = vi.fn();
      this._defaultValue = options.defaultValue;
      crepeInstances.push(this);
    }
  },
  CrepeFeature: {
    BlockEdit: "BlockEdit",
    Toolbar: "Toolbar",
    TopBar: "TopBar",
    LinkTooltip: "LinkTooltip",
    Placeholder: "Placeholder",
  },
}));

vi.mock("@milkdown/react", () => ({
  Milkdown: () => <div data-testid="milkdown" />,
  MilkdownProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="milkdown-provider">{children}</div>
  ),
  useEditor: (create: (root: HTMLElement) => unknown) => {
    const root = document.createElement("div");
    create(root);
    return null;
  },
}));

describe("MarkdownEditor", () => {
  beforeEach(() => {
    crepeInstances.length = 0;
  });

  it("渲染编辑器容器与 Milkdown", () => {
    render(<MarkdownEditor />);

    expect(screen.getByTestId("milkdown")).toBeInTheDocument();
    expect(screen.getByTestId("milkdown-provider")).toBeInTheDocument();
    expect(document.querySelector(".role-markdown-editor")).toBeInTheDocument();
  });

  it("将初始值透传给 Crepe", () => {
    render(<MarkdownEditor initialValue="# Hello" />);

    expect(crepeInstances).toHaveLength(1);
    expect(crepeInstances[0]._defaultValue).toBe("# Hello");
  });

  it("内容变化时调用 onChange", () => {
    const handleChange = vi.fn();
    render(<MarkdownEditor onChange={handleChange} />);

    crepeInstances[0]._markdownUpdatedHandler?.({}, "new", "old");
    expect(handleChange).toHaveBeenCalledWith("new");
  });

  it("内容无变化时不调用 onChange", () => {
    const handleChange = vi.fn();
    render(<MarkdownEditor onChange={handleChange} />);

    crepeInstances[0]._markdownUpdatedHandler?.({}, "same", "same");
    expect(handleChange).not.toHaveBeenCalled();
  });

  it("默认非只读", () => {
    render(<MarkdownEditor />);

    expect(crepeInstances[0].setReadonly).toHaveBeenCalledWith(false);
  });

  it("disabled=true 时初始化为只读", () => {
    render(<MarkdownEditor disabled />);

    expect(crepeInstances[0].setReadonly).toHaveBeenCalledWith(true);
  });

  it("应用自定义 className", () => {
    render(<MarkdownEditor className="custom-editor" />);

    expect(document.querySelector(".role-markdown-editor")).toHaveClass(
      "custom-editor",
    );
  });
});
