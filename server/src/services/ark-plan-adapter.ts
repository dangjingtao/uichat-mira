export type ArkPlanService = "code-plan" | "agent-plan";

export type ArkPlanRole = "system" | "user" | "assistant" | "tool";

export interface ArkPlanMessage {
  role: ArkPlanRole;
  content: string | Array<Record<string, unknown>> | null;
  [key: string]: unknown;
}

export interface ArkPlanChatRequest {
  model: string;
  messages: ArkPlanMessage[];
  stream?: boolean;
  [key: string]: unknown;
}

export interface ArkPlanModel {
  id: string;
  name: string;
  raw: Record<string, unknown>;
}

export interface ArkPlanAdapterConfig {
  service: ArkPlanService;
  baseUrl: string;
  apiKey: string;
  fetch?: typeof globalThis.fetch;
}

export interface ArkPlanAdapter {
  readonly service: ArkPlanService;
  readonly baseUrl: string;
  readonly apiKey: string;
  readonly modelsUrl: string;
  readonly chatCompletionsUrl: string;
  listModels(): Promise<ArkPlanModel[]>;
  createChatCompletion(request: ArkPlanChatRequest): Promise<Response>;
}

const PLAN_API_PATH_PATTERN = /^\/api\/(plan|coding)\/(v\d+)$/i;
const OFFICIAL_ARK_HOST_PATTERN = /^ark\..+\.volces\.com$/i;

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const assertSupportedBaseUrl = (baseUrl: string) => {
  const normalized = trimTrailingSlash(baseUrl.trim());

  if (!normalized) {
    throw new Error("Ark Plan base URL is required");
  }

  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error(`Ark Plan base URL is invalid: ${baseUrl}`);
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Ark Plan base URL must use http or https");
  }

  return url;
};

const resolveServiceBaseUrl = (service: ArkPlanService, baseUrl: string) => {
  const url = assertSupportedBaseUrl(baseUrl);
  url.pathname = trimTrailingSlash(url.pathname);
  const match = url.pathname.match(PLAN_API_PATH_PATTERN);

  if (match) {
    const version = match[2];
    url.pathname = `/api/${service === "code-plan" ? "coding" : "plan"}/${version}`;
    url.search = "";
    return trimTrailingSlash(url.toString());
  }

  return trimTrailingSlash(url.toString());
};

const isOfficialArkHost = (baseUrl: string) => {
  try {
    return OFFICIAL_ARK_HOST_PATTERN.test(new URL(baseUrl).hostname);
  } catch {
    return false;
  }
};

/**
 * The existing Ark model catalog is exposed by the coding endpoint even when
 * the saved connection uses the shared plan base URL.
 */
export const resolveArkPlanModelsUrl = (baseUrl: string) => {
  if (!isOfficialArkHost(baseUrl)) {
    return null;
  }

  try {
    return `${resolveServiceBaseUrl("code-plan", baseUrl)}/models`;
  } catch {
    return null;
  }
};

const getAuthHeaders = (apiKey: string): Record<string, string> => {
  const trimmedApiKey = apiKey.trim();
  return trimmedApiKey ? { Authorization: `Bearer ${trimmedApiKey}` } : {};
};

const toModel = (value: unknown): ArkPlanModel | null => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const raw = value as Record<string, unknown>;
  if (typeof raw.id !== "string" || !raw.id.trim()) {
    return null;
  }

  return {
    id: raw.id,
    name: typeof raw.name === "string" && raw.name.trim() ? raw.name : raw.id,
    raw,
  };
};

const readJson = async (response: Response) => {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
};

export const createArkPlanAdapter = (
  config: ArkPlanAdapterConfig,
): ArkPlanAdapter => {
  const serviceBaseUrl = resolveServiceBaseUrl(config.service, config.baseUrl);
  const modelsUrl =
    resolveArkPlanModelsUrl(config.baseUrl) ?? `${serviceBaseUrl}/models`;
  const requestFetch = config.fetch ?? globalThis.fetch.bind(globalThis);
  const headers = {
    ...getAuthHeaders(config.apiKey),
  };

  return {
    service: config.service,
    baseUrl: serviceBaseUrl,
    apiKey: config.apiKey,
    modelsUrl,
    chatCompletionsUrl: `${serviceBaseUrl}/chat/completions`,

    async listModels() {
      const response = await requestFetch(modelsUrl, {
        method: "GET",
        headers,
      });

      if (!response.ok) {
        throw new Error(
          `Ark ${config.service} model listing failed: ${response.status} ${response.statusText}`,
        );
      }

      const payload = await readJson(response);
      const data =
        payload && typeof payload === "object" && !Array.isArray(payload) && "data" in payload
          ? (payload as { data?: unknown }).data
          : [];

      return Array.isArray(data)
        ? data.map(toModel).filter((model): model is ArkPlanModel => Boolean(model))
        : [];
    },

    async createChatCompletion(request) {
      return requestFetch(`${serviceBaseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(request),
      });
    },
  };
};

export const resolveArkPlanBaseUrl = (
  service: ArkPlanService,
  baseUrl: string,
) => resolveServiceBaseUrl(service, baseUrl);
