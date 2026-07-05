import fs from "node:fs";
import path from "node:path";
import { loadPlaywrightChromiumLauncher } from "./playwright.js";
import type {
  ComputerUseAction,
  ComputerUseExecutionResult,
  ComputerUseExecutorOptions,
  PlaywrightPageLike,
} from "./types.js";

const ensureDir = (dirPath: string) => {
  fs.mkdirSync(dirPath, { recursive: true });
  return dirPath;
};

const resolveArtifactPath = (artifactRoot: string, requestedPath: string) => {
  const absolutePath = path.isAbsolute(requestedPath)
    ? requestedPath
    : path.resolve(artifactRoot, requestedPath);
  const normalizedRoot = path.resolve(artifactRoot);
  const normalizedTarget = path.resolve(absolutePath);

  if (
    normalizedTarget !== normalizedRoot &&
    !normalizedTarget.startsWith(`${normalizedRoot}${path.sep}`)
  ) {
    throw new Error("Capture artifactPath must stay inside the configured artifactRoot.");
  }

  ensureDir(path.dirname(normalizedTarget));
  return normalizedTarget;
};

const executeAction = async (
  page: PlaywrightPageLike,
  action: ComputerUseAction,
  artifactRoot: string,
  captures: string[],
) => {
  switch (action.kind) {
    case "navigate":
      await page.goto(action.url, { waitUntil: action.waitUntil ?? "load" });
      return `navigated to ${action.url}`;
    case "click":
      await page.click(action.selector);
      return `clicked ${action.selector}`;
    case "type":
      await page.type(action.selector, action.text, {
        delay: action.delayMs,
      });
      return `typed into ${action.selector}`;
    case "scroll":
      await page.evaluate(
        ({ x, y }) => {
          window.scrollBy(x ?? 0, y ?? 0);
        },
        { x: action.x ?? 0, y: action.y ?? 0 },
      );
      return `scrolled by (${action.x ?? 0}, ${action.y ?? 0})`;
    case "wait_for":
      if (action.selector) {
        await page.waitForSelector(action.selector, {
          state: action.state ?? "visible",
          timeout: action.timeoutMs,
        });
        return `waited for selector ${action.selector}`;
      }
      await page.waitForLoadState(action.loadState ?? "load");
      return `waited for load state ${action.loadState ?? "load"}`;
    case "capture": {
      const capturePath = resolveArtifactPath(artifactRoot, action.artifactPath);
      await page.screenshot({ path: capturePath, fullPage: true });
      captures.push(capturePath);
      return `captured screenshot ${capturePath}`;
    }
    case "finish":
      return action.summary ?? "finished execution";
  }
};

export const runComputerUseActions = async (
  actions: ComputerUseAction[],
  options: ComputerUseExecutorOptions,
): Promise<ComputerUseExecutionResult> => {
  ensureDir(options.artifactRoot);
  const launcher = options.launcher ?? (await loadPlaywrightChromiumLauncher());

  const browser = await launcher.launch({
    executablePath: options.executablePath,
    headless: options.headless ?? true,
  });
  const context = await browser.newContext();
  const page = await context.newPage();
  const captures: string[] = [];
  const steps: ComputerUseExecutionResult["steps"] = [];
  let finishSummary: string | undefined;

  try {
    for (const action of actions) {
      const detail = await executeAction(
        page,
        action,
        options.artifactRoot,
        captures,
      );
      steps.push({
        action: action.kind,
        status: "completed",
        detail,
      });
      if (action.kind === "finish") {
        finishSummary = action.summary;
      }
    }

    return {
      steps,
      captures,
      finalUrl: page.url(),
      finishSummary,
    };
  } finally {
    await context.close();
    await browser.close();
  }
};
