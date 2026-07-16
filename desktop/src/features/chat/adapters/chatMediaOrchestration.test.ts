import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getCapabilities: vi.fn(),
  getReferenceAudioId: vi.fn(),
  createGptSovits: vi.fn(),
  attachMedia: vi.fn(),
  getThread: vi.fn(),
  updateMetadata: vi.fn(),
  createImage: vi.fn(),
  getImage: vi.fn(),
  listFlows: vi.fn(),
  listConnections: vi.fn(),
}));

vi.mock("@/shared/api/microAppCapabilities", () => ({
  getMicroAppCapabilities: mocks.getCapabilities,
}));
vi.mock("@/shared/api/tts", () => ({
  createGptSovitsSynthesis: mocks.createGptSovits,
  createTtsSynthesis: vi.fn(),
  getGptSovitsReferenceAudioId: mocks.getReferenceAudioId,
}));
vi.mock("@/shared/api/thread", () => ({
  attachChatMedia: mocks.attachMedia,
  getThreadById: mocks.getThread,
  updateChatMessageMetadata: mocks.updateMetadata,
}));
vi.mock("@/shared/api/imageGeneration", () => ({
  createImageGeneration: mocks.createImage,
  getImageGeneration: mocks.getImage,
}));
vi.mock("@/shared/api/comfyuiStudio", () => ({
  listComfyUiFlows: mocks.listFlows,
  listComfyUiConnections: mocks.listConnections,
}));

import {
  shouldGenerateChatMedia,
  generateChatMessageImage,
  synthesizeChatMessageTts,
} from "./chatMediaOrchestration";

describe("shouldGenerateChatMedia", () => {
  it("allows TTS in every chat context", () => {
    expect(shouldGenerateChatMedia({
      settings: { ttsEnabled: true, imageEnabled: true },
      roleId: "role-1",
      knowledgeBaseId: "kb-1",
    })).toEqual({ tts: true, image: false });
  });

  it("only allows automatic images for RP without RAG", () => {
    expect(shouldGenerateChatMedia({
      settings: { imageEnabled: true },
      roleId: "role-1",
    }).image).toBe(true);
    expect(shouldGenerateChatMedia({
      settings: { imageEnabled: true },
      roleId: "role-1",
      knowledgeBaseId: "kb-1",
    }).image).toBe(false);
    expect(shouldGenerateChatMedia({
      settings: { imageEnabled: true },
      knowledgeBaseId: "kb-1",
    }).image).toBe(false);
  });
});

describe("synthesizeChatMessageTts", () => {
  const message = {
    id: "message-1",
    threadId: "thread-1",
    role: "assistant",
    parts: [{ type: "text", text: "reply" }],
  } as never;

  beforeEach(() => {
    mocks.getThread.mockResolvedValue({ messages: [message] });
    mocks.updateMetadata.mockResolvedValue(undefined);
    mocks.attachMedia.mockResolvedValue(undefined);
    mocks.updateMetadata.mockResolvedValue(undefined);
    mocks.createImage.mockReset();
    mocks.getImage.mockReset();
    mocks.listFlows.mockReset();
    mocks.listConnections.mockReset();
  });

  it("uses the GPT-SoVITS route and server reference audio id", async () => {
    mocks.getCapabilities.mockResolvedValue([
      { capabilityCode: "tts", providerId: "gpt_sovits", enabled: true },
    ]);
    mocks.getReferenceAudioId.mockResolvedValue({ refAudioId: "server-ref-1" });
    mocks.createGptSovits.mockResolvedValue({
      job: {
        id: "tts-job-1",
        status: "succeeded",
        outputPath: "D:\\audio\\tts-job-1.wav",
        mimeType: "audio/wav",
      },
    });

    await synthesizeChatMessageTts(
      { id: "thread-1", metadata: {} } as never,
      message,
    );

    expect(mocks.getReferenceAudioId).toHaveBeenCalledTimes(1);
    expect(mocks.createGptSovits).toHaveBeenCalledWith({
      text: "reply",
      refAudioId: "server-ref-1",
    });
    expect(mocks.attachMedia).toHaveBeenCalledWith("thread-1", {
      messageId: "message-1",
      taskId: "tts-job-1",
      mediaType: "audio",
      absolutePath: "D:\\audio\\tts-job-1.wav",
      mimeType: "audio/wav",
    });
  });

  it("does not send a GPT request when the server binding cannot be resolved", async () => {
    mocks.createGptSovits.mockClear();
    mocks.attachMedia.mockClear();
    mocks.getCapabilities.mockResolvedValue([
      { capabilityCode: "tts", providerId: "gpt_sovits", enabled: true },
    ]);
    mocks.getReferenceAudioId.mockRejectedValue(
      new Error("GPT-SoVITS 参考音频未完成服务端绑定"),
    );

    await expect(
      synthesizeChatMessageTts(
        { id: "thread-1", metadata: {} } as never,
        message,
      ),
    ).rejects.toThrow("GPT-SoVITS 参考音频未完成服务端绑定");
    expect(mocks.createGptSovits).not.toHaveBeenCalled();
  });
});

describe("generateChatMessageImage", () => {
  const message = {
    id: "message-image-1",
    threadId: "thread-1",
    role: "assistant",
    parts: [{ type: "text", text: "a red chair" }],
  } as never;

  beforeEach(() => {
    mocks.getThread.mockResolvedValue({ messages: [message] });
    mocks.updateMetadata.mockResolvedValue(undefined);
    mocks.attachMedia.mockResolvedValue(undefined);
  });

  it("submits the saved ComfyUI workflow and waits for its terminal artifact", async () => {
    mocks.getCapabilities.mockResolvedValue([
      { capabilityCode: "imageGeneration", providerId: "comfyui_local", enabled: true },
    ]);
    mocks.listFlows.mockResolvedValue([{
      workflowApiJson: JSON.stringify({
        "6": { class_type: "CLIPTextEncode", inputs: { text: "" } },
      }),
      mapping: {
        promptPath: "6.text",
        seedPath: "",
        widthPath: "",
        heightPath: "",
        outputNodeId: "9",
        previewNodeId: "9",
      },
    }]);
    mocks.listConnections.mockResolvedValue([{
      baseUrl: "http://127.0.0.1:8188",
      clientId: "chat-client",
    }]);
    mocks.createImage.mockResolvedValue({
      generationId: "image-job-1",
      status: "queued",
      artifacts: [],
    });
    mocks.getImage.mockResolvedValue({
      generationId: "image-job-1",
      status: "succeeded",
      artifacts: [{
        id: "artifact-1",
        source: "local-file",
        localPath: "D:\\images\\artifact-1.png",
        mimeType: "image/png",
      }],
    });

    vi.useFakeTimers();
    const pending = generateChatMessageImage(
      { id: "thread-1", metadata: {} } as never,
      message,
    );
    await vi.advanceTimersByTimeAsync(1200);
    await pending;
    vi.useRealTimers();

    expect(mocks.createImage).toHaveBeenCalledWith(expect.objectContaining({
      providerId: "comfyui_local",
      workflowApiJson: { "6": { class_type: "CLIPTextEncode", inputs: { text: "a red chair" } } },
      providerParams: { baseUrl: "http://127.0.0.1:8188", clientId: "chat-client" },
    }));
    expect(mocks.getImage).toHaveBeenCalledWith("image-job-1", { refresh: true });
    expect(mocks.attachMedia).toHaveBeenCalledWith("thread-1", expect.objectContaining({
      taskId: "image-job-1",
      absolutePath: "D:\\images\\artifact-1.png",
    }));
  });
});
