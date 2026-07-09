// @vitest-environment jsdom
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useImageGenerationStudioState } from "../hooks/useImageGenerationStudioState";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

type HookProbeApi = Parameters<typeof useImageGenerationStudioState>[0];

function HookProbe({ api }: { api: HookProbeApi }) {
  const state = useImageGenerationStudioState(api);

  return (
    <div>
      <div data-testid="mode">{state.mode}</div>
      <div data-testid="provider">{state.provider}</div>
      <div data-testid="form-status">{state.formStatus}</div>
      <div data-testid="task-status">{state.taskStatus ?? "none"}</div>
      <div data-testid="preview-src">{state.result?.previewSrc ?? ""}</div>
      <button type="button" onClick={() => state.setMode("workflow")}>
        workflow
      </button>
      <button type="button" onClick={() => state.setMode("prompt")}>
        prompt
      </button>
      <button
        type="button"
        onClick={() =>
          state.setPromptForm((current) => ({
            ...current,
            prompt: "debug prompt",
          }))
        }
      >
        fill prompt
      </button>
      <button type="button" onClick={() => state.submit()}>
        submit
      </button>
      <button type="button" onClick={() => state.cancel()}>
        cancel
      </button>
    </div>
  );
}

describe("useImageGenerationStudioState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    act(() => {
      vi.runOnlyPendingTimers();
    });
    vi.useRealTimers();
  });

  it("locks provider to comfyui in workflow mode and restores prompt mode", async () => {
    const api = {
      createImageGeneration: vi.fn(),
      getImageGeneration: vi.fn(),
      getArtifactPreviewUrl: vi.fn(),
    };
    render(<HookProbe api={api} />);
    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByTestId("provider").textContent).toBe("openai-images");

    fireEvent.click(screen.getByText("workflow"));
    expect(screen.getByTestId("mode").textContent).toBe("workflow");
    expect(screen.getByTestId("provider").textContent).toBe("comfyui-local");

    fireEvent.click(screen.getByText("prompt"));
    expect(screen.getByTestId("mode").textContent).toBe("prompt");
    expect(screen.getByTestId("provider").textContent).toBe("openai-images");
  });

  it("transitions into running and cancelled states", async () => {
    const api = {
      createImageGeneration: vi.fn(),
      getImageGeneration: vi.fn(),
      getArtifactPreviewUrl: vi.fn(),
    };
    render(<HookProbe api={api} />);
    act(() => {
      vi.runOnlyPendingTimers();
    });

    fireEvent.click(screen.getByText("fill prompt"));
    expect(screen.getByTestId("form-status").textContent).toBe("dirty");

    fireEvent.click(screen.getByText("cancel"));
    expect(screen.getByTestId("task-status").textContent).toBe("none");
  });

  it("polls running jobs with refresh=true and adopts authenticated blob previews", async () => {
    const api = {
      createImageGeneration: vi.fn().mockResolvedValue({
        generationId: "job-1",
        status: "running",
        executionKind: "async-job",
        artifacts: [],
        requestSummary: {
          providerId: "openai_images",
          providerParamKeys: [],
          inputFileCount: 0,
          hasWorkflowApiJson: false,
        },
        createdAt: "2026-07-06T00:00:00.000Z",
        updatedAt: "2026-07-06T00:00:00.000Z",
      }),
      getImageGeneration: vi.fn().mockResolvedValue({
        generationId: "job-1",
        status: "succeeded",
        executionKind: "async-job",
        artifacts: [
          {
            id: "artifact-1",
            type: "image",
            mimeType: "image/png",
            source: "local-file",
            localPath: "C:\\artifacts\\job 1.png",
            width: 1024,
            height: 1024,
            fileName: "job-1.png",
          },
        ],
        requestSummary: {
          providerId: "openai_images",
          providerParamKeys: [],
          inputFileCount: 0,
          hasWorkflowApiJson: false,
        },
        createdAt: "2026-07-06T00:00:00.000Z",
        updatedAt: "2026-07-06T00:00:01.000Z",
        completedAt: "2026-07-06T00:00:01.000Z",
      }),
      getArtifactPreviewUrl: vi.fn().mockResolvedValue("blob:job-1"),
    };

    render(<HookProbe api={api} />);
    act(() => {
      vi.runOnlyPendingTimers();
    });

    fireEvent.click(screen.getByText("fill prompt"));

    await act(async () => {
      fireEvent.click(screen.getByText("submit"));
      await Promise.resolve();
    });

    expect(screen.getByTestId("task-status").textContent).toBe("running");

    await act(async () => {
      vi.advanceTimersByTime(1200);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.getImageGeneration).toHaveBeenCalledWith("job-1", {
      refresh: true,
    });
    expect(api.getArtifactPreviewUrl).toHaveBeenCalledWith(
      "job-1",
      "artifact-1",
    );
    expect(screen.getByTestId("task-status").textContent).toBe("succeeded");
    expect(screen.getByTestId("preview-src").textContent).toBe("blob:job-1");
  });

  it("prefers authenticated blob previews when the artifact was materialized locally", async () => {
    const api = {
      createImageGeneration: vi.fn().mockResolvedValue({
        generationId: "job-remote-1",
        status: "running",
        executionKind: "workflow-runner",
        artifacts: [],
        requestSummary: {
          providerId: "comfyui_local",
          providerParamKeys: [],
          inputFileCount: 0,
          hasWorkflowApiJson: true,
        },
        createdAt: "2026-07-06T00:00:00.000Z",
        updatedAt: "2026-07-06T00:00:00.000Z",
      }),
      getImageGeneration: vi.fn().mockResolvedValue({
        generationId: "job-remote-1",
        status: "succeeded",
        executionKind: "workflow-runner",
        artifacts: [
          {
            id: "artifact-remote-1",
            type: "image",
            mimeType: "image/png",
            source: "remote-url",
            localPath:
              "D:\\workspace\\rag-demo\\server\\.artifacts\\job-remote-1.png",
            remoteUrl:
              "http://127.0.0.1:8188/view?filename=job-remote-1.png&type=output",
            width: 1024,
            height: 1024,
            fileName: "job-remote-1.png",
          },
        ],
        requestSummary: {
          providerId: "comfyui_local",
          providerParamKeys: [],
          inputFileCount: 0,
          hasWorkflowApiJson: true,
        },
        createdAt: "2026-07-06T00:00:00.000Z",
        updatedAt: "2026-07-06T00:00:01.000Z",
        completedAt: "2026-07-06T00:00:01.000Z",
      }),
      getArtifactPreviewUrl: vi.fn().mockResolvedValue("blob:job-remote-1"),
    };

    render(<HookProbe api={api} />);
    act(() => {
      vi.runOnlyPendingTimers();
    });

    fireEvent.click(screen.getByText("fill prompt"));

    await act(async () => {
      fireEvent.click(screen.getByText("submit"));
      await Promise.resolve();
    });

    await act(async () => {
      vi.advanceTimersByTime(1200);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(api.getArtifactPreviewUrl).toHaveBeenCalledWith(
      "job-remote-1",
      "artifact-remote-1",
    );
    expect(screen.getByTestId("task-status").textContent).toBe("succeeded");
    expect(screen.getByTestId("preview-src").textContent).toBe(
      "blob:job-remote-1",
    );
  });
});
