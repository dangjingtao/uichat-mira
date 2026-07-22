// @vitest-environment jsdom
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { afterEach, beforeEach, expect, test, vi } from "vitest";
import "@/shared/i18n";
import type { ChatMessage, ChatRunStatus } from "../core";
import { UChatThreadView } from "./UChatThreadView";

const markdownPropsSpy = vi.hoisted(() => vi.fn());
const streamingTextPropsSpy = vi.hoisted(() => vi.fn());
const streamingTextMountSpy = vi.hoisted(() => vi.fn());

vi.mock("@/app/providers/ThemeProvider", () => ({
  useThemePreferences: () => ({
    colorTheme: "warm-neutral",
    themeMode: "light",
    setColorTheme: () => {},
    setThemeMode: () => {},
    themePresets: [],
  }),
}));

vi.mock("@/shared/ui/MarkdownText", () => ({
  default: (props: {
    children?: string;
    animated?: boolean;
    isAnimating?: boolean;
  }) => {
    markdownPropsSpy(props);
    return <div>{props.children}</div>;
  },
}));

vi.mock("@/shared/ui/StreamingTextRenderer", () => ({
  default: (props: {
    text: string;
    isStreaming?: boolean;
    children: (visibleText: string) => ReactNode;
  }) => {
    useEffect(() => {
      streamingTextMountSpy();
    }, []);
    streamingTextPropsSpy(props);
    return props.children(props.text);
  },
}));

const assistantMessage = (
  text: string,
  status: ChatMessage["status"],
): ChatMessage => ({
  id: "assistant-1",
  threadId: "thread-1",
  role: "assistant",
  parts: [{ type: "text", text }],
  createdAt: "2026-07-22T00:00:00.000Z",
  parentId: "user-1",
  status,
});

const threadView = (message: ChatMessage, runStatus: ChatRunStatus) => (
  <UChatThreadView
    activeThreadId="thread-1"
    title="Thread"
    badges={[]}
    messages={[message]}
    composer={{ text: "", attachments: [] }}
    runStatus={runStatus}
    threadStatus="ready"
    capabilities={{ composerActions: [], messagePresentation: {} }}
    hasKnowledgeBase={false}
    placeholder="Type"
    isSendDisabled={false}
    onComposerTextChange={() => {}}
    onComposerAttachmentsChange={() => {}}
    onSend={() => {}}
    onComposerAction={() => {}}
    threadContextTags={[]}
    resolveAttachmentSource={(value) => value}
  />
);

beforeEach(() => {
  markdownPropsSpy.mockClear();
  streamingTextPropsSpy.mockClear();
  streamingTextMountSpy.mockClear();
  vi.stubGlobal("requestAnimationFrame", vi.fn(() => 1));
  vi.stubGlobal("cancelAnimationFrame", vi.fn());
});

afterEach(() => {
  vi.unstubAllGlobals();
});

test("UChatThreadView keeps Streamdown in streaming mode without word animation", () => {
  const { rerender } = render(
    threadView(assistantMessage("streaming", "streaming"), { type: "running" }),
  );

  const streamingProps = markdownPropsSpy.mock.lastCall?.[0];
  expect(streamingProps).toEqual(expect.objectContaining({ isAnimating: true }));
  expect(streamingProps?.animated).toBeUndefined();
  expect(streamingTextPropsSpy).toHaveBeenLastCalledWith(
    expect.objectContaining({ text: "streaming", isStreaming: true }),
  );

  markdownPropsSpy.mockClear();
  rerender(threadView(assistantMessage("complete", "complete"), { type: "idle" }));

  const completeProps = markdownPropsSpy.mock.lastCall?.[0];
  expect(completeProps).toEqual(expect.objectContaining({ isAnimating: false }));
  expect(completeProps?.animated).toBeUndefined();
});

test("UChatThreadView coalesces repeated auto-scroll requests into one animation frame", () => {
  const requestAnimationFrameSpy = vi.mocked(window.requestAnimationFrame);
  const { rerender } = render(
    threadView(assistantMessage("a", "streaming"), { type: "running" }),
  );

  rerender(threadView(assistantMessage("ab", "streaming"), { type: "running" }));
  rerender(threadView(assistantMessage("abc", "streaming"), { type: "running" }));

  expect(requestAnimationFrameSpy).toHaveBeenCalledTimes(1);
});

test("UChatThreadView mounts the text renderer while waiting for the first chunk", () => {
  const waitingMessage: ChatMessage = {
    ...assistantMessage("", "streaming"),
    parts: [],
  };

  const { rerender } = render(
    threadView(waitingMessage, { type: "running" }),
  );

  expect(streamingTextPropsSpy).toHaveBeenLastCalledWith(
    expect.objectContaining({ text: "", isStreaming: true }),
  );
  expect(streamingTextMountSpy).toHaveBeenCalledTimes(1);

  rerender(
    threadView(
      {
        ...assistantMessage("完整答案", "complete"),
        id: "persisted-assistant-1",
      },
      { type: "idle" },
    ),
  );

  expect(streamingTextMountSpy).toHaveBeenCalledTimes(1);
  expect(streamingTextPropsSpy).toHaveBeenLastCalledWith(
    expect.objectContaining({ text: "完整答案", isStreaming: false }),
  );
});
