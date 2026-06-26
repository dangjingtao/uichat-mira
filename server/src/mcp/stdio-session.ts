import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";

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

export interface StdioMcpSessionOptions {
  command: string;
  args: string[];
  env?: Record<string, string>;
  cwd?: string;
  onExit?: (message: string) => void;
}

const HEADER_DELIMITER = Buffer.from("\r\n\r\n");

const normalizeExitMessage = (
  code: number | null,
  signal: NodeJS.Signals | null,
  stderrOutput: string,
) => {
  const parts = ["External stdio MCP process exited"];
  if (code !== null) {
    parts.push(`with code ${code}`);
  }
  if (signal) {
    parts.push(`via signal ${signal}`);
  }
  if (stderrOutput.trim()) {
    parts.push(`stderr: ${stderrOutput.trim().slice(-500)}`);
  }
  return parts.join(" ");
};

export class StdioMcpSession {
  private process: ChildProcessWithoutNullStreams | null = null;
  private pendingRequests = new Map<string, PendingRequest>();
  private stdoutBuffer = Buffer.alloc(0);
  private stderrChunks: string[] = [];
  private closed = false;

  constructor(private readonly options: StdioMcpSessionOptions) {}

  start() {
    if (this.process) {
      return;
    }

    this.process = spawn(this.options.command, this.options.args, {
      stdio: "pipe",
      env: {
        ...process.env,
        ...(this.options.env ?? {}),
      },
      ...(this.options.cwd ? { cwd: this.options.cwd } : {}),
      windowsHide: true,
    });

    this.process.stdout.on("data", (chunk: Buffer) => {
      this.stdoutBuffer = Buffer.concat([this.stdoutBuffer, chunk]);
      this.drainFrames();
    });

    this.process.stderr.on("data", (chunk: Buffer) => {
      this.stderrChunks.push(chunk.toString("utf8"));
      if (this.stderrChunks.length > 20) {
        this.stderrChunks = this.stderrChunks.slice(-20);
      }
    });

    this.process.on("error", (error) => {
      this.closeWithError(error instanceof Error ? error : new Error(String(error)));
    });

    this.process.on("exit", (code, signal) => {
      this.closeWithError(
        new Error(
          normalizeExitMessage(code, signal, this.stderrChunks.join("")),
        ),
      );
    });
  }

  async request<T>(
    method: string,
    params: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<T> {
    this.start();
    if (!this.process || this.closed) {
      throw new Error("External stdio MCP session is not available");
    }

    const id = crypto.randomUUID();
    const payload = {
      jsonrpc: "2.0" as const,
      id,
      method,
      params,
    };

    return await new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`MCP ${method} timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      this.pendingRequests.set(id, {
        resolve: (value) => resolve(value as T),
        reject,
        timeout,
      });

      try {
        this.writeMessage(payload);
      } catch (error) {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error instanceof Error ? error : new Error(String(error)));
      }
    });
  }

  notify(method: string, params: Record<string, unknown>) {
    this.start();
    if (!this.process || this.closed) {
      throw new Error("External stdio MCP session is not available");
    }

    this.writeMessage({
      jsonrpc: "2.0",
      method,
      params,
    });
  }

  dispose(reason = "External stdio MCP session closed") {
    if (this.closed) {
      return;
    }

    this.closed = true;
    const processRef = this.process;
    this.process = null;

    for (const [id, pending] of this.pendingRequests.entries()) {
      clearTimeout(pending.timeout);
      pending.reject(new Error(reason));
      this.pendingRequests.delete(id);
    }

    this.stdoutBuffer = Buffer.alloc(0);

    if (processRef && !processRef.killed) {
      processRef.kill();
    }
  }

  private writeMessage(message: JsonRpcMessage) {
    if (!this.process || this.closed) {
      throw new Error("External stdio MCP session is not available");
    }

    const body = Buffer.from(JSON.stringify(message), "utf8");
    const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8");
    this.process.stdin.write(Buffer.concat([header, body]));
  }

  private drainFrames() {
    while (true) {
      const headerIndex = this.stdoutBuffer.indexOf(HEADER_DELIMITER);
      if (headerIndex === -1) {
        return;
      }

      const headerText = this.stdoutBuffer.subarray(0, headerIndex).toString("utf8");
      const contentLengthHeader = headerText
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line.toLowerCase().startsWith("content-length:"));

      if (!contentLengthHeader) {
        this.closeWithError(new Error("External stdio MCP response is missing Content-Length"));
        return;
      }

      const contentLength = Number(contentLengthHeader.split(":")[1]?.trim() ?? "");
      if (!Number.isInteger(contentLength) || contentLength < 0) {
        this.closeWithError(new Error("External stdio MCP response has invalid Content-Length"));
        return;
      }

      const frameStart = headerIndex + HEADER_DELIMITER.length;
      const frameEnd = frameStart + contentLength;
      if (this.stdoutBuffer.length < frameEnd) {
        return;
      }

      const body = this.stdoutBuffer.subarray(frameStart, frameEnd).toString("utf8");
      this.stdoutBuffer = this.stdoutBuffer.subarray(frameEnd);

      let message: JsonRpcMessage;
      try {
        message = JSON.parse(body) as JsonRpcMessage;
      } catch (error) {
        this.closeWithError(
          error instanceof Error ? error : new Error("Failed to parse stdio MCP JSON-RPC"),
        );
        return;
      }

      this.handleMessage(message);
    }
  }

  private handleMessage(message: JsonRpcMessage) {
    if (message.id === undefined || message.id === null) {
      return;
    }

    const key = String(message.id);
    const pending = this.pendingRequests.get(key);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(key);

    if (message.error) {
      pending.reject(new Error(message.error.message ?? "MCP stdio request failed"));
      return;
    }

    if (message.result === undefined) {
      pending.reject(new Error("MCP stdio response did not include result"));
      return;
    }

    pending.resolve(message.result);
  }

  private closeWithError(error: Error) {
    const message = error.message || "External stdio MCP session closed unexpectedly";
    this.options.onExit?.(message);
    this.dispose(message);
  }
}
