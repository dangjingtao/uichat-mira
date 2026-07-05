export type ComputerUseAction =
  | { kind: "navigate"; url: string; waitUntil?: "load" | "domcontentloaded" | "networkidle" }
  | { kind: "click"; selector: string }
  | { kind: "type"; selector: string; text: string; delayMs?: number }
  | { kind: "scroll"; x?: number; y?: number }
  | { kind: "wait_for"; selector?: string; timeoutMs?: number; state?: "attached" | "visible" | "hidden"; loadState?: "load" | "domcontentloaded" | "networkidle" }
  | { kind: "capture"; artifactPath: string }
  | { kind: "finish"; summary?: string };

export type ComputerUseExecutionResult = {
  steps: Array<{
    action: ComputerUseAction["kind"];
    status: "completed";
    detail: string;
  }>;
  captures: string[];
  finalUrl: string;
  finishSummary?: string;
};

export type PlaywrightPageLike = {
  goto(url: string, options?: { waitUntil?: "load" | "domcontentloaded" | "networkidle" }): Promise<unknown>;
  click(selector: string): Promise<unknown>;
  fill(selector: string, value: string, options?: { timeout?: number }): Promise<unknown>;
  type(
    selector: string,
    value: string,
    options?: { delay?: number },
  ): Promise<unknown>;
  waitForSelector(
    selector: string,
    options?: { state?: "attached" | "visible" | "hidden"; timeout?: number },
  ): Promise<unknown>;
  waitForLoadState(state?: "load" | "domcontentloaded" | "networkidle"): Promise<unknown>;
  evaluate<R, TArg = unknown>(
    pageFunction: (arg: TArg) => R,
    arg?: TArg,
  ): Promise<R>;
  screenshot(options: { path: string; fullPage?: boolean }): Promise<unknown>;
  url(): string;
};

export type PlaywrightContextLike = {
  newPage(): Promise<PlaywrightPageLike>;
  close(): Promise<unknown>;
};

export type PlaywrightBrowserLike = {
  newContext(): Promise<PlaywrightContextLike>;
  close(): Promise<unknown>;
};

export type PlaywrightChromiumLauncherLike = {
  launch(options: {
    executablePath?: string;
    headless?: boolean;
  }): Promise<PlaywrightBrowserLike>;
};

export type ComputerUseExecutorOptions = {
  launcher?: PlaywrightChromiumLauncherLike;
  executablePath?: string;
  headless?: boolean;
  artifactRoot: string;
};
