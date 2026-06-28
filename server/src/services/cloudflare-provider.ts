import { fetchJsonWithTimeout } from "@/utils/http.js";
import { CLOUDFLARE_ACCOUNT_BASE_URL_GUIDE } from "@/providers/catalog.js";

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

const CLOUDFLARE_ACCOUNT_URL_PATTERN =
  /^(https:\/\/api\.cloudflare\.com\/client\/v4\/accounts\/([^/]+))(?:\/ai(?:\/v1)?)?$/i;

interface CloudflareApiEnvelope<T> {
  success?: boolean;
  errors?: Array<{ message?: string }>;
  messages?: Array<{ message?: string }>;
  result?: T;
}

interface CloudflareEmbeddingResult {
  data?: number[][];
  shape?: number[];
}

const isCloudflareApiEnvelope = <T>(
  value: CloudflareApiEnvelope<T> | T,
): value is CloudflareApiEnvelope<T> =>
  typeof value === "object" &&
  value !== null &&
  ("result" in value || "success" in value || "errors" in value);

export const isCloudflareBaseUrl = (baseUrl: string) =>
  CLOUDFLARE_ACCOUNT_URL_PATTERN.test(trimTrailingSlash(baseUrl.trim()));

export const resolveCloudflareAccountUrl = (baseUrl: string) => {
  const normalized = trimTrailingSlash(baseUrl.trim());
  const match = normalized.match(CLOUDFLARE_ACCOUNT_URL_PATTERN);

  if (!match?.[1] || !match[2]) {
    throw new Error(
      `Cloudflare baseUrl 格式不正确。请使用 "${CLOUDFLARE_ACCOUNT_BASE_URL_GUIDE}"`,
    );
  }

  return {
    accountId: match[2],
    accountUrl: match[1],
  };
};

export const normalizeCloudflareOpenAICompatibleBaseUrl = (
  baseUrl: string,
) => {
  const { accountUrl } = resolveCloudflareAccountUrl(baseUrl);
  return `${accountUrl}/ai/v1`;
};

const resolveCloudflareModelSearchUrl = (baseUrl: string) => {
  const { accountUrl } = resolveCloudflareAccountUrl(baseUrl);
  return `${accountUrl}/ai/models/search`;
};

export const resolveCloudflareRunUrl = (baseUrl: string, model: string) => {
  const { accountUrl } = resolveCloudflareAccountUrl(baseUrl);
  return `${accountUrl}/ai/run/${model.replace(/^\/+/, "")}`;
};

const toCloudflareCallableModel = (model: Record<string, unknown>) => {
  const candidates = [
    model.name,
    model.model,
    model.source,
    model.id,
  ];

  const callable = candidates.find(
    (candidate): candidate is string =>
      typeof candidate === "string" && candidate.startsWith("@cf/"),
  );

  return callable ?? (typeof model.name === "string" ? model.name : "");
};

export const listCloudflareModels = async (baseUrl: string, apiKey: string) => {
  const headers: HeadersInit = {};

  if (apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  const response = await fetchJsonWithTimeout<{
    result?: Array<Record<string, unknown>>;
  }>(resolveCloudflareModelSearchUrl(baseUrl), { headers });

  return (response.result ?? [])
    .map((model) => {
      const callableId = toCloudflareCallableModel(model);
      if (!callableId) {
        return null;
      }

      return {
        id: callableId,
        name: callableId,
        raw: model,
      };
    })
    .filter(
      (
        model,
      ): model is {
        id: string;
        name: string;
        raw: Record<string, unknown>;
      } => Boolean(model),
    );
};

export const createCloudflareEmbeddings = async ({
  baseUrl,
  apiKey,
  model,
  input,
  params,
}: {
  baseUrl: string;
  apiKey: string;
  model: string;
  input: string[];
  params: Record<string, unknown>;
}) => {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (apiKey.trim()) {
    headers.Authorization = `Bearer ${apiKey.trim()}`;
  }

  const response = await fetchJsonWithTimeout<
    CloudflareApiEnvelope<CloudflareEmbeddingResult> | CloudflareEmbeddingResult
  >(resolveCloudflareRunUrl(baseUrl, model), {
    method: "POST",
    headers,
    body: JSON.stringify({
      text: input,
      ...(typeof params.pooling === "string" ? { pooling: params.pooling } : {}),
    }),
  });

  if (isCloudflareApiEnvelope(response) && response.success === false) {
    const message =
      response.errors?.map((item) => item.message).filter(Boolean).join("; ") ||
      "Cloudflare embedding request failed";
    throw new Error(message);
  }

  const result = isCloudflareApiEnvelope(response) ? (response.result ?? {}) : response;

  return (result.data ?? []).filter(
    (embedding: number[]) => embedding.length > 0,
  );
};
