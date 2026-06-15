import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import CONFIG from "@/config";

export const LOG_DIR = path.resolve(process.cwd(), CONFIG.LOG_DIR);
try {
  fs.mkdirSync(LOG_DIR, { recursive: true });
} catch {}

export const LOG_FILE = path.join(LOG_DIR, "server.log");
export const ERROR_LOG_FILE = path.join(LOG_DIR, "error.log");

const isBrokenPipeError = (error: unknown): boolean =>
  error instanceof Error && "code" in error && error.code === "EPIPE";

let stdoutAvailable = true;
let stderrAvailable = true;

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
  const logStream = fs.createWriteStream(LOG_FILE, { flags: "a" });
  const errorStream = fs.createWriteStream(ERROR_LOG_FILE, { flags: "a" });

  return {
    LOG_DIR,
    LOG_FILE,
    ERROR_LOG_FILE,
    logStream,
    errorStream,
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

export default {
  LOG_DIR,
  LOG_FILE,
  ERROR_LOG_FILE,
  createLogStreams,
  getLoggerConfig,
};
