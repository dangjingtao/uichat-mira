import { spawnSync } from "node:child_process";
import type { McpExecutionEnvironment } from "../core/definitions.js";
import { getWorkspaceSelection } from "../workspace.js";

let cachedRipgrepAvailability: boolean | null = null;

const detectRipgrepAvailability = () => {
  if (cachedRipgrepAvailability !== null) {
    return cachedRipgrepAvailability;
  }

  const result = spawnSync("rg", ["--version"], {
    encoding: "utf-8",
    windowsHide: true,
  });
  cachedRipgrepAvailability = !result.error && result.status === 0;
  return cachedRipgrepAvailability;
};

const defaultReadCapabilities: McpExecutionEnvironment["read"]["capabilities"] = [
  {
    id: "node-fs-directory",
    kind: "directory",
    provider: "node-fs",
    available: true,
    priority: 100,
  },
  {
    id: "fast-glob-locate",
    kind: "locate",
    provider: "fast-glob",
    available: true,
    priority: 100,
  },
  {
    id: "ripgrep-locate",
    kind: "locate",
    provider: "ripgrep",
    available: detectRipgrepAvailability(),
    priority: 95,
  },
  {
    id: "node-content-scan-locate",
    kind: "locate",
    provider: "node-fs",
    available: true,
    priority: 40,
  },
  {
    id: "pdf-cli-extract",
    kind: "extract",
    provider: "pdftotext",
    available: true,
    priority: 100,
    extensions: [".pdf"],
  },
  {
    id: "docx-cli-extract",
    kind: "extract",
    provider: "python-docx",
    available: true,
    priority: 90,
    extensions: [".docx"],
  },
  {
    id: "pptx-cli-extract",
    kind: "extract",
    provider: "python-pptx",
    available: true,
    priority: 90,
    extensions: [".pptx"],
  },
  {
    id: "xlsx-cli-extract",
    kind: "extract",
    provider: "python-openpyxl",
    available: true,
    priority: 90,
    extensions: [".xlsx"],
  },
  {
    id: "text-slice",
    kind: "slice",
    provider: "node-fs",
    available: true,
    priority: 100,
  },
  {
    id: "text-known-extension",
    kind: "text",
    provider: "node-fs",
    available: true,
    priority: 80,
  },
  {
    id: "text-content-probe",
    kind: "text",
    provider: "node-fs",
    available: true,
    priority: 40,
  },
  {
    id: "binary-summary",
    kind: "fallback",
    provider: "node-fs",
    available: true,
    priority: 10,
  },
];

const defaultEditCapabilities: McpExecutionEnvironment["edit"]["capabilities"] = [
  {
    id: "node-fs-write-file",
    kind: "write",
    provider: "node-fs",
    available: true,
    priority: 100,
  },
  {
    id: "node-fs-replace-block",
    kind: "replace",
    provider: "node-fs",
    available: true,
    priority: 100,
  },
];

const defaultTerminalCapabilities: McpExecutionEnvironment["terminal"]["capabilities"] = [
  {
    id: "child-process-shell-command",
    kind: "write",
    provider: "node-child_process",
    available: true,
    priority: 110,
  },
  {
    id: "pty-shell-session",
    kind: "write",
    provider: "node-pty",
    available: true,
    priority: 100,
  },
];

export const createHarnessEnvironmentSnapshot = (
  overrides: Partial<McpExecutionEnvironment> = {},
): McpExecutionEnvironment => {
  const workspace = getWorkspaceSelection();

  return {
    source: "harness",
    workspace: overrides.workspace ?? workspace,
    approvals: {
      outsideWorkspace: "prompt",
      persistence: "thread",
      ...overrides.approvals,
    },
    trace: {
      streamEvents: true,
      ...overrides.trace,
    },
    read: {
      capabilities:
        overrides.read?.capabilities?.map((capability) => ({ ...capability })) ??
        defaultReadCapabilities.map((capability) => ({ ...capability })),
    },
    edit: {
      capabilities:
        overrides.edit?.capabilities?.map((capability) => ({ ...capability })) ??
        defaultEditCapabilities.map((capability) => ({ ...capability })),
    },
    terminal: {
      capabilities:
        overrides.terminal?.capabilities?.map((capability) => ({ ...capability })) ??
        defaultTerminalCapabilities.map((capability) => ({ ...capability })),
    },
  };
};

export const getHarnessEnvironmentSnapshot = () => createHarnessEnvironmentSnapshot();
