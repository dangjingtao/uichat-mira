import fs from "node:fs";
import type {
  McpArtifact,
  McpExecutionEnvironment,
  McpStreamEventInput,
} from "../core/definitions.js";
import { createArtifact } from "../core/artifacts.js";
import { mcpBadRequest } from "../core/errors.js";
import {
  assertReadEnvironment,
  assertPathExists,
  describeReadPlan,
  listDirectory,
  readStructuredDocument,
} from "../document-readers.js";
import { executeReadLocate, describeLocatePlan } from "./locate.js";
import { resolveWorkspacePath } from "../workspace.js";
import type { ReadListResult, ReadOpenResult } from "./types.js";

type ReadExecutionContext = {
  args: Record<string, unknown>;
  environment?: McpExecutionEnvironment;
  pushEvent?: (event: McpStreamEventInput) => void;
};

type ReadExecutionResult = {
  contents: unknown;
  artifacts: McpArtifact[];
};

export const executeReadList = async ({
  args,
  environment,
  pushEvent,
}: ReadExecutionContext): Promise<ReadExecutionResult> => {
  assertReadEnvironment(environment);

  const targetPath = resolveWorkspacePath(args.path);
  assertPathExists(targetPath);

  const stat = fs.statSync(targetPath);
  if (!stat.isDirectory()) {
    throw mcpBadRequest("read_list requires a directory path");
  }

  pushEvent?.({
    type: "invocation:progress",
    message: "Directory listing plan: node-fs-directory",
  });

  const entries = listDirectory(environment, targetPath);
  const contents: ReadListResult = {
    type: "list",
    path: String(args.path),
    entries,
  };
  return {
    contents,
    artifacts: [
      createArtifact({
        kind: "table",
        title: `Directory ${String(args.path)}`,
        data: entries,
        metadata: { path: args.path },
      }),
    ],
  };
};

export const executeReadOpen = async ({
  args,
  environment,
  pushEvent,
}: ReadExecutionContext): Promise<ReadExecutionResult> => {
  const harnessEnvironment = assertReadEnvironment(environment);

  const targetPath = resolveWorkspacePath(args.path);
  assertPathExists(targetPath);

  const stat = fs.statSync(targetPath);
  if (!stat.isFile()) {
    throw mcpBadRequest("read_open requires a file path");
  }

  const plan = describeReadPlan(harnessEnvironment, targetPath);
  pushEvent?.({
    type: "invocation:progress",
    message: `Read plan: ${plan.chain.map((step) => step.id).join(" -> ")}`,
  });

  const result = await readStructuredDocument(harnessEnvironment, targetPath);
  const contents: ReadOpenResult = {
    type: "open",
    path: String(args.path),
    source: result,
  };
  return {
    contents,
    artifacts: [
      createArtifact({
        kind: result.kind,
        title: `Read ${String(args.path)}`,
        mimeType: result.mimeType,
        data: result.text,
        metadata: result.metadata,
      }),
    ],
  };
};

export const executeReadLocateRuntime = async ({
  args,
  environment,
  pushEvent,
}: ReadExecutionContext): Promise<ReadExecutionResult> => {
  const harnessEnvironment = assertReadEnvironment(environment);

  const plan = describeLocatePlan(harnessEnvironment, {
    query: String(args.query ?? ""),
    path: typeof args.path === "string" ? args.path : undefined,
    searchMode:
      args.searchMode === "path" || args.searchMode === "content" || args.searchMode === "auto"
        ? args.searchMode
        : undefined,
    extensions: Array.isArray(args.extensions) ? (args.extensions as string[]) : undefined,
    limit: typeof args.limit === "number" ? args.limit : undefined,
  });
  pushEvent?.({
    type: "invocation:progress",
    message: `Locate plan: ${plan.chain.map((step) => step.id).join(" -> ")}`,
  });

  const result = await executeReadLocate(harnessEnvironment, args);
  return {
    contents: result,
    artifacts: [
      createArtifact({
        kind: "search-results",
        title: `Locate ${String(args.query ?? "")}`,
        data: result.matches,
        metadata: {
          scope: result.scope,
          query: result.query,
          searchMode: result.searchMode,
        },
      }),
    ],
  };
};
