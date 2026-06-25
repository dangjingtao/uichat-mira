import type { McpToolImplementation } from "../core/definitions.js";
import { mcpBadRequest, mcpInternalError } from "../core/errors.js";

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

const SEARCH_TIMEOUT_MS = 10_000;

const withTimeoutSignal = () => AbortSignal.timeout(SEARCH_TIMEOUT_MS);

const resolveTavilyApiKey = (args: Record<string, unknown>) =>
  typeof args.apiKey === "string" && args.apiKey.trim()
    ? args.apiKey.trim()
    : (process.env.TAVILY_API_KEY ?? "").trim();

const fetchTavilySearch = async (
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<SearchResult[]> => {
  if (!apiKey) {
    throw mcpInternalError("Tavily apiKey is required");
  }

  const response = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: withTimeoutSignal(),
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: maxResults,
    }),
  });

  if (!response.ok) {
    throw mcpInternalError(`Tavily search failed: ${response.status}`);
  }

  const data = (await response.json()) as {
    results?: Array<{ title?: string; url?: string; content?: string }>;
  };

  return (data.results ?? []).map((item) => ({
    title: item.title ?? "",
    link: item.url ?? "",
    snippet: item.content ?? "",
  }));
};

export const webSearchTool: McpToolImplementation = {
  definition: {
    id: "web_search",
    title: "Web Search",
    description: "Search the public web through Tavily.",
    domain: "web_search",
    mode: "sync",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
        maxResults: { type: "number" },
        apiKey: { type: "string" },
      },
    },
    tags: ["search", "web"],
    capabilities: {
      sideEffect: "network",
      requiresApproval: false,
      networkAccess: true,
    },
  },
  execute: async (context) => {
    const query = typeof context.args.query === "string" ? context.args.query.trim() : "";
    if (!query) {
      throw mcpBadRequest("query is required");
    }

    const maxResults =
      typeof context.args.maxResults === "number" ? context.args.maxResults : 5;
    const apiKey = resolveTavilyApiKey(context.args);

    context.pushEvent({
      type: "invocation:progress",
      message: "Searching web with tavily",
    });

    const results = await fetchTavilySearch(query, maxResults, apiKey);

    context.addArtifact({
      kind: "search-results",
      title: `Search results for ${query}`,
      data: results,
      metadata: {
        query,
        provider: "tavily",
      },
    });

    return {
      result: {
        query,
        provider: "tavily",
        results,
      },
    };
  },
};
