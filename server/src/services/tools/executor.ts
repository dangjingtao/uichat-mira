import fs from "node:fs";
import path from "node:path";
import { providerProxyService } from "@/services/provider-proxy.service/index.js";
import { internalError } from "@/utils/route-errors.js";
import { getToolById } from "./registry.js";
import type {
  LoadedTool,
  PromptRuntimeConfig,
  SearchRuntimeConfig,
  FileSystemRuntimeConfig,
} from "./types.js";

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

export interface ToolExecutionResult {
  toolId: string;
  result: unknown;
}

function getParamValue<T>(
  parameters: Record<string, unknown>,
  key: string,
  fallback: T,
): T {
  const value = parameters[key];
  return value !== undefined ? (value as T) : fallback;
}

async function fetchTavilySearch(
  query: string,
  maxResults: number,
): Promise<SearchResult[]> {
  const apiKey = process.env.TAVILY_API_KEY;

  if (!apiKey) {
    throw internalError("TAVILY_API_KEY is not configured");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: maxResults,
    }),
  });

  if (!response.ok) {
    throw internalError(`Tavily search failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return (data.results ?? []).map((item) => ({
    title: item.title ?? "",
    link: item.url ?? "",
    snippet: item.content ?? "",
  }));
}

async function fetchDuckDuckGoSearch(
  query: string,
  maxResults: number,
): Promise<SearchResult[]> {
  const url = `https://lite.duckduckgo.com/lite/?q=${encodeURIComponent(query)}`;

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.0",
    },
  });

  if (!response.ok) {
    throw internalError(`DuckDuckGo search request failed: ${response.status}`);
  }

  const html = await response.text();
  const results: SearchResult[] = [];

  // lite.duckduckgo.com 的结果行大致格式：
  // <a href="..." class="result-link">title</a>
  // <td class="result-snippet">snippet</td>
  const linkMatches = html.matchAll(
    /<a[^>]+class="result-link"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi,
  );

  for (const match of linkMatches) {
    const link = match[1] ?? "";
    const title = match[2]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (!title || results.length >= maxResults) {
      continue;
    }

    results.push({ title, link, snippet: "" });
  }

  const snippetMatches = html.matchAll(
    /<td[^>]+class="result-snippet"[^>]*>([\s\S]*?)<\/td>/gi,
  );
  let index = 0;

  for (const match of snippetMatches) {
    if (index >= results.length) {
      break;
    }

    const snippet = match[1]
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    results[index].snippet = snippet;
    index += 1;
  }

  return results;
}

async function executeSearchTool(
  tool: LoadedTool,
  parameters: Record<string, unknown>,
): Promise<SearchResult[]> {
  const runtime = tool.runtime as SearchRuntimeConfig;
  const query = getParamValue<string>(parameters, "query", "").trim();

  if (!query) {
    throw internalError("Missing required parameter: query");
  }

  const defaultMaxResults = runtime.maxResults ?? 5;
  const maxResults = getParamValue<number>(parameters, "maxResults", defaultMaxResults);

  if (runtime.engine === "tavily") {
    return fetchTavilySearch(query, maxResults);
  }

  return fetchDuckDuckGoSearch(query, maxResults);
}

function renderPromptTemplate(template: string, parameters: Record<string, unknown>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const value = parameters[key];

    if (value === undefined) {
      return "";
    }

    if (typeof value === "string") {
      return value;
    }

    return JSON.stringify(value);
  });
}

async function executePromptTool(
  tool: LoadedTool,
  parameters: Record<string, unknown>,
): Promise<string> {
  const runtime = tool.runtime as PromptRuntimeConfig;
  const promptPath = path.join(tool.sourceDir, runtime.entry);

  if (!fs.existsSync(promptPath)) {
    throw internalError(`Prompt file not found: ${promptPath}`);
  }

  const template = fs.readFileSync(promptPath, "utf-8");
  const rendered = renderPromptTemplate(template, parameters);
  const modelRole = runtime.modelRole ?? "task";

  if (modelRole !== "task") {
    throw internalError(`Unsupported prompt model role: ${modelRole}`);
  }

  let result = "";

  for await (const delta of providerProxyService.streamTaskChatText([
    { role: "user", content: rendered },
  ])) {
    result += delta;
  }

  return result.trim();
}

function resolveSafeFilePath(baseDir: string, inputPath: unknown): string {
  if (typeof inputPath !== "string" || !inputPath) {
    throw internalError("Missing or invalid file path");
  }

  if (path.isAbsolute(inputPath)) {
    throw internalError("Absolute file paths are not allowed");
  }

  const resolvedBase = path.resolve(process.cwd(), baseDir);
  const resolvedTarget = path.resolve(resolvedBase, inputPath);
  const relative = path.relative(resolvedBase, resolvedTarget);

  if (relative.startsWith("..") || relative === "") {
    throw internalError("File path must be inside the allowed workspace");
  }

  return resolvedTarget;
}

export interface FileSystemListItem {
  name: string;
  type: "file" | "directory";
}

export interface FileSystemReadResult {
  content: string;
}

export interface FileSystemWriteResult {
  written: boolean;
  bytes: number;
}

async function executeFileSystemTool(
  tool: LoadedTool,
  parameters: Record<string, unknown>,
): Promise<FileSystemReadResult | FileSystemWriteResult | FileSystemListItem[]> {
  const runtime = tool.runtime as FileSystemRuntimeConfig;
  const operation = getParamValue<string>(parameters, "operation", "read");
  const allowed = runtime.allowedOperations ?? ["read", "write", "list"];

  if (!allowed.includes(operation as "read" | "write" | "list")) {
    throw internalError(`Operation not allowed: ${operation}`);
  }

  const targetPath = resolveSafeFilePath(runtime.baseDir, parameters.path);

  if (operation === "list") {
    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    return entries.map((entry) => ({
      name: entry.name,
      type: entry.isDirectory() ? "directory" : "file",
    }));
  }

  if (operation === "read") {
    const encoding = getParamValue<string>(parameters, "encoding", "utf-8");
    const content = fs.readFileSync(targetPath, encoding as BufferEncoding);
    return { content };
  }

  if (operation === "write") {
    if (typeof parameters.content !== "string") {
      throw internalError("Missing required parameter: content");
    }

    const encoding = getParamValue<string>(parameters, "encoding", "utf-8");
    const parentDir = path.dirname(targetPath);

    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    const buffer = Buffer.from(parameters.content, encoding as BufferEncoding);
    fs.writeFileSync(targetPath, buffer);

    return { written: true, bytes: buffer.length };
  }

  throw internalError(`Unsupported file system operation: ${operation}`);
}

export async function executeTool(
  toolId: string,
  parameters: Record<string, unknown> = {},
): Promise<ToolExecutionResult> {
  const tool = getToolById(toolId);

  if (!tool) {
    throw internalError(`Tool not found: ${toolId}`);
  }

  let result: unknown;

  if (tool.runtime.type === "search") {
    result = await executeSearchTool(tool, parameters);
  } else if (tool.runtime.type === "prompt") {
    result = await executePromptTool(tool, parameters);
  } else if (tool.runtime.type === "filesystem") {
    result = await executeFileSystemTool(tool, parameters);
  } else {
    throw internalError(`Unsupported tool runtime type: ${(tool.runtime as { type: string }).type}`);
  }

  return { toolId, result };
}
