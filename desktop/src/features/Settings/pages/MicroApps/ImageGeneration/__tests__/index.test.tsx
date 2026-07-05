// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  it("shows prompt mode by default and wires the workflow mode switch", () => {
    const setMode = vi.fn();
    useImageGenerationStudioStateMock.mockReturnValue(
      createState({
        mode: "prompt",
        setMode,
      }),
    );

    const { rerender } = render(<ImageGenerationStudioPage />);

    expect(
      screen.getByText("settings.microApps.imageGenerationStudio.cards.prompt.title"),
    ).toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", {
        name: "settings.microApps.imageGenerationStudio.modes.workflow",
      }),
    );

    expect(setMode).toHaveBeenCalledWith("workflow");

    useImageGenerationStudioStateMock.mockReturnValue(
      createState({
        mode: "workflow",
        provider: "comfyui-local",
      }),
    );
    rerender(<ImageGenerationStudioPage />);

    expect(
      screen.getByText("settings.microApps.imageGenerationStudio.cards.workflow.title"),
    ).toBeInTheDocument();
  });

  it("renders invalid ComfyUI API format state in workflow mode", () => {
    useImageGenerationStudioStateMock.mockReturnValue(
      createState({
        mode: "workflow",
        provider: "comfyui-local",
        workflowJsonStatus: "invalid-comfyui-format",
        workflowForm: {
          ...defaultWorkflowForm,
          workflowJson: "{}",
        },
        formStatus: "invalid",
      }),
    );

    render(<ImageGenerationStudioPage />);

    expect(
      screen.getByText(
        "settings.microApps.imageGenerationStudio.workflowJsonStatus.invalid-comfyui-format",
      ),
    ).toBeInTheDocument();
  });

  it("locks the page when a generation is running", () => {
    useImageGenerationStudioStateMock.mockReturnValue(
      createState({
        pageStatus: "polling",
        previewStatus: "preview-loading",
        taskStatus: "running",
        formStatus: "locked-by-running-job",
        isRunning: true,
        promptForm: {
          ...defaultPromptForm,
          prompt: "studio quality portrait",
        },
      }),
    );

    render(<ImageGenerationStudioPage />);

    expect(
      screen.getByText(
        "settings.microApps.imageGenerationStudio.formStatus.locked-by-running-job",
      ),
    ).toBeInTheDocument();
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
        name: "settings.microApps.imageGenerationStudio.actions.cancel",
      }),
    ).toBeDisabled();
    expect(
      screen.getByLabelText("settings.microApps.imageGenerationStudio.fields.prompt"),
    ).toBeDisabled();
    expect(
      screen.getByText(
        "settings.microApps.imageGenerationStudio.messages.cancelUnavailable",
      ),
    ).toBeInTheDocument();
  });

  it("renders a blocked failure state on the page", () => {
    useImageGenerationStudioStateMock.mockReturnValue(
      createState({
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
      screen.getByText(
        "settings.microApps.imageGenerationStudio.taskStatus.blocked",
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByText("ComfyUI endpoint is not reachable."),
    ).toBeInTheDocument();
  });

  it("renders preview images from local-file artifacts", () => {
    useImageGenerationStudioStateMock.mockReturnValue(
      createState({
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
          previewSrc: "file:///C:/artifacts/job-1.png",
          artifactFileName: "job-1.png",
        },
      }),
    );

    render(<ImageGenerationStudioPage />);

    expect(
      screen.getByRole("img", {
        name: "settings.microApps.imageGenerationStudio.results.previewAlt",
      }),
    ).toHaveAttribute("src", "file:///C:/artifacts/job-1.png");
  });
});
