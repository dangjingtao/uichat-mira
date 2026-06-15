import { loadToolDefinitions } from "./loader.js";
import type { LoadedTool } from "./types.js";

let cachedTools: LoadedTool[] | undefined;

export function getToolDefinitions(): LoadedTool[] {
  if (!cachedTools) {
    cachedTools = loadToolDefinitions();
  }

  return cachedTools.map((tool) => ({ ...tool }));
}

export function getToolById(id: string): LoadedTool | undefined {
  return getToolDefinitions().find((tool) => tool.id === id);
}

export function invalidateToolCache(): void {
  cachedTools = undefined;
}
