export type TerminalRuntimeId = "host_spawn" | "sandbox_runtime";

export type TerminalProcessTreeMode =
  | "windows_job_object"
  | "windows_taskkill_tree"
  | "posix_process_group"
  | "child_process";

export type HostWorkspaceRelation = "inside" | "outside" | "unresolved";

export const resolveTerminalRuntimeId = (): TerminalRuntimeId => {
  const requested = process.env.MIRA_TERMINAL_RUNTIME?.trim().toLowerCase();
  if (requested === "sandbox_runtime") {
    throw new Error(
      "sandbox_runtime is reserved for a future isolated provider and is not implemented in the current terminal runtime.",
    );
  }
  return "host_spawn";
};
