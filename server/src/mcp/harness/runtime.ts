import { workspaceResource } from "../resources/workspace-resource.js";
import { editFileTool } from "../tools/edit-file.tool.js";
import { readExtractTool } from "../tools/read-extract.tool.js";
import { readListTool } from "../tools/read-list.tool.js";
import { readLocateTool } from "../tools/read-locate.tool.js";
import { readOpenTool } from "../tools/read-open.tool.js";
import { readSliceTool } from "../tools/read-slice.tool.js";
import { readTool } from "../tools/read.tool.js";
import { terminalSessionTool } from "../tools/terminal-session.tool.js";
import { webSearchTool } from "../tools/web-search.tool.js";
import {
  initializeExternalMcpDatabase,
  registerAllExternalMcpCapabilities,
} from "../external.js";
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
  registerCapability(readExtractTool);
  registerCapability(readSliceTool);
  registerCapability(readTool);
  registerCapability(editFileTool);
  registerCapability(webSearchTool);
  registerCapability(terminalSessionTool);
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
