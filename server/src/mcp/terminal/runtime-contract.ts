export type TerminalRuntimeId = "host_spawn" | "sandbox_runtime";

export type TerminalProcessTreeMode =
  | "windows_job_object"
  | "windows_taskkill_tree"
  | "posix_process_group"
  | "child_process";

export type HostWorkspaceRelation = "inside" | "outside" | "unresolved";

export const resolveTerminalRuntimeId = (): TerminalRuntimeId =>
  process.env.MIRA_TERMINAL_RUNTIME?.trim().toLowerCase() === "sandbox_runtime"
    ? "sandbox_runtime"
    : "host_spawn";
