export interface ToolParameterSchema {
  type: "object";
  required?: string[];
  properties: Record<string, unknown>;
}

export interface SearchRuntimeConfig {
  type: "search";
  engine: "duckduckgo" | "tavily";
  maxResults?: number;
}

export interface PromptRuntimeConfig {
  type: "prompt";
  entry: string;
  modelRole?: "task" | "llm";
}

export interface FileSystemRuntimeConfig {
  type: "filesystem";
  baseDir: string;
  allowedOperations?: Array<"read" | "write" | "list">;
}

export type ToolRuntimeConfig =
  | SearchRuntimeConfig
  | PromptRuntimeConfig
  | FileSystemRuntimeConfig;

export interface ToolDefinition {
  id: string;
  name: string;
  description: string;
  version?: string;
  category: "rag" | "system" | "tool";
  tags: string[];
  author?: string;
  parameters?: ToolParameterSchema;
  runtime: ToolRuntimeConfig;
}

export interface LoadedTool extends ToolDefinition {
  sourceDir: string;
}
