import fs from "node:fs";
import path from "node:path";
import CONFIG from "@/config/index.js";
import type { LoadedTool, ToolDefinition, ToolRuntimeConfig } from "./types.js";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

function isRuntimeConfig(value: unknown): value is ToolRuntimeConfig {
  if (!isRecord(value)) {
    return false;
  }

  const type = value.type;
  if (type !== "search" && type !== "prompt" && type !== "filesystem") {
    return false;
  }

  if (type === "search") {
    const engine = value.engine;
    return engine === "duckduckgo" || engine === "tavily";
  }

  if (type === "prompt") {
    return typeof value.entry === "string";
  }

  return typeof value.baseDir === "string";
}

function isToolDefinition(value: unknown): value is ToolDefinition {
  if (!isRecord(value)) {
    return false;
  }

  const requiredFields = ["id", "name", "description", "category", "tags", "runtime"];
  for (const field of requiredFields) {
    if (!(field in value)) {
      return false;
    }
  }

  if (
    typeof value.id !== "string" ||
    typeof value.name !== "string" ||
    typeof value.description !== "string"
  ) {
    return false;
  }

  const category = value.category;
  if (category !== "rag" && category !== "system" && category !== "tool") {
    return false;
  }

  if (!isStringArray(value.tags)) {
    return false;
  }

  if (value.version !== undefined && typeof value.version !== "string") {
    return false;
  }

  if (value.author !== undefined && typeof value.author !== "string") {
    return false;
  }

  if (value.parameters !== undefined && !isRecord(value.parameters)) {
    return false;
  }

  return isRuntimeConfig(value.runtime);
}

function loadToolsFromDir(baseDir: string): LoadedTool[] {
  if (!fs.existsSync(baseDir)) {
    return [];
  }

  const entries = fs.readdirSync(baseDir, { withFileTypes: true });
  const tools: LoadedTool[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const toolDir = path.join(baseDir, entry.name);
    const manifestPath = path.join(toolDir, "manifest.json");

    if (!fs.existsSync(manifestPath)) {
      continue;
    }

    try {
      const raw = fs.readFileSync(manifestPath, "utf-8");
      const parsed: unknown = JSON.parse(raw);

      if (!isToolDefinition(parsed)) {
        console.warn(`[tools] Invalid manifest: ${manifestPath}`);
        continue;
      }

      tools.push({ ...parsed, sourceDir: toolDir });
    } catch (error) {
      console.warn(
        `[tools] Failed to load tool from ${toolDir}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return tools;
}

export function loadToolDefinitions(): LoadedTool[] {
  const builtInDir = path.resolve(process.cwd(), CONFIG.TOOLS_DIR);
  const extendDir = path.resolve(process.cwd(), CONFIG.EXTEND_TOOLS_DIR);

  const builtInTools = loadToolsFromDir(builtInDir);
  const extendedTools = loadToolsFromDir(extendDir);

  const toolMap = new Map<string, LoadedTool>();

  for (const tool of builtInTools) {
    toolMap.set(tool.id, tool);
  }

  // extendTools 中的同名工具会覆盖内置工具
  for (const tool of extendedTools) {
    toolMap.set(tool.id, tool);
  }

  return Array.from(toolMap.values());
}
