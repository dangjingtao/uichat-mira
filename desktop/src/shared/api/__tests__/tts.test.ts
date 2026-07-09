import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/shared/lib/request", () => ({
  client: {
    get: vi.fn(),
  },
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));

vi.mock("@/shared/platform/desktopRuntime", () => ({
  getApiBaseUrl: () => "/api",
}));

import { client, get, post, put } from "@/shared/lib/request";
import {
  createGptSovitsSynthesis,
  createTtsSynthesis,
  getGptSovitsCatalog,
  getTtsAudioPreviewUrl,
  getTtsAudioUrl,
  getTtsOverview,
  getTtsVoices,
  updateTtsProvider,
} from "../tts";

describe("tts api", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("loads overview from the tts route", async () => {
    vi.mocked(get).mockResolvedValueOnce({ providers: [], recentJobs: [] });

    await getTtsOverview();

    expect(get).toHaveBeenCalledWith("/microapps/tts/overview");
  });

  it("updates provider config with encoded provider id", async () => {
    vi.mocked(put).mockResolvedValueOnce({ provider: { id: "1" } });

    await updateTtsProvider("windows_builtin", {
      enabled: true,
      displayName: "内置语音",
      config: {},
    });

    expect(put).toHaveBeenCalledWith(
      "/microapps/tts/providers/windows_builtin",
      {
        enabled: true,
        displayName: "内置语音",
        config: {},
      },
    );
  });

  it("loads voices for the selected provider", async () => {
    vi.mocked(get).mockResolvedValueOnce({ voices: [] });

    await getTtsVoices("piper_local");

    expect(get).toHaveBeenCalledWith(
      "/microapps/tts/voices?providerId=piper_local",
    );
  });

  it("creates synthesis requests without timeout limit", async () => {
    vi.mocked(post).mockResolvedValueOnce({ job: { id: "tts-job-1" } });

    await createTtsSynthesis({
      providerId: "windows_builtin",
      text: "hello",
      voice: "Voice-A",
      rate: 0,
      volume: 100,
    });

    expect(post).toHaveBeenCalledWith(
      "/microapps/tts/syntheses",
      {
        providerId: "windows_builtin",
        text: "hello",
        voice: "Voice-A",
        rate: 0,
        volume: 100,
      },
      {
        timeout: 0,
      },
    );
  });

  it("loads GPT-SoVITS catalog from the dedicated route", async () => {
    vi.mocked(get).mockResolvedValueOnce({
      catalog: {
        serviceUrl: "http://127.0.0.1:9872",
        gptModelOptions: [],
        sovitsModelOptions: [],
        languageOptions: [],
        cutMethodOptions: [],
        sampleStepOptions: [],
        defaults: {
          serviceUrl: "http://127.0.0.1:9872",
          gptModel: "",
          sovitsModel: "",
          promptLanguage: "中文",
          textLanguage: "中文",
          cutMethod: "不切",
          sampleSteps: 8,
          speed: 1,
          pauseSecond: 0.3,
          temperature: 1,
          topK: 15,
          topP: 1,
        },
      },
    });

    await getGptSovitsCatalog();

    expect(get).toHaveBeenCalledWith("/microapps/tts/gpt-sovits/catalog");
  });

  it("creates GPT-SoVITS synthesis requests without timeout limit", async () => {
    vi.mocked(post).mockResolvedValueOnce({ job: { id: "tts-job-2" } });

    await createGptSovitsSynthesis({
      text: "hello",
      refAudioPath: "D:\\voice\\ref.wav",
      promptText: "你好",
      promptLanguage: "中文",
      textLanguage: "中文",
      gptModel: "gpt-model",
      sovitsModel: "sovits-model",
      cutMethod: "按中文句号。切",
      sampleSteps: 32,
      speed: 1,
      pauseSecond: 0.3,
      temperature: 1,
      topK: 15,
      topP: 1,
    });

    expect(post).toHaveBeenCalledWith(
      "/microapps/tts/gpt-sovits/syntheses",
      {
        text: "hello",
        refAudioPath: "D:\\voice\\ref.wav",
        promptText: "你好",
        promptLanguage: "中文",
        textLanguage: "中文",
        gptModel: "gpt-model",
        sovitsModel: "sovits-model",
        cutMethod: "按中文句号。切",
        sampleSteps: 32,
        speed: 1,
        pauseSecond: 0.3,
        temperature: 1,
        topK: 15,
        topP: 1,
      },
      {
        timeout: 0,
      },
    );
  });

  it("creates GPT-SoVITS multipart synthesis when a wav file is provided", async () => {
    vi.mocked(post).mockResolvedValueOnce({ job: { id: "tts-job-3" } });
    const file = new File(["wav"], "ref.wav", { type: "audio/wav" });

    await createGptSovitsSynthesis({
      text: "hello",
      refAudioFile: file,
      promptText: "你好",
      promptLanguage: "中文",
      textLanguage: "中文",
      gptModel: "gpt-model",
      sovitsModel: "sovits-model",
      cutMethod: "按中文句号。切",
      sampleSteps: 32,
      speed: 1,
      pauseSecond: 0.3,
      temperature: 1,
      topK: 15,
      topP: 1,
    });

    expect(post).toHaveBeenCalledWith(
      "/microapps/tts/gpt-sovits/syntheses",
      expect.any(FormData),
      {
        headers: {
          "Content-Type": "multipart/form-data",
        },
        timeout: 0,
      },
    );
  });

  it("builds the audio route from the backend api base", () => {
    expect(getTtsAudioUrl("job/with spaces")).toBe(
      "/api/microapps/tts/syntheses/job%2Fwith%20spaces/audio",
    );
  });

  it("loads authenticated audio preview as blob url", async () => {
    const createObjectUrl = vi
      .spyOn(URL, "createObjectURL")
      .mockReturnValue("blob:tts-job-1");
    const blob = new Blob(["wav"], { type: "audio/wav" });
    vi.mocked(client.get).mockResolvedValueOnce({ data: blob } as never);

    const previewUrl = await getTtsAudioPreviewUrl("tts-job-1");

    expect(client.get).toHaveBeenCalledWith(
      "/api/microapps/tts/syntheses/tts-job-1/audio",
      {
        responseType: "blob",
      },
    );
    expect(createObjectUrl).toHaveBeenCalledWith(blob);
    expect(previewUrl).toBe("blob:tts-job-1");

    createObjectUrl.mockRestore();
  });
});
