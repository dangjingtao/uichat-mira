// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ComputerUseStudioPage from "../index";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: { progress?: number }) =>
      typeof options?.progress === "number"
        ? `${key}:${options.progress}`
        : key,
  }),
}));

const useComputerUseStudioStateMock = vi.fn();

vi.mock("../hooks/useComputerUseStudioState", () => ({
  useComputerUseStudioState: (...args: unknown[]) =>
    useComputerUseStudioStateMock(...args),
}));

function createTask(overrides: Record<string, unknown> = {}) {
  return {
    taskId: "task-1",
    goal: "Submit the contact form",
    siteScope: ["example.com"],
    status: "queued",
    runtime: {
      status: "ready",
      checkedAt: "2026-07-06T00:00:00.000Z",
      details: {},
    },
    plan: {
      steps: [
        {
          id: "step-1",
          title: "Open the target page",
          description: "Navigate to the site and wait for it to load.",
          status: "pending",
          requiresApproval: false,
          riskSummary: "Low risk",
        },
      ],
      summary: "Plan summary",
      createdAt: "2026-07-06T00:00:00.000Z",
      updatedAt: "2026-07-06T00:00:00.000Z",
      version: 1,
    },
    approvals: [],
    evidence: {
      entries: [],
      artifacts: [],
    },
    createdAt: "2026-07-06T00:00:00.000Z",
    updatedAt: "2026-07-06T00:00:00.000Z",
    ...overrides,
  };
}

function createState(overrides: Record<string, unknown> = {}) {
  return {
    goal: "",
    setGoal: vi.fn(),
    siteScopeText: "",
    setSiteScopeText: vi.fn(),
    siteScope: [],
    activeTab: "plan",
    setActiveTab: vi.fn(),
    runtime: {
      status: "ready",
      checkedAt: "2026-07-06T00:00:00.000Z",
      details: {},
    },
    task: null,
    pendingApproval: null,
    currentStep: null,
    derivedTaskState: "idle",
    isBootstrapping: false,
    isInstalling: false,
    isMutatingTask: false,
    loadError: null,
    actionError: null,
    canCreatePlan: true,
    canStartTask: false,
    canCancelTask: false,
    hasInstallRequest: false,
    installRuntime: vi.fn(),
    createPlan: vi.fn(),
    startTask: vi.fn(),
    approvePending: vi.fn(),
    rejectPending: vi.fn(),
    cancelTask: vi.fn(),
    retry: vi.fn(),
    ...overrides,
  };
}

describe("ComputerUseStudioPage", () => {
  it("renders the runtime missing install guide", () => {
    useComputerUseStudioStateMock.mockReturnValue(
      createState({
        runtime: {
          status: "not_installed",
          checkedAt: "2026-07-06T00:00:00.000Z",
          details: {},
        },
      }),
    );

    render(<ComputerUseStudioPage />);

    expect(
      screen.getByText("settings.microApps.computerUseStudio.runtimeGuide.title"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "settings.microApps.computerUseStudio.actions.installRuntime",
      }),
    ).toBeDisabled();
  });

  it("renders the empty state placeholder", () => {
    useComputerUseStudioStateMock.mockReturnValue(createState());

    render(<ComputerUseStudioPage />);

    expect(
      screen.getByText("settings.microApps.computerUseStudio.execution.emptyTitle"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText(
        "settings.microApps.computerUseStudio.execution.emptyDescription",
      ).length,
    ).toBeGreaterThan(0);
  });

  it("renders the planning placeholder", () => {
    useComputerUseStudioStateMock.mockReturnValue(
      createState({
        task: createTask({ status: "planning" }),
        derivedTaskState: "planning",
        currentStep: {
          id: "step-1",
          title: "Build the plan",
          description: "Draft the execution steps.",
          status: "running",
          requiresApproval: false,
        },
      }),
    );

    render(<ComputerUseStudioPage />);

    expect(
      screen.getByText("settings.microApps.computerUseStudio.execution.planningTitle"),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Draft the execution steps.").length).toBeGreaterThan(0);
  });

  it("renders the awaiting approval placeholder and actions", () => {
    useComputerUseStudioStateMock.mockReturnValue(
      createState({
        task: createTask({ status: "awaiting_approval" }),
        pendingApproval: {
          id: "approval-1",
          stepId: "step-2",
          status: "pending",
          title: "Submit the form",
          reason: "This action changes site data.",
          requestedAt: "2026-07-06T00:00:00.000Z",
        },
        derivedTaskState: "awaiting_approval",
      }),
    );

    render(<ComputerUseStudioPage />);

    expect(
      screen.getByText(
        "settings.microApps.computerUseStudio.execution.awaitingApprovalTitle",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("This action changes site data.")).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "settings.microApps.computerUseStudio.actions.approveOnce",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", {
        name: "settings.microApps.computerUseStudio.actions.reject",
      }),
    ).toBeInTheDocument();
  });

  it("renders the running placeholder", () => {
    useComputerUseStudioStateMock.mockReturnValue(
      createState({
        task: createTask({ status: "running" }),
        derivedTaskState: "running",
        currentStep: {
          id: "step-2",
          title: "Fill the form",
          description: "Enter the captured values into the page.",
          status: "running",
          requiresApproval: false,
          riskSummary: "Writes data into the page",
        },
      }),
    );

    render(<ComputerUseStudioPage />);

    expect(screen.getAllByText("Fill the form").length).toBeGreaterThan(0);
    expect(screen.getByText("Writes data into the page")).toBeInTheDocument();
    expect(
      screen.getByText(
        "settings.microApps.computerUseStudio.execution.updatedAtHint",
      ),
    ).toBeInTheDocument();
  });

  it("renders the succeeded placeholder", () => {
    useComputerUseStudioStateMock.mockReturnValue(
      createState({
        task: createTask({
          status: "succeeded",
          result: {
            status: "succeeded",
            summary: "The browser task finished successfully.",
            completedAt: "2026-07-06T00:10:00.000Z",
          },
        }),
        derivedTaskState: "succeeded",
      }),
    );

    render(<ComputerUseStudioPage />);

    expect(
      screen.getByText("settings.microApps.computerUseStudio.taskState.succeeded"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("The browser task finished successfully.").length,
    ).toBeGreaterThan(0);
  });

  it("renders the failed placeholder", () => {
    useComputerUseStudioStateMock.mockReturnValue(
      createState({
        task: createTask({
          status: "failed",
          result: {
            status: "failed",
            summary: "The browser task failed at the submit step.",
            completedAt: "2026-07-06T00:10:00.000Z",
            error: {
              code: "STEP_FAILED",
              message: "Submit button was not found.",
            },
          },
        }),
        derivedTaskState: "failed",
      }),
    );

    render(<ComputerUseStudioPage />);

    expect(
      screen.getByText("settings.microApps.computerUseStudio.taskState.failed"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("The browser task failed at the submit step.").length,
    ).toBeGreaterThan(0);
  });

  it("renders the cancelled placeholder", () => {
    useComputerUseStudioStateMock.mockReturnValue(
      createState({
        task: createTask({
          status: "cancelled",
          result: {
            status: "cancelled",
            summary: "The browser task was cancelled by the user.",
            completedAt: "2026-07-06T00:10:00.000Z",
          },
        }),
        derivedTaskState: "cancelled",
      }),
    );

    render(<ComputerUseStudioPage />);

    expect(
      screen.getByText("settings.microApps.computerUseStudio.taskState.cancelled"),
    ).toBeInTheDocument();
    expect(
      screen.getAllByText("The browser task was cancelled by the user.").length,
    ).toBeGreaterThan(0);
  });

  it("renders the plan structure content", () => {
    useComputerUseStudioStateMock.mockReturnValue(
      createState({
        activeTab: "plan",
        task: createTask({
          plan: {
            steps: [
              {
                id: "step-1",
                title: "Open the target page",
                description: "Navigate to the site and wait for it to load.",
                status: "pending",
                requiresApproval: false,
                riskSummary: "Low risk",
              },
              {
                id: "step-2",
                title: "Submit the form",
                description: "Send the captured input values.",
                status: "awaiting_approval",
                requiresApproval: true,
                riskSummary: "Writes data into the page",
              },
            ],
            summary: "Plan summary",
            createdAt: "2026-07-06T00:00:00.000Z",
            updatedAt: "2026-07-06T00:00:00.000Z",
            version: 1,
          },
        }),
      }),
    );

    render(<ComputerUseStudioPage />);

    expect(screen.getByText("Plan summary")).toBeInTheDocument();
    expect(screen.getByText("1. Open the target page")).toBeInTheDocument();
    expect(screen.getByText("2. Submit the form")).toBeInTheDocument();
  });

  it("renders the evidence structure content", () => {
    useComputerUseStudioStateMock.mockReturnValue(
      createState({
        activeTab: "evidence",
        task: createTask({
          evidence: {
            entries: [
              {
                id: "entry-1",
                kind: "action",
                message: "Opened the target page.",
                createdAt: "2026-07-06T00:00:00.000Z",
              },
            ],
            artifacts: [
              {
                id: "artifact-1",
                kind: "screenshot",
                label: "Post-login snapshot",
                createdAt: "2026-07-06T00:00:00.000Z",
              },
            ],
          },
        }),
      }),
    );

    render(<ComputerUseStudioPage />);

    expect(screen.getByText("Opened the target page.")).toBeInTheDocument();
    expect(
      screen.getByText(
        "settings.microApps.computerUseStudio.evidence.artifactsTitle",
      ),
    ).toBeInTheDocument();
    expect(screen.getByText("Post-login snapshot")).toBeInTheDocument();
  });

  it("renders the result structure content", () => {
    useComputerUseStudioStateMock.mockReturnValue(
      createState({
        activeTab: "result",
        task: createTask({
          result: {
            status: "succeeded",
            summary: "The browser task finished successfully.",
            completedAt: "2026-07-06T00:10:00.000Z",
            finalUrl: "https://example.com/done",
            outputText: "Saved the profile changes.",
          },
        }),
      }),
    );

    render(<ComputerUseStudioPage />);

    expect(
      screen.getByText("The browser task finished successfully."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("settings.microApps.computerUseStudio.result.finalUrl"),
    ).toBeInTheDocument();
    expect(screen.getByText("https://example.com/done")).toBeInTheDocument();
    expect(screen.getByText("Saved the profile changes.")).toBeInTheDocument();
  });
});
