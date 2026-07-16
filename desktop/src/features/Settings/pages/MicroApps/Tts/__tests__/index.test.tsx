// @vitest-environment jsdom
import type { ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TtsStudioPage from "../index";

const apiMocks = vi.hoisted(() => ({
  getApiProviderCatalog: vi.fn(),
  createGptSovitsSynthesis: vi.fn(),
  createTtsSynthesis: vi.fn(),
  getGptSovitsCatalog: vi.fn(),
  getTtsAudioPreviewUrl: vi.fn(),
  getTtsOverview: vi.fn(),
  getTtsVoices: vi.fn(),
  updateTtsProvider: vi.fn(),
}));

const storeMocks = vi.hoisted(() => ({
  deleteStoredGptSovitsRefAudio: vi.fn(),
  listStoredGptSovitsRefAudios: vi.fn(),
  saveStoredGptSovitsRefAudio: vi.fn(),
  toStoredGptSovitsRefAudioFile: vi.fn(),
}));

const messageMocks = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
}));

vi.mock("@/shared/api/tts", () => ({
  getApiProviderCatalog: apiMocks.getApiProviderCatalog,
  createGptSovitsSynthesis: apiMocks.createGptSovitsSynthesis,
  createTtsSynthesis: apiMocks.createTtsSynthesis,
  getGptSovitsCatalog: apiMocks.getGptSovitsCatalog,
  getTtsAudioPreviewUrl: apiMocks.getTtsAudioPreviewUrl,
  getTtsOverview: apiMocks.getTtsOverview,
  getTtsVoices: apiMocks.getTtsVoices,
  updateTtsProvider: apiMocks.updateTtsProvider,
}));

vi.mock("../gptSovitsRefAudioStore", () => ({
  deleteStoredGptSovitsRefAudio: storeMocks.deleteStoredGptSovitsRefAudio,
  listStoredGptSovitsRefAudios: storeMocks.listStoredGptSovitsRefAudios,
  saveStoredGptSovitsRefAudio: storeMocks.saveStoredGptSovitsRefAudio,
  toStoredGptSovitsRefAudioFile: storeMocks.toStoredGptSovitsRefAudioFile,
}));

vi.mock("@/shared/ui/Message", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/ui/Message")>();

  return {
    ...actual,
    message: messageMocks,
  };
});

vi.mock("@/shared/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/ui")>();

  return {
    ...actual,
    Button: ({
      children,
      onClick,
      disabled,
    }: {
      children: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
    }) => (
      <button type="button" onClick={onClick} disabled={disabled}>
        {children}
      </button>
    ),
    CompactAudioPlayer: ({
      title,
      subtitle,
      statusMessage,
      disabled,
      src,
    }: {
      title?: string;
      subtitle?: string;
      statusMessage?: string;
      disabled?: boolean;
      src: string;
    }) => (
      <section data-testid="compact-audio-player" data-src={src}>
        <div>{title}</div>
        <div>{subtitle}</div>
        {statusMessage ? <div>{statusMessage}</div> : null}
        <button type="button" aria-label="播放" disabled={disabled}>
          播放
        </button>
      </section>
    ),
    IconButton: ({
      children,
      onClick,
      disabled,
      ariaLabel,
    }: {
      children: ReactNode;
      onClick?: () => void;
      disabled?: boolean;
      ariaLabel?: string;
    }) => (
      <button type="button" onClick={onClick} disabled={disabled} aria-label={ariaLabel}>
        {children}
      </button>
    ),
    Select: ({
      label,
      value,
      onChange,
      options = [],
      disabled,
    }: {
      label?: string;
      value?: string;
      onChange?: (value: string) => void;
      options?: Array<{ value: string; label: string }>;
      disabled?: boolean;
    }) => (
      <label>
        <span>{label}</span>
        <select
          aria-label={label}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          disabled={disabled}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    ),
    Slider: ({
      label,
      value,
      onChange,
      disabled,
      min = 0,
      max = 100,
      step = 1,
    }: {
      label?: string;
      value?: number;
      onChange?: (value: number) => void;
      disabled?: boolean;
      min?: number;
      max?: number;
      step?: number;
    }) => (
      <label>
        <span>{label}</span>
        <input
          aria-label={label}
          type="range"
          min={min}
          max={max}
          step={step}
          value={value ?? 0}
          onChange={(event) => onChange?.(Number(event.target.value))}
          disabled={disabled}
        />
      </label>
    ),
    TextArea: ({
      label,
      value,
      onChange,
      disabled,
    }: {
      label?: string;
      value: string;
      onChange: (value: string) => void;
      disabled?: boolean;
    }) => (
      <label>
        <span>{label}</span>
        <textarea
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      </label>
    ),
    TextInput: ({
      label,
      labelHelp,
      value,
      onChange,
      disabled,
      placeholder,
    }: {
      label?: string;
      labelHelp?: string;
      value: string;
      onChange: (value: string) => void;
      disabled?: boolean;
      placeholder?: string;
    }) => (
      <label>
        <span>{label}</span>
        {labelHelp ? <span data-testid={`label-help-${label}`}>{labelHelp}</span> : null}
        <input
          aria-label={label}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          placeholder={placeholder}
        />
      </label>
    ),
    Tooltip: ({
      children,
      text,
    }: {
      children: ReactNode;
      text: string;
    }) => (
      <span data-testid="tooltip" data-text={text}>
        {children}
      </span>
    ),
  };
});

vi.mock("@/shared/ui/NavigationCardTabs", () => ({
  default: ({
    tabs,
    value,
    onChange,
  }: {
    tabs: Array<{ value: string; label: string }>;
    value: string;
    onChange: (value: "piper" | "gpt_sovits" | "api_provider") => void;
  }) => (
    <div>
      {tabs.map((tab) => (
        <button
          key={tab.value}
          type="button"
          aria-pressed={value === tab.value}
          onClick={() => onChange(tab.value as "piper" | "gpt_sovits" | "api_provider")}
        >
          {tab.label}
        </button>
      ))}
    </div>
  ),
}));

vi.mock("../../components/MicroAppPageLayout", () => ({
  default: ({
    title,
    description,
    slot,
    children,
  }: {
    title: string;
    description: string;
    slot?: ReactNode;
    children: ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{description}</p>
      <div>{slot}</div>
      <div>{children}</div>
    </div>
  ),
}));

const providers = [
  {
    id: "provider-windows",
    providerId: "windows_builtin",
    displayName: "内置语音",
    enabled: true,
    config: { rate: 1, volume: 1, voice: "" },
    createdAt: "2026-07-10T09:00:00.000Z",
    updatedAt: "2026-07-10T09:00:00.000Z",
  },
  {
    id: "provider-piper",
    providerId: "piper_local",
    displayName: "Piper 语音包",
    enabled: true,
    config: { voice: "", modelPath: "D:\\voices\\demo.onnx" },
    createdAt: "2026-07-10T09:00:00.000Z",
    updatedAt: "2026-07-10T09:00:00.000Z",
  },
  {
    id: "provider-gpt",
    providerId: "gpt_sovits",
    displayName: "GPT-SoVITS",
    enabled: true,
    config: {},
    createdAt: "2026-07-10T09:00:00.000Z",
    updatedAt: "2026-07-10T09:00:00.000Z",
  },
  {
    id: "provider-api",
    providerId: "api_provider",
    displayName: "API服务商",
    enabled: true,
    config: { voice: "alloy", responseFormat: "mp3", speed: 1 },
    createdAt: "2026-07-10T09:00:00.000Z",
    updatedAt: "2026-07-10T09:00:00.000Z",
  },
];

const gptCatalog = {
  serviceUrl: "http://127.0.0.1:9872",
  gptModelOptions: ["gpt-demo.ckpt"],
  sovitsModelOptions: ["sovits-demo.pth"],
  languageOptions: ["zh"],
  cutMethodOptions: ["none"],
  sampleStepOptions: [8],
  defaults: {
    serviceUrl: "http://127.0.0.1:9872",
    promptText: "",
    gptModel: "gpt-demo.ckpt",
    sovitsModel: "sovits-demo.pth",
    promptLanguage: "zh",
    textLanguage: "zh",
    cutMethod: "none",
    sampleSteps: 8,
    speed: 1,
    pauseSecond: 0.3,
    temperature: 1,
    topK: 15,
    topP: 1,
  },
};

describe("TtsStudioPage", () => {
  beforeEach(() => {
    apiMocks.createGptSovitsSynthesis.mockReset();
    apiMocks.createTtsSynthesis.mockReset();
    apiMocks.getApiProviderCatalog.mockReset();
    apiMocks.getGptSovitsCatalog.mockReset();
    apiMocks.getTtsAudioPreviewUrl.mockReset();
    apiMocks.getTtsOverview.mockReset();
    apiMocks.getTtsVoices.mockReset();
    apiMocks.updateTtsProvider.mockReset();
    storeMocks.deleteStoredGptSovitsRefAudio.mockReset();
    storeMocks.listStoredGptSovitsRefAudios.mockReset();
    storeMocks.saveStoredGptSovitsRefAudio.mockReset();
    storeMocks.toStoredGptSovitsRefAudioFile.mockReset();
    messageMocks.success.mockReset();
    messageMocks.error.mockReset();

    apiMocks.getTtsVoices.mockResolvedValue({ voices: [] });
    apiMocks.getGptSovitsCatalog.mockResolvedValue({ catalog: gptCatalog });
    apiMocks.getApiProviderCatalog.mockResolvedValue({
      catalog: {
        configured: true,
        supported: true,
        providerConnectionId: "openai",
        providerDisplayName: "OpenAI",
        providerCode: "openai",
        providerTemplateCode: "openai",
        baseUrl: "https://api.openai.com/v1",
        modelId: "gpt-4o-mini-tts",
        modelName: "gpt-4o-mini-tts",
        errorMessage: null,
      },
    });
    storeMocks.listStoredGptSovitsRefAudios.mockResolvedValue([]);
    URL.revokeObjectURL = vi.fn();
  });

  it("keeps the player visible for failed Piper jobs", async () => {
    apiMocks.getTtsOverview.mockResolvedValue({
      providers,
      recentJobs: [
        {
          id: "job-piper-failed",
          providerId: "piper_local",
          status: "failed",
          text: "Piper 失败任务",
          voice: null,
          requestConfig: {},
          outputPath: null,
          mimeType: null,
          errorMessage: "Piper 模型加载失败",
          createdAt: "2026-07-10T09:00:00.000Z",
          updatedAt: "2026-07-10T09:00:01.000Z",
          completedAt: "2026-07-10T09:00:01.000Z",
        },
      ],
    });

    render(<TtsStudioPage />);

    await waitFor(() => {
      expect(apiMocks.getTtsOverview).toHaveBeenCalledTimes(1);
    });

    const player = screen.getByTestId("compact-audio-player");
    expect(player).toBeInTheDocument();
    expect(within(player).getByText("Piper 语音包")).toBeInTheDocument();
    expect(within(player).queryByText("Piper 失败任务")).not.toBeInTheDocument();
    expect(
      within(player).queryByText("当前任务失败，没有可播放音频。"),
    ).not.toBeInTheDocument();
    expect(screen.getByTestId("tooltip")).toHaveAttribute("data-text", "Piper 模型加载失败");
    expect(screen.getByRole("button", { name: "播放" })).toBeDisabled();
    expect(apiMocks.getTtsAudioPreviewUrl).not.toHaveBeenCalled();
  });

  it("shows GPT-SoVITS unavailable state without repeated error toasts", async () => {
    apiMocks.getTtsOverview.mockResolvedValue({
      providers,
      recentJobs: [],
    });
    apiMocks.getGptSovitsCatalog.mockRejectedValue(new Error("GPT-SoVITS unavailable"));

    render(<TtsStudioPage />);

    fireEvent.click(await screen.findByRole("button", { name: "GPT-SoVITS" }));

    expect(await screen.findByText("GPT-SoVITS 未连接")).toBeInTheDocument();
    expect(messageMocks.error).not.toHaveBeenCalledWith("GPT-SoVITS unavailable");
  });

  it("keeps the player visible for failed GPT-SoVITS jobs after switching tabs", async () => {
    apiMocks.getTtsOverview.mockResolvedValue({
      providers,
      recentJobs: [
        {
          id: "job-gpt-failed",
          providerId: "gpt_sovits",
          status: "failed",
          text: "GPT 失败任务",
          voice: null,
          requestConfig: {},
          outputPath: null,
          mimeType: null,
          errorMessage: "gpt-sovits 服务当前不可用",
          createdAt: "2026-07-10T09:10:00.000Z",
          updatedAt: "2026-07-10T09:10:01.000Z",
          completedAt: "2026-07-10T09:10:01.000Z",
        },
      ],
    });

    render(<TtsStudioPage />);

    await waitFor(() => {
      expect(apiMocks.getTtsOverview).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "GPT-SoVITS" }));

    await waitFor(() => {
      expect(apiMocks.getGptSovitsCatalog).toHaveBeenCalledTimes(1);
    });

    const player = screen.getByTestId("compact-audio-player");
    const resultHeader = screen.getByText("结果预览").parentElement as HTMLElement;
    expect(player).toBeInTheDocument();
    expect(within(player).getByText("GPT-SoVITS")).toBeInTheDocument();
    expect(within(player).queryByText("GPT 失败任务")).not.toBeInTheDocument();
    expect(
      within(player).queryByText("当前任务失败，没有可播放音频。"),
    ).not.toBeInTheDocument();
    expect(within(resultHeader).getByTestId("tooltip")).toHaveAttribute(
      "data-text",
      "gpt-sovits 服务当前不可用",
    );
    expect(screen.getByRole("button", { name: "播放" })).toBeDisabled();
    expect(apiMocks.getTtsAudioPreviewUrl).not.toHaveBeenCalled();
  });

  it("loads and enables audio playback for successful jobs", async () => {
    apiMocks.getTtsOverview.mockResolvedValue({
      providers,
      recentJobs: [
        {
          id: "job-windows-succeeded",
          providerId: "windows_builtin",
          status: "succeeded",
          text: "成功任务",
          voice: null,
          requestConfig: {},
          outputPath: "D:\\audio\\demo.wav",
          mimeType: "audio/wav",
          errorMessage: null,
          createdAt: "2026-07-10T09:20:00.000Z",
          updatedAt: "2026-07-10T09:20:01.000Z",
          completedAt: "2026-07-10T09:20:01.000Z",
        },
      ],
    });
    apiMocks.getTtsAudioPreviewUrl.mockResolvedValue("blob:job-windows-succeeded");

    render(<TtsStudioPage />);

    await waitFor(() => {
      expect(apiMocks.getTtsAudioPreviewUrl).toHaveBeenCalledWith("job-windows-succeeded");
    });

    const player = screen.getByTestId("compact-audio-player");
    expect(player).toHaveAttribute("data-src", "blob:job-windows-succeeded");
    expect(within(player).getByText("内置语音")).toBeInTheDocument();
    expect(within(player).getByText("成功任务")).toBeInTheDocument();
    expect(screen.queryByText("音频预览还在加载，请稍等。")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "播放" })).not.toBeDisabled();
  });

  it("runs API provider synthesis from the third tab", async () => {
    apiMocks.getTtsOverview.mockResolvedValue({
      providers,
      recentJobs: [],
    });
    apiMocks.createTtsSynthesis.mockResolvedValue({
      job: {
        id: "job-api-succeeded",
      },
    });

    render(<TtsStudioPage />);

    await waitFor(() => {
      expect(apiMocks.getTtsOverview).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "API服务商" }));

    await waitFor(() => {
      expect(apiMocks.getApiProviderCatalog).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "开始合成" }));

    await waitFor(() => {
      expect(apiMocks.createTtsSynthesis).toHaveBeenCalledWith(
        expect.objectContaining({
          providerId: "api_provider",
          text: "你好，这里是 UIChat Mira 的 API 服务商 TTS 微应用调试页。",
          voice: "alloy",
          responseFormat: "mp3",
          speed: 1,
        }),
      );
    });
  });

  it("shows exact voice-field guidance for volcengine providers", async () => {
    apiMocks.getTtsOverview.mockResolvedValue({
      providers,
      recentJobs: [],
    });
    apiMocks.getApiProviderCatalog.mockResolvedValue({
      catalog: {
        configured: true,
        supported: true,
        providerConnectionId: "volcengine",
        providerDisplayName: "火山方舟",
        providerCode: "volcengine",
        providerTemplateCode: "volcengine",
        baseUrl: "https://ark.cn-beijing.volces.com/api/plan",
        modelId: "doubao-seed-tts-2.0",
        modelName: "doubao-seed-tts-2.0",
        errorMessage: null,
      },
    });

    render(<TtsStudioPage />);

    await waitFor(() => {
      expect(apiMocks.getTtsOverview).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "API服务商" }));

    await waitFor(() => {
      expect(apiMocks.getApiProviderCatalog).toHaveBeenCalledTimes(1);
    });

    expect(screen.getByText("音色 / Speaker ID")).toBeInTheDocument();
    expect(screen.getByTestId("label-help-音色 / Speaker ID")).toHaveTextContent(
      "这里要填火山方舟语音文档里的 speaker / 音色 ID",
    );
  });
});
