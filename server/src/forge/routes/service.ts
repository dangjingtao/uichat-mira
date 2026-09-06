import {
  initializeForgeRuntime,
  type ForgeRuntime,
} from "../runtime/runtime.js";
import {
  attachMainThreadRuntime,
  type MainThreadManager,
} from "../main-thread/runtime.js";
import {
  attachBuilderDispatchRuntime,
  type ForgeDispatchManager,
} from "../dispatch/index.js";
import {
  createForgeReviewManager,
  type ForgeReviewManager,
} from "../review/manager.js";
import {
  createProjectBatch,
  createProjectRepositoryTask,
  inspectProjectTaskSource,
  resolveProjectTask,
  updateProjectRepositoryTask,
} from "../project/project-task-actions.js";
import {
  getForgeProject,
  listForgeProjects,
  registerForgeProject,
  updateForgeProject,
} from "../project/project-registry.js";
import { getDispatchReadiness } from "../readiness.js";
import type { ForgeRuntimeState } from "../runtime/state.js";
import {
  projectInspector,
  projectRuntimeSummary,
  publicRuntimeEvent,
} from "./public-contract.js";

export interface ForgeRouteService {
  readonly runtime: ForgeRuntime;
  readonly mainThread: MainThreadManager;
  readonly dispatch: ForgeDispatchManager;
  readonly review: ForgeReviewManager;
  listProjects: typeof listForgeProjects;
  getProject: typeof getForgeProject;
  registerProject: typeof registerForgeProject;
  updateProject: typeof updateForgeProject;
  inspectTaskSource: typeof inspectProjectTaskSource;
  resolveTask: typeof resolveProjectTask;
  createTask: typeof createProjectRepositoryTask;
  updateTask: typeof updateProjectRepositoryTask;
  createBatch: typeof createProjectBatch;
  listBatches(projectId?: string): Promise<ForgeRuntimeState["batches"]>;
  getBatch(batchId: string): Promise<ForgeRuntimeState["batches"][number]>;
  readiness(batchId: string): Promise<ReturnType<typeof getDispatchReadiness>>;
  listReviews(input?: {
    projectId?: string;
    batchId?: string;
    taskId?: string;
  }): Promise<ForgeRuntimeState["reviews"]>;
  runtimeSummary(): Promise<ReturnType<typeof projectRuntimeSummary>>;
  inspector(query: Parameters<typeof projectInspector>[1]): Promise<ReturnType<typeof projectInspector>>;
  events(query?: {
    projectId?: string;
    batchId?: string;
    taskId?: string;
    dispatchId?: string;
    sessionId?: string;
  }): Promise<ForgeRuntimeState["events"]>;
}

let defaultServicePromise: Promise<ForgeRouteService> | null = null;

function requiredId(value: string, name: string): string {
  const id = value.trim();
  if (!id) throw new Error(name + " is required");
  return id;
}

export async function createForgeRouteService(
  runtime: ForgeRuntime,
): Promise<ForgeRouteService> {
  const [mainThread, dispatch] = await Promise.all([
    attachMainThreadRuntime(runtime),
    attachBuilderDispatchRuntime(runtime),
  ]);
  const review = createForgeReviewManager({ store: runtime.store });

  return {
    runtime,
    mainThread,
    dispatch,
    review,
    listProjects: listForgeProjects,
    getProject: getForgeProject,
    registerProject: registerForgeProject,
    updateProject: updateForgeProject,
    inspectTaskSource: inspectProjectTaskSource,
    resolveTask: resolveProjectTask,
    createTask: createProjectRepositoryTask,
    updateTask: updateProjectRepositoryTask,
    createBatch: createProjectBatch,
    async listBatches(projectId) {
      const state = await runtime.store.read();
      return state.batches
        .filter((batch) => !projectId || batch.projectId === projectId)
        .map((batch) => structuredClone(batch));
    },
    async getBatch(batchId) {
      const id = requiredId(batchId, "batchId");
      const state = await runtime.store.read();
      const batch = state.batches.find((item) => item.id === id);
      if (!batch) throw new Error("batch not found");
      return structuredClone(batch);
    },
    async readiness(batchId) {
      const id = requiredId(batchId, "batchId");
      const state = await runtime.store.read();
      return getDispatchReadiness(state, id);
    },
    async listReviews(input = {}) {
      const state = await runtime.store.read();
      return state.reviews
        .filter((reviewItem) => {
          if (input.projectId && reviewItem.projectId !== input.projectId) return false;
          if (input.batchId && reviewItem.batchId !== input.batchId) return false;
          if (input.taskId && reviewItem.taskId !== input.taskId) return false;
          return true;
        })
        .map((reviewItem) => ({ ...reviewItem }));
    },
    async runtimeSummary() {
      return projectRuntimeSummary(await runtime.store.read());
    },
    async inspector(query) {
      return projectInspector(await runtime.store.read(), query);
    },
    async events(query = {}) {
      const state = await runtime.store.read();
      return state.events
        .filter((event) => {
          if (query.projectId && event.projectId !== query.projectId) return false;
          if (query.batchId && event.batchId !== query.batchId) return false;
          if (query.taskId && event.taskId !== query.taskId) return false;
          if (query.dispatchId && event.dispatchId !== query.dispatchId) return false;
          if (query.sessionId && event.sessionId !== query.sessionId) return false;
          return true;
        })
        .slice(-500)
        .map(publicRuntimeEvent);
    },
  };
}

export async function getDefaultForgeRouteService(): Promise<ForgeRouteService> {
  if (!defaultServicePromise) {
    defaultServicePromise = (async () => {
      const runtime = await initializeForgeRuntime();
      return createForgeRouteService(runtime);
    })().catch((error) => {
      defaultServicePromise = null;
      throw error;
    });
  }
  return defaultServicePromise;
}

export function resetDefaultForgeRouteServiceForTests(): void {
  defaultServicePromise = null;
}
