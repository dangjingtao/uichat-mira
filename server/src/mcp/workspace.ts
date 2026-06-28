import path from "node:path";
import fs from "node:fs";
import { mcpBadRequest, mcpInternalError } from "./core/errors.js";

let selectedWorkspaceRoot: string | null = null;
const temporaryDefaultWorkspaceRoot = "D:\\testData";

const resolveConfiguredWorkspaceRoot = () => {
  const configured = process.env.UI_CHAT_WORKSPACE_ROOT?.trim();
  if (configured) {
    return path.resolve(configured);
  }

  if (process.env.NODE_ENV !== "production") {
    // Temporary verification fallback: keep local validation unblocked when the
    // app is launched without an explicit workspace selection. Remove once the
    // workspace picker flow is wired into the normal startup path.
    return path.resolve(temporaryDefaultWorkspaceRoot);
  }

  return null;
};

const assertWorkspaceDirectory = (targetPath: string) => {
  fs.mkdirSync(targetPath, { recursive: true });

  if (!fs.existsSync(targetPath)) {
    throw mcpBadRequest(`workspace path does not exist: ${targetPath}`);
  }

  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    throw mcpBadRequest(`workspace path must be a directory: ${targetPath}`);
  }
};

export const getWorkspaceRoot = () => {
  const currentRoot = selectedWorkspaceRoot ?? resolveConfiguredWorkspaceRoot();
  if (!currentRoot) {
    throw mcpBadRequest("workspace root is not selected");
  }

  assertWorkspaceDirectory(currentRoot);
  return currentRoot;
};

export const getWorkspaceSelection = () => {
  const configuredRoot = resolveConfiguredWorkspaceRoot();
  const activeRoot = selectedWorkspaceRoot ?? configuredRoot;

  return {
    rootPath: activeRoot,
    source: selectedWorkspaceRoot ? "selected" : configuredRoot ? "configured" : "unset",
  } as const;
};

export const selectWorkspaceRoot = (inputPath: unknown) => {
  if (typeof inputPath !== "string" || !inputPath.trim()) {
    throw mcpBadRequest("rootPath is required");
  }

  const resolved = path.resolve(inputPath.trim());
  assertWorkspaceDirectory(resolved);
  selectedWorkspaceRoot = resolved;

  return getWorkspaceSelection();
};

export const clearWorkspaceSelection = () => {
  selectedWorkspaceRoot = null;
  return getWorkspaceSelection();
};

export const resolveWorkspacePath = (inputPath: unknown) => {
  if (typeof inputPath !== "string" || !inputPath.trim()) {
    throw mcpBadRequest("path is required");
  }

  const workspaceRoot = getWorkspaceRoot();
  const resolved = path.resolve(workspaceRoot, inputPath);
  const relative = path.relative(workspaceRoot, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw mcpBadRequest("path must stay inside workspace root");
  }

  return resolved;
};

export const ensureParentDir = (targetPath: string) => {
  const parentDir = path.dirname(targetPath);
  fs.mkdirSync(parentDir, { recursive: true });
};

export const readTextFileSafe = (targetPath: string, encoding: BufferEncoding = "utf-8") => {
  try {
    return fs.readFileSync(targetPath, encoding);
  } catch (error) {
    throw mcpInternalError(`Failed to read file: ${targetPath}`, { cause: error });
  }
};
