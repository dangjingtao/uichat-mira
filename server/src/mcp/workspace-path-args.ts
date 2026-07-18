import path from "node:path";

export const WORKSPACE_ROOT_SENTINEL = "/workspace";

export const isWindowsAbsolutePath = (value: string) =>
  /^[a-zA-Z]:[\\/]/.test(value) || value.startsWith("\\\\");

type NormalizeWorkspacePathResult =
  | {
      type: "normalized";
      value: string;
    }
  | {
      type: "unchanged";
      value: string;
    }
  | {
      type: "reject";
      reason: string;
    };

const rejectEscapedWorkspaceRoot = (): NormalizeWorkspacePathResult => ({
  type: "reject",
  reason: "Workspace path escaped the workspace root after normalization.",
});

const rejectInvalidWorkspaceDirectory = (): NormalizeWorkspacePathResult => ({
  type: "reject",
  reason:
    "Workspace directory path must be relative to the workspace root without absolute paths or parent traversal.",
});

export const normalizeWorkspaceRelativePathArg = (
  value: string,
): NormalizeWorkspacePathResult => {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      type: "unchanged",
      value,
    };
  }

  if (isWindowsAbsolutePath(trimmed)) {
    return {
      type: "unchanged",
      value: trimmed,
    };
  }

  let candidate = trimmed;
  if (
    trimmed === WORKSPACE_ROOT_SENTINEL ||
    trimmed === `${WORKSPACE_ROOT_SENTINEL}/`
  ) {
    candidate = ".";
  } else if (trimmed.startsWith(`${WORKSPACE_ROOT_SENTINEL}/`)) {
    candidate = trimmed.slice(WORKSPACE_ROOT_SENTINEL.length + 1);
  } else if (trimmed.startsWith("/")) {
    return {
      type: "unchanged",
      value: trimmed,
    };
  }

  const normalizedCandidate = path.posix.normalize(
    candidate.replaceAll("\\", "/"),
  );

  if (
    normalizedCandidate.startsWith("/") ||
    normalizedCandidate === ".." ||
    normalizedCandidate.startsWith("../") ||
    normalizedCandidate === ""
  ) {
    return rejectEscapedWorkspaceRoot();
  }

  if (normalizedCandidate === trimmed) {
    return {
      type: "unchanged",
      value: trimmed,
    };
  }

  return {
    type: "normalized",
    value: normalizedCandidate,
  };
};

export const normalizeWorkspaceRelativeDirectoryArg = (
  value: string,
): NormalizeWorkspacePathResult => {
  const trimmed = value.trim();
  if (!trimmed) {
    return {
      type: "unchanged",
      value,
    };
  }

  if (
    trimmed === WORKSPACE_ROOT_SENTINEL ||
    trimmed === `${WORKSPACE_ROOT_SENTINEL}/` ||
    trimmed.startsWith(`${WORKSPACE_ROOT_SENTINEL}/`) ||
    trimmed.startsWith("/")
  ) {
    return rejectInvalidWorkspaceDirectory();
  }

  if (isWindowsAbsolutePath(trimmed)) {
    return rejectInvalidWorkspaceDirectory();
  }

  const normalizedCandidate = path.posix.normalize(
    trimmed.replaceAll("\\", "/"),
  );

  if (
    normalizedCandidate.startsWith("/") ||
    normalizedCandidate === ".." ||
    normalizedCandidate.startsWith("../")
  ) {
    return rejectInvalidWorkspaceDirectory();
  }

  if (normalizedCandidate === trimmed) {
    return {
      type: "unchanged",
      value: trimmed,
    };
  }

  return {
    type: "normalized",
    value: normalizedCandidate,
  };
};

const isDeclaredHostProcessCwd = (input: {
  argKey: string;
  capabilities?: {
    sideEffect?: string;
    sandboxRequired?: boolean;
    workspaceBoundary?: {
      argTypes?: Partial<Record<string, "path" | "directory">>;
    };
  };
}) =>
  input.argKey === "cwd" &&
  input.capabilities?.sideEffect === "process" &&
  input.capabilities.sandboxRequired === false &&
  input.capabilities.workspaceBoundary?.argTypes?.[input.argKey] ===
    "directory";

export const normalizeWorkspaceBoundaryArgs = <
  TDefinition extends {
    capabilities?: {
      sideEffect?: string;
      sandboxRequired?: boolean;
      workspaceBound?: boolean;
      workspaceBoundary?: {
        argKeys?: string[];
        argTypes?: Partial<Record<string, "path" | "directory">>;
      };
    };
  },
>(
  definition: TDefinition,
  args: Record<string, unknown>,
): { args: Record<string, unknown> } | { rejectReason: string } => {
  if (definition.capabilities?.workspaceBound !== true) {
    return { args };
  }

  const argKeys = definition.capabilities.workspaceBoundary?.argKeys ?? [];
  const argTypes = definition.capabilities.workspaceBoundary?.argTypes ?? {};
  if (argKeys.length === 0) {
    return { args };
  }

  let nextArgs: Record<string, unknown> | null = null;

  for (const argKey of argKeys) {
    const value = args[argKey];
    if (typeof value !== "string") {
      continue;
    }

    // Host process cwd remains byte-for-byte stable so the exact input hash,
    // approval review, Harness boundary check, and final execution all refer
    // to the same directory. Other workspace-bound file/directory tools retain
    // their strict normalization contract.
    if (
      isDeclaredHostProcessCwd({
        argKey,
        capabilities: definition.capabilities,
      })
    ) {
      continue;
    }

    const normalized =
      argTypes[argKey] === "directory"
        ? normalizeWorkspaceRelativeDirectoryArg(value)
        : normalizeWorkspaceRelativePathArg(value);
    if (normalized.type === "reject") {
      return {
        rejectReason: normalized.reason,
      };
    }

    if (normalized.type === "normalized") {
      nextArgs ??= { ...args };
      nextArgs[argKey] = normalized.value;
    }
  }

  return {
    args: nextArgs ?? args,
  };
};
