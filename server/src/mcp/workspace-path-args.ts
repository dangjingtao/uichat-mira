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
    candidate = trimmed.slice(1);
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

export const normalizeWorkspaceBoundaryArgs = <
  TDefinition extends {
    capabilities?: {
      workspaceBound?: boolean;
      workspaceBoundary?: {
        argKeys?: string[];
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
  if (argKeys.length === 0) {
    return { args };
  }

  let nextArgs: Record<string, unknown> | null = null;

  for (const argKey of argKeys) {
    const value = args[argKey];
    if (typeof value !== "string") {
      continue;
    }

    const normalized = normalizeWorkspaceRelativePathArg(value);
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
