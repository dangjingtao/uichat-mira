import fs from "node:fs";
import path from "node:path";

export const LOG_DIR = path.resolve(process.cwd(), "logs");
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
