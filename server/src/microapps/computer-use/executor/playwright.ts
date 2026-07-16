import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";
import type { PlaywrightChromiumLauncherLike } from "./types.js";

// The packaged backend runs from resources/server, which contains its generated
// package.json. Using the working directory keeps this loader valid in both
// ESM development and the CommonJS server bundle.
const require = createRequire(path.join(process.cwd(), "package.json"));

const workspaceModuleCandidates = () => [
  path.join(
    process.cwd(),
    "..",
    "node_modules",
    ".pnpm",
    "node_modules",
    "playwright-core",
  ),
  path.join(
    process.cwd(),
    "..",
    "node_modules",
    ".pnpm",
    "node_modules",
    "playwright",
  ),
];

const extractChromiumLauncher = (loaded: unknown) => {
  if (!loaded || typeof loaded !== "object") {
    return null;
  }

  const topLevel = loaded as { chromium?: PlaywrightChromiumLauncherLike };
  if (topLevel.chromium && typeof topLevel.chromium.launch === "function") {
    return topLevel.chromium;
  }

  const withDefault = loaded as {
    default?: { chromium?: PlaywrightChromiumLauncherLike };
  };
  if (
    withDefault.default?.chromium &&
    typeof withDefault.default.chromium.launch === "function"
  ) {
    return withDefault.default.chromium;
  }

  return null;
};

const resolvePlaywrightModule = async () => {
  const candidates = ["playwright-core", "playwright"] as const;

  for (const candidate of candidates) {
    try {
      const loaded = await import(candidate);
      const chromium = extractChromiumLauncher(loaded);
      if (chromium) {
        return chromium;
      }
    } catch {
      continue;
    }
  }

  for (const candidate of workspaceModuleCandidates()) {
    try {
      const resolvedPath = require.resolve(candidate);
      const loaded = await import(pathToFileURL(resolvedPath).href);
      const chromium = extractChromiumLauncher(loaded);
      if (chromium) {
        return chromium;
      }
    } catch {
      continue;
    }
  }

  throw new Error(
    "Playwright runtime is not available. Install or expose `playwright-core` or `playwright` before running computer_use browser actions.",
  );
};

export const loadPlaywrightChromiumLauncher =
  async (): Promise<PlaywrightChromiumLauncherLike> => {
    return await resolvePlaywrightModule();
  };
