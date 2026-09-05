export type ForgeRepositoryState = "TODO" | "DOING" | "REVIEW" | "PASS" | "Integrated";
export type ForgeRuntimeState = "waiting" | "building" | "reviewing" | "fixing" | "interrupted" | "failed" | "blocked" | "stale";

export interface ForgeProject { id: string; name: string; repositoryPath: string; branch: string; activeRuntimeCount: number; attentionCount: number; }
export interface ForgeTask { id: string; title: string; repositoryState: ForgeRepositoryState; runtimeState: ForgeRuntimeState; source: string; dependencies: string[]; readiness: "ready" | "blocked" | "stale"; }
export interface ForgeMessage { id: string; author: "operator" | "mira"; body: string; createdAt: string; trace?: string[]; }
export interface ForgeRuntimeRecord { id: string; taskId: string; builder: string; state: ForgeRuntimeState; branch?: string; errorCode?: string; summary?: string; }
export interface ForgeEvent { id: string; timestamp: string; kind: "dispatch" | "exec" | "file" | "task" | "error"; message: string; taskId?: string; }
export interface ForgeWorkspaceSnapshot { projects: ForgeProject[]; selectedProjectId?: string; tasks: ForgeTask[]; selectedTaskId?: string; messages: ForgeMessage[]; runtimes: ForgeRuntimeRecord[]; events: ForgeEvent[]; }
