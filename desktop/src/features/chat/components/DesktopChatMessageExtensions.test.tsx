// @vitest-environment jsdom
import assert from "node:assert/strict";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, test, vi } from "vitest";
import "@/shared/i18n";
import { getChatMediaPreviewUrl } from "@/shared/api/thread";
import type { ChatMessage } from "@/shared/uchat/core";
import {
  DesktopChatMessageExtensions,
  DesktopChatMessageExtensionsProvider,
} from "./DesktopChatMessageExtensions";

vi.mock("@/shared/api/thread", () => ({
  getChatMediaPreviewUrl: vi.fn(),
}));

const baseAssistantMessage = (
  overrides: Partial<ChatMessage> = {},
): ChatMessage => ({
  id: overrides.id ?? "assistant-1",
  threadId: overrides.threadId ?? "thread-1",
  role: "assistant",
  parts: overrides.parts ?? [{ type: "text", text: "answer" }],
  createdAt: overrides.createdAt ?? "2025-01-01T00:00:00.000Z",
  parentId: overrides.parentId ?? "user-1",
  status: overrides.status ?? "complete",
  metadata: overrides.metadata,
});

const renderMediaExtensions = ({
  message = baseAssistantMessage(),
  onPreviewImage = vi.fn(),
  onRequestTts = vi.fn(() => Promise.resolve()),
  onRequestImage,
  showImageAction = false,
}: {
  message?: ChatMessage;
  onPreviewImage?: (src: string) => void;
  onRequestTts?: (message: ChatMessage) => void | Promise<void>;
  onRequestImage?: (message: ChatMessage) => void | Promise<void>;
  showImageAction?: boolean;
} = {}) =>
  render(
    <DesktopChatMessageExtensionsProvider
      onRequestTts={onRequestTts}
      onRequestImage={onRequestImage}
      showImageAction={showImageAction}
    >
      <DesktopChatMessageExtensions
        message={message}
        placement="content"
        onPreviewImage={onPreviewImage}
        onRequestLayout={() => {}}
      />
      <DesktopChatMessageExtensions
        message={message}
        placement="actions"
        onPreviewImage={onPreviewImage}
        onRequestLayout={() => {}}
      />
    </DesktopChatMessageExtensionsProvider>,
  );

beforeEach(() => {
  vi.mocked(getChatMediaPreviewUrl).mockReset();
  vi.mocked(getChatMediaPreviewUrl).mockImplementation(
    async (_threadId, mediaId) => `blob:http://localhost/${mediaId}`,
  );
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function () {
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
});

afterEach(() => {
  vi.restoreAllMocks();
});

test("DesktopChatMessageExtensions renders and previews a generated image", async () => {
  const onPreviewImage = vi.fn();
  const onRequestImage = vi.fn(() => Promise.resolve());
  renderMediaExtensions({
    message: baseAssistantMessage({
      metadata: {
        media: { image: { status: "succeeded", mediaId: "image-1" } },
      },
    }),
    onPreviewImage,
    onRequestImage,
    showImageAction: true,
  });

  const image = await screen.findByRole("img", {
    name: /generated image|生成的图片/i,
  });
  fireEvent.click(image.closest("button") as HTMLButtonElement);
  assert.deepEqual(onPreviewImage.mock.calls, [
    ["blob:http://localhost/image-1"],
  ]);

  fireEvent.click(
    screen.getByRole("button", { name: /generate image|生成图片/i }),
  );
  await waitFor(() => assert.equal(onRequestImage.mock.calls.length, 1));
});

test("DesktopChatMessageExtensions keeps image retry and action pending state synchronized", async () => {
  let resolveRequest: (() => void) | undefined;
  const onRequestImage = vi.fn(
    () =>
      new Promise<void>((resolve) => {
        resolveRequest = resolve;
      }),
  );
  renderMediaExtensions({
    message: baseAssistantMessage({
      metadata: {
        media: {
          image: { status: "failed", errorMessage: "generation failed" },
        },
      },
    }),
    onRequestImage,
    showImageAction: true,
  });

  fireEvent.click(screen.getByRole("button", { name: /retry|重试/i }));
  const generateButton = screen.getByRole("button", {
    name: /generate image|生成图片/i,
  });
  await waitFor(() => assert.equal(generateButton.hasAttribute("disabled"), true));

  await act(async () => resolveRequest?.());
  await waitFor(() => assert.equal(generateButton.hasAttribute("disabled"), false));
});

test("DesktopChatMessageExtensions requests TTS when no completed audio exists", async () => {
  const onRequestTts = vi.fn(() => Promise.resolve());
  renderMediaExtensions({ onRequestTts });

  fireEvent.click(
    screen.getByRole("button", {
      name: /play assistant audio|播放助手音频/i,
    }),
  );
  await waitFor(() => assert.equal(onRequestTts.mock.calls.length, 1));
});

test("DesktopChatMessageExtensions regenerates TTS when its media file is unavailable", async () => {
  const onRequestTts = vi.fn(() => Promise.resolve());
  vi.mocked(getChatMediaPreviewUrl).mockRejectedValue(
    new Error("media not found"),
  );
  renderMediaExtensions({
    message: baseAssistantMessage({
      metadata: {
        media: { tts: { status: "succeeded", mediaId: "audio-1" } },
      },
    }),
    onRequestTts,
  });

  fireEvent.click(
    screen.getByRole("button", {
      name: /play assistant audio|播放助手音频/i,
    }),
  );
  await waitFor(() => assert.equal(onRequestTts.mock.calls.length, 1));
});

test("DesktopChatMessageExtensions animates only while audio is playing", async () => {
  renderMediaExtensions({
    message: baseAssistantMessage({
      metadata: {
        media: { tts: { status: "succeeded", mediaId: "audio-1" } },
      },
    }),
  });

  const playButton = screen.getByRole("button", {
    name: /play assistant audio|播放助手音频/i,
  });
  await waitFor(() =>
    assert.equal(
      vi.mocked(getChatMediaPreviewUrl).mock.calls.some(
        ([, mediaId]) => mediaId === "audio-1",
      ),
      true,
    ),
  );
  fireEvent.click(playButton);
  await waitFor(() =>
    assert.ok(screen.getByTestId("chat-media-audio-playing")),
  );

  const audio = document.querySelector("audio");
  assert.ok(audio);
  fireEvent.ended(audio);
  assert.equal(screen.queryByTestId("chat-media-audio-playing"), null);
});

test("DesktopChatMessageExtensions hides image controls when image generation is unavailable", () => {
  renderMediaExtensions({
    message: baseAssistantMessage({
      metadata: { media: { image: { status: "failed" } } },
    }),
    onRequestImage: vi.fn(),
    showImageAction: false,
  });

  assert.equal(
    screen.queryByRole("button", {
      name: /generate image|生成图片|retry|重试/i,
    }),
    null,
  );
});
