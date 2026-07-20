import fs from "node:fs";
import process from "node:process";

const args = process.argv.slice(2);
const command = args.at(0);

const providerVersion = process.env.FAKE_PROVIDER_VERSION ?? "1.2.3";
const telemetryStatus = process.env.FAKE_TELEMETRY_STATUS ?? "disabled";
const workspaceHash = process.env.CODEGRAPH_WORKSPACE_HASH ?? "missing-workspace-hash";
const indexRoot = process.env.CODEGRAPH_INDEX_ROOT ?? "missing-index-root";
const logRoot = process.env.CODEGRAPH_LOG_ROOT ?? "missing-log-root";
const healthSequence = (process.env.FAKE_HEALTH_SEQUENCE ?? "ready")
  .split(",")
  .map((entry) => entry.trim())
  .filter(Boolean);
const strictInitializedMode = process.env.FAKE_STRICT_INITIALIZED_MODE === "1";
const messageLogPath = process.env.FAKE_MESSAGE_LOG_PATH ?? null;
const startupArgsLogPath = process.env.FAKE_STARTUP_ARGS_LOG_PATH ?? null;

let healthIndex = 0;
let initializedReceived = false;

const appendMessageLog = (message) => {
  if (!messageLogPath) {
    return;
  }

  try {
    fs.appendFileSync(
      messageLogPath,
      `${JSON.stringify({
        method: message.method ?? null,
        id: message.id ?? null,
      })}\n`,
      "utf8",
    );
  } catch {
    // test fixture logging should not break protocol flow
  }
};

const appendStartupArgsLog = () => {
  if (!startupArgsLogPath) {
    return;
  }

  try {
    fs.appendFileSync(
      startupArgsLogPath,
      `${JSON.stringify({ argv: process.argv.slice(2) })}\n`,
      "utf8",
    );
  } catch {
    // startup logging should not break fixture behavior
  }
};

const parseCandidates = (rawValue, fallbackKind) => {
  if (!rawValue) {
    return [];
  }
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed.map((entry, index) => ({
      path: typeof entry.path === "string" ? entry.path : `unknown-${index}.ts`,
      startLine: Number.isInteger(entry.startLine) ? entry.startLine : null,
      endLine: Number.isInteger(entry.endLine) ? entry.endLine : null,
      kind: typeof entry.kind === "string" ? entry.kind : fallbackKind,
      summary: typeof entry.summary === "string" ? entry.summary : `summary-${index}`,
      snippet: typeof entry.snippet === "string" ? entry.snippet : null,
      score: typeof entry.score === "number" ? entry.score : 0.5,
    }));
  } catch {
    return [];
  }
};

const writeFrame = (payload) => {
  process.stdout.write(`${JSON.stringify(payload)}\n`);
};

const resolveHealthMode = () => {
  const current = healthSequence[Math.min(healthIndex, healthSequence.length - 1)] ?? "ready";
  healthIndex += 1;
  return current;
};

if (command === "--version") {
  process.stdout.write(`${providerVersion}\n`);
  process.exit(0);
}

if (command === "--telemetry-status") {
  process.stdout.write(`${telemetryStatus}\n`);
  process.exit(0);
}

if (command !== "--mcp") {
  process.stderr.write(`unknown command ${command}\n`);
  process.exit(2);
}

appendStartupArgsLog();

if (Number(process.env.FAKE_CRASH_AFTER_MS ?? "0") > 0) {
  setTimeout(() => {
    process.exit(Number(process.env.FAKE_CRASH_EXIT_CODE ?? "91"));
  }, Number(process.env.FAKE_CRASH_AFTER_MS));
}

process.stdin.setEncoding("utf8");
let buffer = "";

process.stdin.on("data", (chunk) => {
  buffer += chunk;
  while (true) {
    const newlineIndex = buffer.indexOf("\n");
    if (newlineIndex === -1) {
      break;
    }

    const line = buffer.slice(0, newlineIndex).trim();
    buffer = buffer.slice(newlineIndex + 1);
    if (!line) {
      continue;
    }

    let message;
    try {
      message = JSON.parse(line);
    } catch {
      process.stderr.write("invalid json\n");
      process.exit(3);
    }

    appendMessageLog(message);

    if (message.method === "initialize") {
      if ((process.env.FAKE_HANDSHAKE_MODE ?? "ok") === "fail") {
        writeFrame({
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32000,
            message: "initialize failed",
          },
        });
        continue;
      }

      writeFrame({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: "2025-06-18",
          serverInfo: {
            name: "fake-codegraph",
            version: providerVersion,
          },
          capabilities: {
            tools: {},
          },
        },
      });
      continue;
    }

    if (message.method === "notifications/initialized") {
      initializedReceived = true;
      continue;
    }

    if (message.method === "codegraph/health") {
      if (strictInitializedMode && !initializedReceived) {
        writeFrame({
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32002,
            message: "notifications/initialized required before codegraph/health",
          },
        });
        continue;
      }

      const mode = resolveHealthMode();
      if (mode === "error") {
        writeFrame({
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32001,
            message: "health probe failed",
          },
        });
        continue;
      }

      if (mode === "hang") {
        continue;
      }

      writeFrame({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          providerVersion,
          telemetryStatus,
          workspaceHash: mode === "workspace_mismatch" ? "wrong-workspace-hash" : workspaceHash,
          indexRoot,
          logRoot,
          status: mode === "degraded" ? "degraded" : "ready",
        },
      });
      continue;
    }

    if (message.method === "tools/list") {
      writeFrame({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          tools: [
            { name: "codegraph_status" },
          ],
        },
      });
      continue;
    }

    if (message.method === "tools/call") {
      const toolName = message.params?.name;
      if (toolName === "codegraph_status") {
        writeFrame({
          jsonrpc: "2.0",
          id: message.id,
          result: {
            content: [
              {
                type: "text",
                text: `CodeGraph Status\nFiles indexed: 12\nIndex is up to date\nWorkspace: ${workspaceHash}`,
              },
            ],
            isError: false,
          },
        });
        continue;
      }

      writeFrame({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          content: [
            {
              type: "text",
              text: `Unknown tool: ${toolName ?? "missing"}`,
            },
          ],
          isError: true,
        },
      });
      continue;
    }

    if (
      message.method === "codegraph/query" ||
      message.method === "codegraph/explore" ||
      message.method === "codegraph/affected"
    ) {
      if (strictInitializedMode && !initializedReceived) {
        writeFrame({
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32002,
            message: `${message.method} requires notifications/initialized first`,
          },
        });
        continue;
      }

      const rawMode = process.env.FAKE_QUERY_MODE ?? "ok";
      if (rawMode === "error") {
        writeFrame({
          jsonrpc: "2.0",
          id: message.id,
          error: {
            code: -32020,
            message: "query failed",
          },
        });
        continue;
      }

      const command = message.method.replace("codegraph/", "");
      const envKey = `FAKE_${command.toUpperCase()}_CANDIDATES`;
      const candidates = parseCandidates(
        process.env[envKey],
        command === "affected" ? "impact-edge" : command === "explore" ? "text-hit" : "reference",
      );
      writeFrame({
        jsonrpc: "2.0",
        id: message.id,
        result: {
          // Fake providers never invent retrieval results. Tests that need
          // candidates must inject them explicitly through FAKE_*_CANDIDATES.
          candidates,
        },
      });
      continue;
    }

    if (message.method === "shutdown") {
      if ((process.env.FAKE_SHUTDOWN_MODE ?? "exit") === "hang") {
        continue;
      }
      setTimeout(() => {
        process.exit(Number(process.env.FAKE_EXIT_CODE ?? "0"));
      }, Number(process.env.FAKE_SHUTDOWN_DELAY_MS ?? "10"));
      continue;
    }

    if (message.method === "codegraph/crash") {
      process.exit(Number(process.env.FAKE_CRASH_EXIT_CODE ?? "91"));
    }
  }
});