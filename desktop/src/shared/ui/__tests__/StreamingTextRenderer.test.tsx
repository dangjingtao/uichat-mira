// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import StreamingTextRenderer from "../StreamingTextRenderer";

let nextFrameId = 1;
let frameCallbacks: Map<number, FrameRequestCallback>;
let frameTime = 0;

const renderText = (text: string) => (
  <span data-testid="visible-text">{text}</span>
);

const runNextFrame = () => {
  const nextFrame = frameCallbacks.entries().next().value as
    | [number, FrameRequestCallback]
    | undefined;
  if (!nextFrame) {
    throw new Error("Expected a scheduled animation frame");
  }

  const [frameId, callback] = nextFrame;
  frameCallbacks.delete(frameId);
  frameTime += 1000 / 60;
  callback(frameTime);
};

const stubMotionPreference = (matches: boolean) => {
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      matches,
      media: "(prefers-reduced-motion: reduce)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  );
};

describe("StreamingTextRenderer", () => {
  beforeEach(() => {
    nextFrameId = 1;
    frameTime = 0;
    frameCallbacks = new Map();
    stubMotionPreference(false);
    vi.stubGlobal(
      "requestAnimationFrame",
      vi.fn((callback: FrameRequestCallback) => {
        const frameId = nextFrameId;
        nextFrameId += 1;
        frameCallbacks.set(frameId, callback);
        return frameId;
      }),
    );
    vi.stubGlobal(
      "cancelAnimationFrame",
      vi.fn((frameId: number) => {
        frameCallbacks.delete(frameId);
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders static text immediately", () => {
    render(
      <StreamingTextRenderer text="完整文本">
        {renderText}
      </StreamingTextRenderer>,
    );

    expect(screen.getByTestId("visible-text")).toHaveTextContent("完整文本");
    expect(frameCallbacks.size).toBe(0);
  });

  it("shows the first streaming chunk immediately and paces later text", () => {
    const { rerender } = render(
      <StreamingTextRenderer text="你" isStreaming>
        {renderText}
      </StreamingTextRenderer>,
    );

    expect(screen.getByTestId("visible-text")).toHaveTextContent("你");

    const completeText = "你看中文流式输出是否连续";
    rerender(
      <StreamingTextRenderer text={completeText} isStreaming>
        {renderText}
      </StreamingTextRenderer>,
    );

    expect(screen.getByTestId("visible-text")).toHaveTextContent("你");
    expect(frameCallbacks.size).toBe(1);

    act(runNextFrame);

    const visibleText = screen.getByTestId("visible-text").textContent ?? "";
    expect(visibleText.startsWith("你")).toBe(true);
    expect(visibleText.length).toBeGreaterThan(1);
    expect(visibleText).not.toBe(completeText);
  });

  it("paces a large first chunk after an immediate short prefix", () => {
    const completeText = "你看中文首批就是完整答案时仍然连续显示";
    render(
      <StreamingTextRenderer text={completeText} isStreaming>
        {renderText}
      </StreamingTextRenderer>,
    );

    expect(screen.getByTestId("visible-text")).toHaveTextContent("你看中");
    expect(screen.getByTestId("visible-text")).not.toHaveTextContent(
      completeText,
    );
    expect(frameCallbacks.size).toBe(1);
  });

  it("coalesces multiple text updates into one pending frame", () => {
    const { rerender } = render(
      <StreamingTextRenderer text="中" isStreaming>
        {renderText}
      </StreamingTextRenderer>,
    );

    rerender(
      <StreamingTextRenderer text="中文流式" isStreaming>
        {renderText}
      </StreamingTextRenderer>,
    );
    rerender(
      <StreamingTextRenderer text="中文流式输出继续增长" isStreaming>
        {renderText}
      </StreamingTextRenderer>,
    );

    expect(frameCallbacks.size).toBe(1);
  });

  it("never reveals a partial grapheme cluster", () => {
    const { rerender } = render(
      <StreamingTextRenderer text="前" isStreaming>
        {renderText}
      </StreamingTextRenderer>,
    );

    rerender(
      <StreamingTextRenderer text="前👨‍👩‍👧‍👦后面还有文本" isStreaming>
        {renderText}
      </StreamingTextRenderer>,
    );
    act(runNextFrame);

    expect(screen.getByTestId("visible-text")).toHaveTextContent(
      "前👨‍👩‍👧‍👦",
    );
  });

  it("finishes the visible queue after transport streaming stops", () => {
    const completeText = "中文流式输出结束时立即追平";
    const { rerender } = render(
      <StreamingTextRenderer text="中" isStreaming>
        {renderText}
      </StreamingTextRenderer>,
    );

    rerender(
      <StreamingTextRenderer text={completeText} isStreaming>
        {renderText}
      </StreamingTextRenderer>,
    );
    expect(frameCallbacks.size).toBe(1);

    rerender(
      <StreamingTextRenderer text={completeText} isStreaming={false}>
        {renderText}
      </StreamingTextRenderer>,
    );

    expect(screen.getByTestId("visible-text")).not.toHaveTextContent(
      completeText,
    );
    expect(frameCallbacks.size).toBe(1);

    act(() => {
      let safety = 0;
      while (frameCallbacks.size > 0 && safety < 200) {
        runNextFrame();
        safety += 1;
      }
    });

    expect(screen.getByTestId("visible-text")).toHaveTextContent(completeText);
    expect(frameCallbacks.size).toBe(0);
  });

  it("paces a complete answer that arrives together with transport finish", () => {
    const completeText = "完整答案和结束事件在同一批更新中到达";
    const { rerender } = render(
      <StreamingTextRenderer text="" isStreaming>
        {renderText}
      </StreamingTextRenderer>,
    );

    rerender(
      <StreamingTextRenderer text={completeText} isStreaming={false}>
        {renderText}
      </StreamingTextRenderer>,
    );

    expect(screen.getByTestId("visible-text")).toHaveTextContent("完整答");
    expect(screen.getByTestId("visible-text")).not.toHaveTextContent(
      completeText,
    );
    expect(frameCallbacks.size).toBe(1);
  });

  it("does not animate when reduced motion is requested", () => {
    stubMotionPreference(true);
    const { rerender } = render(
      <StreamingTextRenderer text="中" isStreaming>
        {renderText}
      </StreamingTextRenderer>,
    );

    rerender(
      <StreamingTextRenderer text="中文内容直接显示" isStreaming>
        {renderText}
      </StreamingTextRenderer>,
    );

    expect(screen.getByTestId("visible-text")).toHaveTextContent(
      "中文内容直接显示",
    );
    expect(frameCallbacks.size).toBe(0);
  });
});
