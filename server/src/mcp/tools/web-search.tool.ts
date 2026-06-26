import type {
  McpExecutionEnvironment,
  McpInvocationContext,
  McpToolImplementation,
} from "../core/definitions.js";
import { mcpBadRequest, mcpInternalError } from "../core/errors.js";
import { webSearchSettingsRepository } from "@/db/repositories/web-search-settings.repository.js";

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
}

type WebSearchProvider = "tavily" | "searxng";

type TavilyResponse = {
  results?: Array<{ title?: string; url?: string; content?: string }>;
};

type SearxngResponse = {
  results?: Array<{ title?: string; url?: string; content?: string }>;
  unresponsive_engines?: Array<[string, string]>;
};

type WebSearchExecutionContext = Pick<
  McpInvocationContext,
  "args" | "environment" | "pushEvent" | "trace"
>;

type WebSearchProviderPlan = {
  provider: WebSearchProvider;
  capabilityId: string;
  priority: number;
};

type WebSearchExecutionPlan = WebSearchProviderPlan & {
  reason?: string;
};

const SEARCH_TIMEOUT_MS = 10_000;
const DEFAULT_MAX_RESULTS = 5;

const withTimeoutSignal = () => AbortSignal.timeout(SEARCH_TIMEOUT_MS);

const assertWebSearchEnvironment = (environment?: McpExecutionEnvironment) => {
  if (!environment || environment.source !== "harness") {
    throw mcpInternalError("Web search requires a harness environment snapshot");
  }

  return environment;
};

const normalizeQuery = (value: unknown) => {
  const query = typeof value === "string" ? value.trim() : "";
  if (!query) {
    throw mcpBadRequest("query is required");
  }

  return query;
};

const normalizeMaxResults = (value: unknown) => {
  if (value === undefined) {
    return DEFAULT_MAX_RESULTS;
  }

  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw mcpBadRequest("maxResults must be a finite number");
  }

  return Math.max(1, Math.trunc(value));
};

const resolveStoredWebSearchSettings = () => webSearchSettingsRepository.get();

const resolveTavilyApiKey = (args: Record<string, unknown>) =>
  typeof args.apiKey === "string" && args.apiKey.trim()
    ? args.apiKey.trim()
    : (
        resolveStoredWebSearchSettings().tavilyApiKey ||
        (process.env.TAVILY_API_KEY ?? "")
      ).trim();

const resolveSearxngBaseUrl = (args: Record<string, unknown>) =>
  typeof args.baseUrl === "string" && args.baseUrl.trim()
    ? args.baseUrl.trim().replace(/\/+$/, "")
    : (
        resolveStoredWebSearchSettings().searxngBaseUrl ||
        (process.env.SEARXNG_BASE_URL ?? "")
      )
        .trim()
        .replace(/\/+$/, "");

const sortProviderPlans = (
  environment: McpExecutionEnvironment,
  context: WebSearchExecutionContext,
): WebSearchProviderPlan[] => {
  const tavilyApiKey = resolveTavilyApiKey(context.args);
  const searxngBaseUrl = resolveSearxngBaseUrl(context.args);

  return [...environment.web_search.capabilities]
    .filter((capability) => capability.available)
    .map((capability) => {
      const provider = capability.provider === "searxng" ? "searxng" : "tavily";
      return {
        provider,
        capabilityId: capability.id,
        priority: capability.priority,
      } satisfies WebSearchProviderPlan;
    })
    .filter((plan) =>
      plan.provider === "tavily"
        ? Boolean(tavilyApiKey)
        : Boolean(searxngBaseUrl),
    )
    .sort((left, right) => right.priority - left.priority || left.provider.localeCompare(right.provider));
};

const fetchTavilySearch = async (
  query: string,
  maxResults: number,
  apiKey: string,
): Promise<SearchResult[]> => {
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

  const data = (await response.json()) as TavilyResponse;

  return (data.results ?? []).map((item) => ({
    title: item.title ?? "",
    link: item.url ?? "",
    snippet: item.content ?? "",
  }));
};

const buildSearxngSearchUrl = (input: {
  baseUrl: string;
  query: string;
}) => {
  const searchParams = new URLSearchParams({
    q: input.query,
    format: "json",
    language: "all",
    safesearch: "0",
    pageno: "1",
  });

  return `${input.baseUrl}/search?${searchParams.toString()}`;
};

const fetchSearxngSearch = async (
  query: string,
  maxResults: number,
  baseUrl: string,
): Promise<SearchResult[]> => {
  const response = await fetch(buildSearxngSearchUrl({ baseUrl, query }), {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
    signal: withTimeoutSignal(),
  });

  if (!response.ok) {
    throw mcpInternalError(`SearXNG search failed: ${response.status}`);
  }

  const data = (await response.json()) as SearxngResponse;
  const results = (data.results ?? [])
    .slice(0, maxResults)
    .map((item) => ({
      title: item.title ?? "",
      link: item.url ?? "",
      snippet: item.content ?? "",
    }));

  if (results.length === 0 && (data.unresponsive_engines?.length ?? 0) > 0) {
    const engineSummary = data.unresponsive_engines
      ?.map(([engine, reason]) => `${engine}: ${reason}`)
      .join("; ");
    throw mcpInternalError(
      `SearXNG returned no results because upstream engines were unavailable. ${engineSummary}`,
    );
  }

  return results;
};

const selectWebSearchPlan = ({
  args,
  environment,
  pushEvent,
  trace,
}: WebSearchExecutionContext) => {
  const harnessEnvironment = assertWebSearchEnvironment(environment);
  const planSpan = trace?.startSpan({
    name: "Resolve web search provider plan",
    kind: "strategy_selection",
  });

  const plans = sortProviderPlans(harnessEnvironment, {
    args,
    environment,
    pushEvent,
    trace,
  });
  const selected = plans[0];

  if (!selected) {
    planSpan?.end({
      status: "failed",
    });
    throw mcpInternalError(
      "No web search provider is available. Configure Tavily apiKey or SearXNG baseUrl.",
    );
  }

  pushEvent({
    type: "invocation:progress",
    message: `Web search plan: ${selected.capabilityId}`,
  });

  planSpan?.end({
    metadata: {
      provider: selected.provider,
      capabilityId: selected.capabilityId,
    },
  });

  return selected;
};

const executeWebSearchPlan = async (input: {
  plan: WebSearchProviderPlan;
  query: string;
  maxResults: number;
  apiKey: string;
  baseUrl: string;
}) => {
  if (input.plan.provider === "tavily") {
    return fetchTavilySearch(input.query, input.maxResults, input.apiKey);
  }

  return fetchSearxngSearch(input.query, input.maxResults, input.baseUrl);
};

export const webSearchTool: McpToolImplementation = {
  definition: {
    id: "web_search",
    title: "Web Search",
    description:
      "Search the public web through a harness-selected provider such as Tavily or SearXNG.",
    domain: "web_search",
    mode: "sync",
    inputSchema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string" },
        maxResults: { type: "number" },
        apiKey: { type: "string" },
        baseUrl: { type: "string" },
      },
      additionalProperties: false,
    },
    tags: ["search", "web"],
    capabilities: {
      sideEffect: "network",
      requiresApproval: false,
      networkAccess: true,
    },
  },
  execute: async (context) => {
    const query = normalizeQuery(context.args.query);
    const maxResults = normalizeMaxResults(context.args.maxResults);
    const resolvedApiKey = resolveTavilyApiKey(context.args);
    const resolvedBaseUrl = resolveSearxngBaseUrl(context.args);
    const harnessEnvironment = assertWebSearchEnvironment(context.environment);
    const plans = sortProviderPlans(harnessEnvironment, context);
    const executionAttempts: WebSearchExecutionPlan[] = [];

    let results: SearchResult[] | null = null;
    let selectedProvider: WebSearchProvider | null = null;
    let selectedCapabilityId = "";

    const planningSpan = context.trace.startSpan({
      name: "Resolve web search provider plan",
      kind: "strategy_selection",
    });
    const planSummary = plans[0];
    if (!planSummary) {
      planningSpan.end({ status: "failed" });
      throw mcpInternalError(
        "No web search provider is available. Configure Tavily apiKey or SearXNG baseUrl.",
      );
    }

    context.pushEvent({
      type: "invocation:progress",
      message: `Web search plan: ${planSummary.capabilityId}`,
    });

    planningSpan.end({
      metadata: {
        provider: planSummary.provider,
        capabilityId: planSummary.capabilityId,
      },
    });

    for (const plan of plans) {
      context.pushEvent({
        type: "invocation:progress",
        message: `Searching web with ${plan.provider}`,
      });

      const executionSpan = context.trace.startSpan({
        name: `Execute ${plan.provider} search`,
        kind: "command_execution",
        metadata: {
          provider: plan.provider,
        },
      });

      try {
        const nextResults = await executeWebSearchPlan({
          plan,
          query,
          maxResults,
          apiKey: resolvedApiKey,
          baseUrl: resolvedBaseUrl,
        });

        executionSpan.end({
          metadata: {
            provider: plan.provider,
            resultCount: nextResults.length,
          },
        });
        results = nextResults;
        selectedProvider = plan.provider;
        selectedCapabilityId = plan.capabilityId;
        break;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        executionSpan.end({
          status: "failed",
          metadata: {
            provider: plan.provider,
            error: message,
          },
        });
        executionAttempts.push({
          ...plan,
          reason: message,
        });
      }
    }

    if (!results || !selectedProvider) {
      const attemptSummary = executionAttempts
        .map((attempt) => `${attempt.provider}: ${attempt.reason ?? "failed"}`)
        .join("; ");
      throw mcpInternalError(
        attemptSummary
          ? `Web search failed for all configured providers. ${attemptSummary}`
          : "No web search provider is available. Configure Tavily apiKey or SearXNG baseUrl.",
      );
    }

    context.addArtifact({
      kind: "search-results",
      title: `Search results for ${query}`,
      data: results,
      metadata: {
        query,
        provider: selectedProvider,
        capabilityId: selectedCapabilityId,
        ...(selectedProvider === "searxng"
          ? { baseUrl: resolvedBaseUrl }
          : {}),
      },
    });

    return {
      result: {
        query,
        provider: selectedProvider,
        capabilityId: selectedCapabilityId,
        ...(selectedProvider === "searxng"
          ? { baseUrl: resolvedBaseUrl }
          : {}),
        results,
      },
    };
  },
};
