import { useEffect, useMemo, useState } from "react";
import {
  cancelComputerUseTask,
  createComputerUseTask,
  getComputerUseRuntime,
  getComputerUseTask,
  installComputerUseRuntime,
  resolveComputerUseApproval,
  startComputerUseTask,
  type ComputerUseApprovalRequest,
  type ComputerUseRuntimeInstallRequest,
  type ComputerUseRuntimeState,
  type ComputerUseTask,
} from "@/shared/api/computerUse";

type StudioTab = "plan" | "evidence" | "result";

type ComputerUseStudioApi = {
  getComputerUseRuntime: typeof getComputerUseRuntime;
  installComputerUseRuntime: typeof installComputerUseRuntime;
  createComputerUseTask: typeof createComputerUseTask;
  getComputerUseTask: typeof getComputerUseTask;
  startComputerUseTask: typeof startComputerUseTask;
  resolveComputerUseApproval: typeof resolveComputerUseApproval;
  cancelComputerUseTask: typeof cancelComputerUseTask;
};

interface UseComputerUseStudioStateOptions {
  api?: Partial<ComputerUseStudioApi>;
  runtimeInstallRequest?: ComputerUseRuntimeInstallRequest;
}

export type ComputerUseStudioApiOverrides = Partial<ComputerUseStudioApi>;

const defaultApi: ComputerUseStudioApi = {
  getComputerUseRuntime,
  installComputerUseRuntime,
  createComputerUseTask,
  getComputerUseTask,
  startComputerUseTask,
  resolveComputerUseApproval,
  cancelComputerUseTask,
};

const TASK_POLLING_STATUSES = new Set([
  "queued",
  "planning",
  "awaiting_approval",
  "running",
]);

const TERMINAL_TASK_STATUSES = new Set([
  "blocked",
  "succeeded",
  "failed",
  "cancelled",
]);

const RUNTIME_POLLING_STATUSES = new Set(["downloading"]);

const POLL_INTERVAL_MS = 1500;

const normalizeErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Unknown error";

const parseSiteScope = (value: string) =>
  Array.from(
    new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );

const findPendingApproval = (task: ComputerUseTask | null) => {
  if (!task) {
    return null;
  }

  if (task.pendingApproval?.status === "pending") {
    return task.pendingApproval;
  }

  return task.approvals.find((item) => item.status === "pending") ?? null;
};

const findCurrentStep = (task: ComputerUseTask | null) => {
  const steps = task?.plan?.steps ?? [];
  if (steps.length === 0) {
    return null;
  }

  if (task?.currentStepId) {
    const matched = steps.find((step) => step.id === task.currentStepId);
    if (matched) {
      return matched;
    }
  }

  return (
    steps.find(
      (step) =>
        step.status === "running" || step.status === "awaiting_approval",
    ) ??
    steps[0] ??
    null
  );
};

const deriveTaskState = (task: ComputerUseTask | null) => {
  if (!task) {
    return "idle" as const;
  }

  if (task.status === "queued" && task.plan) {
    return "plan_ready" as const;
  }

  return task.status;
};

export function useComputerUseStudioState({
  api,
  runtimeInstallRequest,
}: UseComputerUseStudioStateOptions = {}) {
  const service = useMemo(
    () => ({ ...defaultApi, ...api }),
    [api],
  );
  const [goal, setGoal] = useState("");
  const [siteScopeText, setSiteScopeText] = useState("");
  const [activeTab, setActiveTab] = useState<StudioTab>("plan");
  const [runtime, setRuntime] = useState<ComputerUseRuntimeState | null>(null);
  const [task, setTask] = useState<ComputerUseTask | null>(null);
  const [isBootstrapping, setIsBootstrapping] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [isMutatingTask, setIsMutatingTask] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const siteScope = useMemo(() => parseSiteScope(siteScopeText), [siteScopeText]);
  const pendingApproval = useMemo(() => findPendingApproval(task), [task]);
  const currentStep = useMemo(() => findCurrentStep(task), [task]);
  const derivedTaskState = useMemo(() => deriveTaskState(task), [task]);

  const refreshRuntime = async () => {
    const nextRuntime = await service.getComputerUseRuntime();
    setRuntime(nextRuntime);
    return nextRuntime;
  };

  const refreshTask = async (taskId: string) => {
    const nextTask = await service.getComputerUseTask(taskId);
    setTask(nextTask);
    return nextTask;
  };

  useEffect(() => {
    let disposed = false;

    const bootstrap = async () => {
      setIsBootstrapping(true);
      setLoadError(null);
      try {
        const nextRuntime = await service.getComputerUseRuntime();
        if (!disposed) {
          setRuntime(nextRuntime);
        }
      } catch (error) {
        if (!disposed) {
          setLoadError(normalizeErrorMessage(error));
        }
      } finally {
        if (!disposed) {
          setIsBootstrapping(false);
        }
      }
    };

    void bootstrap();

    return () => {
      disposed = true;
    };
  }, [service]);

  useEffect(() => {
    if (
      !task?.taskId &&
      !RUNTIME_POLLING_STATUSES.has(runtime?.status ?? "")
    ) {
      return;
    }

    const interval = window.setInterval(() => {
      void (async () => {
        try {
          if (RUNTIME_POLLING_STATUSES.has(runtime?.status ?? "")) {
            await refreshRuntime();
          }

          if (task?.taskId && TASK_POLLING_STATUSES.has(task.status)) {
            await refreshTask(task.taskId);
          }
        } catch (error) {
          setActionError(normalizeErrorMessage(error));
        }
      })();
    }, POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(interval);
    };
  }, [runtime?.status, service, task?.taskId, task?.status]);

  const runTaskMutation = async (
    action: () => Promise<ComputerUseTask>,
    nextTab?: StudioTab,
  ) => {
    setIsMutatingTask(true);
    setActionError(null);
    try {
      const nextTask = await action();
      setTask(nextTask);
      if (nextTab) {
        setActiveTab(nextTab);
      }
      return nextTask;
    } catch (error) {
      setActionError(normalizeErrorMessage(error));
      throw error;
    } finally {
      setIsMutatingTask(false);
    }
  };

  const handleInstallRuntime = async () => {
    if (!runtimeInstallRequest) {
      setActionError("Computer use runtime package metadata is not configured.");
      return;
    }

    setIsInstalling(true);
    setActionError(null);
    try {
      const nextRuntime = await service.installComputerUseRuntime(
        runtimeInstallRequest,
      );
      setRuntime(nextRuntime);
    } catch (error) {
      setActionError(normalizeErrorMessage(error));
      throw error;
    } finally {
      setIsInstalling(false);
    }
  };

  const handleCreatePlan = async () => {
    const trimmedGoal = goal.trim();
    if (!trimmedGoal) {
      setActionError("Goal is required before creating a plan.");
      return;
    }

    await runTaskMutation(async () => {
      const nextTask = await service.createComputerUseTask({
        goal: trimmedGoal,
        siteScope,
      });
      return nextTask;
    }, "plan");
  };

  const handleStartTask = async () => {
    if (!task?.taskId) {
      return;
    }

    await runTaskMutation(
      () => service.startComputerUseTask(task.taskId),
      "evidence",
    );
  };

  const handleResolveApproval = async (
    approval: ComputerUseApprovalRequest,
    decision: "approved" | "rejected",
  ) => {
    if (!task?.taskId) {
      return;
    }

    await runTaskMutation(
      () =>
        service.resolveComputerUseApproval(task.taskId, {
          approvalId: approval.id,
          decision,
        }),
      "evidence",
    );
  };

  const handleCancelTask = async () => {
    if (!task?.taskId) {
      return;
    }

    await runTaskMutation(
      () => service.cancelComputerUseTask(task.taskId),
      "result",
    );
  };

  const handleRetry = async () => {
    if (task?.taskId && !TERMINAL_TASK_STATUSES.has(task.status)) {
      await refreshTask(task.taskId);
      return;
    }

    if (task) {
      setGoal(task.goal);
      setSiteScopeText(task.siteScope.join(", "));
    }

    setTask(null);
    setActionError(null);
    setActiveTab("plan");
    await refreshRuntime();
  };

  const canCreatePlan =
    runtime?.status === "ready" &&
    goal.trim().length > 0 &&
    !isBootstrapping &&
    !isInstalling &&
    !isMutatingTask &&
    !task;

  const canStartTask =
    runtime?.status === "ready" &&
    derivedTaskState === "plan_ready" &&
    !isBootstrapping &&
    !isInstalling &&
    !isMutatingTask;

  const canCancelTask =
    Boolean(task) &&
    !TERMINAL_TASK_STATUSES.has(task?.status ?? "") &&
    !isMutatingTask;

  return {
    goal,
    setGoal,
    siteScopeText,
    setSiteScopeText,
    siteScope,
    activeTab,
    setActiveTab,
    runtime,
    task,
    pendingApproval,
    currentStep,
    derivedTaskState,
    isBootstrapping,
    isInstalling,
    isMutatingTask,
    loadError,
    actionError,
    canCreatePlan,
    canStartTask,
    canCancelTask,
    hasInstallRequest: Boolean(runtimeInstallRequest),
    installRuntime: handleInstallRuntime,
    createPlan: handleCreatePlan,
    startTask: handleStartTask,
    approvePending: async () => {
      if (!pendingApproval) {
        return;
      }
      await handleResolveApproval(pendingApproval, "approved");
    },
    rejectPending: async () => {
      if (!pendingApproval) {
        return;
      }
      await handleResolveApproval(pendingApproval, "rejected");
    },
    cancelTask: handleCancelTask,
    retry: handleRetry,
  };
}

export type ComputerUseStudioState = ReturnType<
  typeof useComputerUseStudioState
>;
