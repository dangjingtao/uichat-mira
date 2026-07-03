import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

type LoadLocalEnv = (rootDir: string) => Record<string, string>;
const requireFromWorkspace = (workspaceRoot: string) =>
  createRequire(path.join(workspaceRoot, "package.json"));

const WORKSPACE_SENTINELS = [".env", "runtime.config.cjs", "pnpm-workspace.yaml"];

export const findWorkspaceRoot = (startDir: string): string | null => {
  let currentDir = path.resolve(startDir);

  while (true) {
    const hasWorkspaceMarker = WORKSPACE_SENTINELS.some((entry) =>
      fs.existsSync(path.join(currentDir, entry)),
    );

    if (hasWorkspaceMarker) {
      return currentDir;
    }

    const parentDir = path.dirname(currentDir);
    if (parentDir === currentDir) {
      return null;
    }

    currentDir = parentDir;
  }
};

export const applyWorkspaceEnvBootstrap = (startDir = process.cwd()) => {
  const workspaceRoot = findWorkspaceRoot(startDir);

  if (workspaceRoot) {
    const loaderPath = path.join(workspaceRoot, "scripts", "load-local-env.cjs");

    if (!fs.existsSync(loaderPath)) {
      return;
    }

    const loadLocalEnv = requireFromWorkspace(workspaceRoot)(
      "./scripts/load-local-env.cjs",
    ) as LoadLocalEnv;
    loadLocalEnv(workspaceRoot);
  }
};

applyWorkspaceEnvBootstrap();
