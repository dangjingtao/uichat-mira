import { workspaceResource } from "../mcp/resources/workspace-resource.js";
import {
  codebaseExploreTool,
} from "../mcp/managed-codegraph/codebase-explore.tool.js";
import {
  isCodebaseExplorePlannerExposureEnabled,
} from "../mcp/managed-codegraph/planner-exposure-config.js";
import { editFileTool } from "../mcp/tools/edit-file.tool.js";
import { readExtractTool } from "../mcp/tools/read-extract.tool.js";
import { readListTool } from "../mcp/tools/read-list.tool.js";
import { readLocateTool } from "../mcp/tools/read-locate.tool.js";
import { readOpenTool } from "../mcp/tools/read-open.tool.js";
import { readDiscoverTool } from "../mcp/tools/read-discover.tool.js";
import { readSliceTool } from "../mcp/tools/read-slice.tool.js";
import { readTool } from "../mcp/tools/read.tool.js";
import { terminalSessionTool } from "../mcp/tools/terminal-session.tool.js";
import { webSearchTool } from "../mcp/tools/web-search.tool.js";
import { workspaceMutationTool } from "../mcp/tools/workspace-mutation.tool.js";
import {
  initializeExternalMcpDatabase,
  registerAllExternalMcpCapabilities,
} from "../mcp/external.js";
import { webSearchSettingsRepository } from "@/db/repositories/web-search-settings.repository.js";
import { registerCapability, registerReadableResource } from "./registry.js";

let initialized = false;

export const initializeHarnessRuntime = () => {
  if (initialized) {
    return;
  }

  registerReadableResource(workspaceResource);
  registerCapability(readListTool);
  registerCapability(readLocateTool);
  registerCapability(readOpenTool);
  registerCapability(readDiscoverTool);
  registerCapability(readExtractTool);
  registerCapability(readSliceTool);
  registerCapability(readTool);
  registerCapability(editFileTool);
  registerCapability(workspaceMutationTool);
  registerCapability(webSearchTool);
  registerCapability(terminalSessionTool);
  if (isCodebaseExplorePlannerExposureEnabled()) {
    registerCapability(codebaseExploreTool);
  }
  // External MCP persistence is optional at bootstrap time. Some callers
  // (notably route-level tests and early app startup before DB wiring) only
  // need the built-in harness capabilities. In those cases we should not fail
  // the whole server just because DATABASE_URL has not been resolved yet.
  if (process.env.DATABASE_URL) {
    initializeExternalMcpDatabase();
    registerAllExternalMcpCapabilities();
    webSearchSettingsRepository.initialize();
  }
  initialized = true;
};

export const resetHarnessRuntime = () => {
  initialized = false;
};
