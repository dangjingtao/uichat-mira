import os from "node:os";
import path from "node:path";
import pty from "node-pty";
import { mcpBadRequest } from "./core/errors.js";
import { resolveWorkspacePath } from "./workspace.js";

export interface TerminalSessionRecord {
  id: string;
  command: string;
  cwd: string;
  shell: string;
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
}) => {
  const shell =
    process.platform === "win32"
      ? process.env.ComSpec || "powershell.exe"
      : process.env.SHELL || "bash";
  const cwd = input.cwd ? resolveWorkspacePath(input.cwd) : resolveWorkspacePath(".");
  const sessionId = crypto.randomUUID();
  const child = pty.spawn(shell, [], {
    name: "xterm-color",
    cwd,
    env: {
      ...process.env,
      ...(input.env ?? {}),
    } as Record<string, string>,
  });

  const session: TerminalSessionRecord = {
    id: sessionId,
    command: input.command,
    cwd,
    shell,
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
