import { spawn, spawnSync, type ChildProcessWithoutNullStreams } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

type JsonRpcMessage = {
  jsonrpc?: "2.0";
  id?: string | number | null;
  method?: string;
  params?: unknown;
  result?: unknown;
  error?: {
    code?: number;
    message?: string;
    data?: unknown;
  };
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
};

export interface ManagedJsonRpcExitInfo {
  code: number | null;
  signal: NodeJS.Signals | null;
  stderrSummary: string;
  message: string;
}

export interface ManagedJsonRpcSessionOptions {
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  stdoutLogPath?: string;
  stderrLogPath?: string;
  onExit?: (info: ManagedJsonRpcExitInfo) => void;
}

const MESSAGE_DELIMITER = Buffer.from("\n");

const hasPathSeparator = (value: string) => /[\\/]/.test(value);

const appendLog = (filePath: string | undefined, chunk: Buffer) => {
  if (!filePath) {
    return;
  }
  fs.appendFileSync(filePath, chunk);
};

const ensureLauncherAvailable = (command: string) => {
  const normalized = command.trim();
  if (!normalized) {
    throw new Error("Managed CodeGraph command is required");
  }

  if (hasPathSeparator(normalized)) {
    const resolved = path.resolve(normalized);
    if (!fs.existsSync(resolved)) {
      throw new Error(`Managed CodeGraph launcher not found: ${normalized}`);
    }
    return;
  }

  if (process.platform !== "win32") {
    return;
  }

  const probe = spawnSync("where.exe", [normalized], {
    windowsHide: true,
    encoding: "utf8",
    stdio: "pipe",
  });

  if (probe.status !== 0) {
    throw new Error(`Managed CodeGraph launcher not found: ${normalized}`);
  }
};

const normalizeExitMessage = (
  code: number | null,
  signal: NodeJS.Signals | null,
  stderrSummary: string,
) => {
  const parts = ["Managed CodeGraph process exited"];
  if (code !== null) {
    parts.push(`with code ${code}`);
  }
  if (signal) {
    parts.push(`via signal ${signal}`);
  }
  if (stderrSummary.trim()) {
    parts.push(`stderr: ${stderrSummary.trim().slice(-500)}`);
  }
  return parts.join(" ");
};

export class ManagedJsonRpcSession {
  private process: ChildProcessWithoutNullStreams | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private stdoutBuffer = Buffer.alloc(0);
  private stderrChunks: string[] = [];
  private closed = false;
  private exitInfo: ManagedJsonRpcExitInfo | null = null;
  private exitPromise: Promise<ManagedJsonRpcExitInfo>;
  private resolveExit!: (info: ManagedJsonRpcExitInfo) => void;

  constructor(private readonly options: ManagedJsonRpcSessionOptions) {
    this.exitPromise = new Promise<ManagedJsonRpcExitInfo>((resolve) => {
      this.resolveExit = resolve;
    });
  }

  start() {
    if (this.process) {
      return;
    }

    ensureLauncherAvailable(this.options.command);
    this.process = spawn(this.options.command, this.options.args, {
      stdio: "pipe",
      env: {
        ...process.env,
        ...(this.options.env ?? {}),
      },
      cwd: this.options.cwd,
      windowsHide: true,
    });

    this.process.stdout.on("data", (chunk: Buffer) => {
      appendLog(this.options.stdoutLogPath, chunk);
      this.stdoutBuffer = Buffer.concat([this.stdoutBuffer, chunk]);
      this.drainFrames();
    });

    this.process.stderr.on("data", (chunk: Buffer) => {
      appendLog(this.options.stderrLogPath, chunk);
      this.stderrChunks.push(chunk.toString("utf8"));
      if (this.stderrChunks.length > 20) {
        this.stderrChunks = this.stderrChunks.slice(-20);
      }
    });

    this.process.on("error", (error) => {
      this.finishWithExit({
        code: this.process?.exitCode ?? null,
        signal: this.process?.signalCode ?? null,
        stderrSummary: this.stderrChunks.join(""),
        message: error instanceof Error ? error.message : String(error),
      });
    });

    this.process.on("exit", (code, signal) => {
      this.finishWithExit({
        code,
        signal,
        stderrSummary: this.stderrChunks.join(""),
        message: normalizeExitMessage(code, signal, this.stderrChunks.join("")),
      });
    });
  }

  isAlive() {
    return Boolean(this.process && !this.closed && this.process.exitCode === null);
  }

  async request<T>(
    method: string,
    params: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<T> {
    this.start();
    if (!this.process || this.closed) {
      throw new Error("Managed CodeGraph session is not available");
    }

    const id = crypto.randomUUID();
    return await new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`Managed CodeGraph ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
      });

      try {
        this.writeMessage({
          jsonrpc: "2.0",
          id,
          method,
          params,
        });
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  notify(method: string, params: Record<string, unknown>) {
    this.start();
    this.writeMessage({
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  forceKill() {
    if (!this.process || this.process.killed) {
      return;
    }
    this.process.kill();
  }

  async waitForExit(timeoutMs: number) {
    if (this.exitInfo) {
      return this.exitInfo;
    }

    return await Promise.race([
      this.exitPromise,
      new Promise<ManagedJsonRpcExitInfo>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Managed CodeGraph stop timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }),
    ]);
  }

  private writeMessage(message: JsonRpcMessage) {
    if (!this.process || this.closed) {
      throw new Error("Managed CodeGraph session is not available");
    }

    this.process.stdin.write(Buffer.from(`${JSON.stringify(message)}\n`, "utf8"));
  }

  private drainFrames() {
    while (true) {
      const newlineIndex = this.stdoutBuffer.indexOf(MESSAGE_DELIMITER);
      if (newlineIndex === -1) {
        return;
      }

      const line = this.stdoutBuffer.subarray(0, newlineIndex).toString("utf8").replace(/\r$/, "");
      this.stdoutBuffer = this.stdoutBuffer.subarray(newlineIndex + 1);
      const body = line.trim();
      if (!body) {
        continue;
      }

      let message: JsonRpcMessage;
      try {
        message = JSON.parse(body) as JsonRpcMessage;
      } catch (error) {
        this.finishWithExit({
          code: this.process?.exitCode ?? null,
          signal: this.process?.signalCode ?? null,
          stderrSummary: this.stderrChunks.join(""),
          message:
            error instanceof Error
              ? error.message
              : "Managed CodeGraph JSON-RPC frame parsing failed",
        });
        return;
      }

      this.handleMessage(message);
    }
  }

  private handleMessage(message: JsonRpcMessage) {
    if (message.id === undefined || message.id === null) {
      return;
    }

    const pending = this.pendingRequests.get(String(message.id));
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(String(message.id));

    if (message.error) {
      pending.reject(new Error(message.error.message ?? "Managed CodeGraph request failed"));
      return;
    }

    if (message.result === undefined) {
      pending.reject(new Error("Managed CodeGraph response did not include result"));
      return;
    }

    pending.resolve(message.result);
  }

  private finishWithExit(info: ManagedJsonRpcExitInfo) {
    if (this.exitInfo) {
      return;
    }

    this.exitInfo = info;
    this.closed = true;
    const pendingEntries = [...this.pendingRequests.values()];
    this.pendingRequests.clear();
    for (const pending of pendingEntries) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(info.message));
    }

    this.resolveExit(info);
    this.options.onExit?.(info);
  }
}

