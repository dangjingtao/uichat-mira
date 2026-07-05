import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { EventEmitter } from "node:events";
import CONFIG from "@/config";

export const LOG_DIR = path.resolve(process.cwd(), CONFIG.LOG_DIR);
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch {}

export const LOG_FILE = path.join(LOG_DIR, "server.log");
export const ERROR_LOG_FILE = path.join(LOG_DIR, "error.log");
const logLineEmitter = new EventEmitter();
const LOGGER_LISTENERS_READY = Symbol.for("uichat-mira.logger.listeners-ready");
const LOGGER_STREAMS_KEY = Symbol.for("uichat-mira.logger.streams");

const isBrokenPipeError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "EPIPE";

let stdoutAvailable = true;
let stderrAvailable = true;

const globalWithLoggerState = globalThis as typeof globalThis & {
  [LOGGER_LISTENERS_READY]?: boolean;
  [LOGGER_STREAMS_KEY]?: {
    logStream: fs.WriteStream;
    errorStream: fs.WriteStream;
  };
};

if (!globalWithLoggerState[LOGGER_LISTENERS_READY]) {
  process.stdout.on("error", (error) => {
    if (isBrokenPipeError(error)) {
      stdoutAvailable = false;
    }
  });

  process.stderr.on("error", (error) => {
    if (isBrokenPipeError(error)) {
      stderrAvailable = false;
    }
  });

  globalWithLoggerState[LOGGER_LISTENERS_READY] = true;
}

const safeWriteToConsole = (message: string, useStdErr = false) => {
  const stream = useStdErr ? process.stderr : process.stdout;
  const isAvailable = useStdErr ? stderrAvailable : stdoutAvailable;

  if (!isAvailable || stream.destroyed) {
    return;
  }

  try {
    stream.write(message.endsWith("\n") ? message : `${message}\n`);
  } catch (error) {
    if (isBrokenPipeError(error)) {
      if (useStdErr) {
        stderrAvailable = false;
      } else {
        stdoutAvailable = false;
      }
    }
  }
};

const appendStructuredLog = (line: string, useStdErr: boolean) => {
  safeWriteToConsole(line, useStdErr);
  logLineEmitter.emit("line", line);

  try {
    fs.appendFileSync(LOG_FILE, line);
    if (useStdErr) {
      fs.appendFileSync(ERROR_LOG_FILE, line);
    }
  } catch {}
};

export const writeStructuredLog = (
  level: "info" | "warn" | "error",
  payload: Record<string, unknown>,
) => {
  const useStdErr = level !== "info";
  const message =
    typeof payload.msg === "string"
      ? payload.msg
      : typeof payload.event === "string"
        ? payload.event
        : "log";

  appendStructuredLog(
    JSON.stringify({
      level: level === "info" ? 30 : level === "warn" ? 40 : 50,
      time: Date.now(),
      pid: process.pid,
      hostname: os.hostname(),
      msg: message,
      ...payload,
    }) + "\n",
    useStdErr,
  );
};

export const createLogStreams = () => {
  if (!globalWithLoggerState[LOGGER_STREAMS_KEY]) {
    globalWithLoggerState[LOGGER_STREAMS_KEY] = {
      logStream: fs.createWriteStream(LOG_FILE, { flags: "a" }),
      errorStream: fs.createWriteStream(ERROR_LOG_FILE, { flags: "a" }),
    };
  }

  return {
    LOG_DIR,
    LOG_FILE,
    ERROR_LOG_FILE,
    logStream: globalWithLoggerState[LOGGER_STREAMS_KEY].logStream,
    errorStream: globalWithLoggerState[LOGGER_STREAMS_KEY].errorStream,
  };
};

export const getLoggerConfig = () => {
  const { logStream, errorStream } = createLogStreams();

  return {
    level: "info",
    stream: {
      write: (log: string) => {
        let useStdErr = false;

        try {
          const logObj = JSON.parse(log);
          useStdErr = typeof logObj.level === "number" && logObj.level >= 40;
        } catch {}

        safeWriteToConsole(log, useStdErr);
        logLineEmitter.emit("line", log);

        try {
          logStream.write(log);
          if (useStdErr) {
            errorStream.write(log);
          }
        } catch {}
      },
    },
  };
};

export const readRecentLogLines = async (limit: number): Promise<string[]> => {
  try {
    const content = await fs.promises.readFile(LOG_FILE, "utf8");
    return content
      .split(/\r?\n/)
      .filter(Boolean)
      .slice(-Math.max(1, limit));
  } catch {
    return [];
  }
};

export const subscribeToLogLines = (listener: (line: string) => void) => {
  logLineEmitter.on("line", listener);
  return () => {
    logLineEmitter.off("line", listener);
  };
};

export default {
  LOG_DIR,
  LOG_FILE,
  ERROR_LOG_FILE,
  createLogStreams,
  getLoggerConfig,
  readRecentLogLines,
  subscribeToLogLines,
};
