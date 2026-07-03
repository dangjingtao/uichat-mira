import os from "node:os";
import path from "node:path";
import pty from "node-pty";
import { mcpBadRequest } from "./core/errors.js";
import { resolveWorkspaceDirectoryPath } from "./workspace.js";
import type { McpExecutionEnvironment } from "./core/definitions.js";

export interface TerminalSessionRecord {
  id: string;
  command: string;
  cwd: string;
  shell: string;
  stdoutEncoding: string;
  createdAt: string;
  process: pty.IPty;
}

const sessionMap = new Map<string, TerminalSessionRecord>();

export const listTerminalSessions = () =>
  Array.from(sessionMap.values()).map((session) => ({
    id: session.id,
    command: session.command,
    cwd: session.cwd,
    shell: session.shell,
    stdoutEncoding: session.stdoutEncoding,
    createdAt: session.createdAt,
  }));

export const getTerminalSession = (sessionId: string) => sessionMap.get(sessionId);

export const removeTerminalSession = (sessionId: string) => {
  const session = sessionMap.get(sessionId);
  if (session) {
    try {
      session.process.kill();
    } catch {
      // ignore
    }
    sessionMap.delete(sessionId);
  }
};

export const clearTerminalSessions = () => {
  for (const sessionId of sessionMap.keys()) {
    removeTerminalSession(sessionId);
  }
};

export const createTerminalSession = (input: {
  command: string;
  cwd?: string;
  env?: Record<string, string>;
  shellProfile?: McpExecutionEnvironment["terminal"]["shellProfile"];
}) => {
  const shellProfile = input.shellProfile;
  const shell =
    shellProfile?.shell ??
    (process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "bash");
  const cwd = resolveWorkspaceDirectoryPath(input.cwd ?? ".");
  const sessionId = crypto.randomUUID();
  const encoding = shellProfile?.stdoutEncoding ?? "utf8";
  const child = pty.spawn(shell, [], {
    name: "xterm-color",
    cwd,
    env: {
      ...process.env,
      ...(input.env ?? {}),
    } as Record<string, string>,
    encoding,
  });

  const session: TerminalSessionRecord = {
    id: sessionId,
    command: input.command,
    cwd,
    shell,
    stdoutEncoding: encoding,
    createdAt: new Date().toISOString(),
    process: child,
  };
  sessionMap.set(sessionId, session);

  return session;
};

export const writeTerminalSession = (sessionId: string, command: string) => {
  const session = sessionMap.get(sessionId);
  if (!session) {
    throw mcpBadRequest(`terminal session not found: ${sessionId}`);
  }

  session.process.write(`${command}${os.EOL}`);
  return session;
};
