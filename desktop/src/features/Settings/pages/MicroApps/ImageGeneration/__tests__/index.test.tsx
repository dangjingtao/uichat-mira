// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import ImageGenerationStudioPage from "../index";
import type {
  PromptFormValue,
  StudioFormStatus,
  StudioLogEntry,
  StudioMode,
  StudioPageStatus,
  StudioPreviewStatus,
  StudioProvider,
  StudioTaskStatus,
  SubmittedSnapshot,
  WorkflowFormValue,
  WorkflowJsonStatus,
  ResultMetadata,
} from "../model/view-model";

vi.mock("@/shared/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/shared/ui")>();

  function MockSelect({
    label,
    value,
    onChange,
    options,
    disabled,
  }: {
    label?: string;
    value?: string;
    onChange?: (value: string) => void;
    options?: Array<{ value: string; label: string }>;
    disabled?: boolean;
  }) {
    return (
      <label>
        <span>{label}</span>
        <select
          aria-label={label}
          value={value}
          onChange={(event) => onChange?.(event.target.value)}
          disabled={disabled}
        >
          {options?.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  return {
    ...actual,
    Select: MockSelect,
  };
});

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const useImageGenerationStudioStateMock = vi.fn();

vi.mock("../hooks/useImageGenerationStudioState", () => ({
  useImageGenerationStudioState: (...args: unknown[]) =>
    useImageGenerationStudioStateMock(...args),
}));

vi.mock("@/shared/api/comfyuiStudio", () => ({
  listComfyUiConnections: vi.fn().mockResolvedValue([]),
  listComfyUiFlows: vi.fn().mockResolvedValue([]),
  createComfyUiConnection: vi.fn(),
  updateComfyUiConnection: vi.fn(),
  testComfyUiConnection: vi.fn(),
  createComfyUiFlow: vi.fn(),
  updateComfyUiFlow: vi.fn(),
}));

vi.mock("@/shared/api/modelSettings", () => ({
  getRoleModelConfigs: vi.fn().mockResolvedValue([]),
  getProviderDetail: vi.fn(),
}));

const defaultPromptForm: PromptFormValue = {
  prompt: "",
  negativePrompt: "",
  size: "1024x1024",
  stylePreset: "none",
  seed: "",
  model: "gpt-image-1",
  providerParam: "",
};

const defaultWorkflowForm: WorkflowFormValue = {
  workflowJson: "",
  overridePrompt: "",
  overrideSeed: "",
  overrideSize: "1024x1024",
};

type MockStateOverrides = Partial<ReturnType<typeof createState>>;

function createState(overrides: MockStateOverrides = {}) {
  const base = {
    mode: "prompt" as StudioMode,
    provider: "openai-images" as StudioProvider,
    promptForm: defaultPromptForm,
    workflowForm: defaultWorkflowForm,
    pageStatus: "ready" as StudioPageStatus,
    previewStatus: "empty" as StudioPreviewStatus,
    taskStatus: null as StudioTaskStatus | null,
    formStatus: "clean" as StudioFormStatus,
    workflowJsonStatus: "empty" as WorkflowJsonStatus,
    submittedSnapshot: null as SubmittedSnapshot | null,
    result: null as ResultMetadata | null,
    logs: [] as StudioLogEntry[],
    isRunning: false,
    generationId: null as string | null,
    apiErrorMessage: null as string | null,
    canCancel: false,
    setMode: vi.fn(),
    setProvider: vi.fn(),
    setPromptForm: vi.fn(),
    setWorkflowForm: vi.fn(),
    submit: vi.fn(),
    cancel: vi.fn(),
    reset: vi.fn(),
  };

  return {
    ...base,
    ...overrides,
  };
}

describe("ImageGenerationStudioPage", () => {
  beforeEach(() => {
    useImageGenerationStudioStateMock.mockReset();
  });

  it("shows provider placeholder by default and renders the ComfyUI workbench when workflow mode is active", () => {
    useImageGenerationStudioStateMock.mockReturnValue(
      createState({
        mode: "prompt",
      }),
    );

    const { unmount } = render(<ImageGenerationStudioPage />);

    expect(screen.getByText("当前生图模型")).toBeInTheDocument();
    expect(screen.getByText("还没有配置默认生图模型")).toBeInTheDocument();

    useImageGenerationStudioStateMock.mockReturnValue(
      createState({
        mode: "workflow",
        provider: "comfyui-local",
      }),
    );
    unmount();
    render(<ImageGenerationStudioPage />);

    expect(
      screen.getByText("settings.microApps.imageGenerationStudio.cards.connection.title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("settings.microApps.imageGenerationStudio.cards.flow.title"),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "settings.microApps.imageGenerationStudio.cards.executionInputs.title",
      ),
    ).toBeInTheDocument();
  });

  it("renders invalid ComfyUI API format state in the flow editor", () => {
    useImageGenerationStudioStateMock.mockReturnValue(
      createState({
        mode: "workflow",
        provider: "comfyui-local",
      }),
    );

    render(<ImageGenerationStudioPage />);

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.microApps.imageGenerationStudio.flow.actions.new",
      }),
    );

    expect(
      screen.getByText(
        "settings.microApps.imageGenerationStudio.workflowJsonStatus.invalid-comfyui-format",
      ),
    ).toBeInTheDocument();
  });

  it("locks the page when a generation is running", () => {
    useImageGenerationStudioStateMock.mockReturnValue(
      createState({
        mode: "workflow",
        provider: "comfyui-local",
        pageStatus: "polling",
        previewStatus: "preview-loading",
        taskStatus: "running",
        formStatus: "locked-by-running-job",
        isRunning: true,
        workflowForm: {
          ...defaultWorkflowForm,
          workflowJson: "{\"1\":{\"class_type\":\"KSampler\",\"inputs\":{}}}",
        },
      }),
    );

    render(<ImageGenerationStudioPage />);

    expect(
      screen.getByRole("button", {
        name: "settings.microApps.imageGenerationStudio.actions.submit",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "settings.microApps.imageGenerationStudio.actions.reset",
      }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", {
        name: "settings.microApps.imageGenerationStudio.flow.actions.edit",
      }),
    ).toBeDisabled();
    expect(
      screen.queryByRole("button", {
        name: "settings.microApps.imageGenerationStudio.actions.cancel",
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText(
        "settings.microApps.imageGenerationStudio.messages.cancelUnavailable",
      ),
    ).toBeInTheDocument();
  });

  it("renders a blocked failure state on the page", () => {
    useImageGenerationStudioStateMock.mockReturnValue(
      createState({
        mode: "workflow",
        provider: "comfyui-local",
        pageStatus: "terminal-failed",
        previewStatus: "preview-failed",
        taskStatus: "blocked",
        result: {
          width: 0,
          height: 0,
          source: "base64",
          generatedAt: "2026-07-06T00:00:02.000Z",
          providerJobId: "provider-blocked",
          artifactId: "artifact-blocked",
          previewSrc: "",
          failureSummary:
            "settings.microApps.imageGenerationStudio.results.blockedSummary",
          errorMessage: "ComfyUI endpoint is not reachable.",
        },
      }),
    );

    render(<ImageGenerationStudioPage />);

    expect(
      screen.getByText(
        "settings.microApps.imageGenerationStudio.results.failedTitle",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("ComfyUI endpoint is not reachable."),
    ).toBeInTheDocument();
  });

  it("renders preview images from local-file artifacts", () => {
    useImageGenerationStudioStateMock.mockReturnValue(
      createState({
        mode: "workflow",
        provider: "comfyui-local",
        pageStatus: "terminal-success",
        previewStatus: "preview-ready",
        taskStatus: "succeeded",
        result: {
          width: 1024,
          height: 1024,
          source: "local-file",
          generatedAt: "2026-07-06T00:00:02.000Z",
          providerJobId: "provider-success",
          artifactId: "artifact-success",
          previewSrc:
            "/api/microapps/image-generation/generations/job-1/artifacts/artifact-success/content",
          artifactFileName: "job-1.png",
        },
      }),
    );

    render(<ImageGenerationStudioPage />);

    expect(
      screen.getByRole("img", {
        name: "settings.microApps.imageGenerationStudio.results.previewAlt",
      }),
    ).toHaveAttribute(
      "src",
      "/api/microapps/image-generation/generations/job-1/artifacts/artifact-success/content",
    );
  });
});
