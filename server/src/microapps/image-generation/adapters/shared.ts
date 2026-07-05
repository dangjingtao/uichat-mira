import { createHmac } from "node:crypto";

import type {
  ImageGenerationArtifactCandidate,
  ImageGenerationJobError,
  ImageGenerationJobStatus,
} from "../core/types.js";
import type {
  HttpRequest,
  HttpResponse,
  ImageGenerationAdapterContext,
  JsonObject,
  JsonValue,
} from "./types.js";

export function createFetchAdapterContext(
  fetchImpl: typeof fetch = fetch,
): ImageGenerationAdapterContext {
  return {
    now: () => new Date(),
    async http(request) {
      const response = await fetchImpl(request.url, {
        method: request.method,
        headers: request.headers,
        body: request.body,
        signal: request.timeoutMs
          ? AbortSignal.timeout(request.timeoutMs)
          : undefined,
      });
      return response as HttpResponse;
    },
  };
}

export async function readJsonResponse<T>(
  response: HttpResponse,
): Promise<T> {
  return (await response.json()) as T;
}

export async function buildErrorMessage(response: HttpResponse): Promise<string> {
  try {
    const payload = (await response.json()) as Record<string, unknown>;
    const message =
      typeof payload.message === "string"
        ? payload.message
        : typeof payload.error === "string"
          ? payload.error
          : JSON.stringify(payload);
    return `HTTP ${response.status}: ${message}`;
  } catch {
    return `HTTP ${response.status}: ${await response.text()}`;
  }
}

export function ensurePrompt(
  providerId: string,
  prompt: string | undefined,
): string {
  if (!prompt || !prompt.trim()) {
    throw new Error(`${providerId} adapter requires a prompt.`);
  }
  return prompt.trim();
}

export function ensureWorkflowApiJson(
  workflowApiJson: JsonObject | undefined,
): JsonObject {
  if (!workflowApiJson || Array.isArray(workflowApiJson)) {
    throw new Error(
      "ComfyUI Local adapter requires workflowApiJson in API format.",
    );
  }
  return workflowApiJson;
}

export function joinUrl(baseUrl: string, path: string): string {
  const normalizedBase = baseUrl.endsWith("/") ? baseUrl : `${baseUrl}/`;
  return new URL(path.replace(/^\//, ""), normalizedBase).toString();
}

export function extractRemoteImageCandidates(
  urls: Array<string | undefined>,
  mimeType = "image/png",
): ImageGenerationArtifactCandidate[] {
  return urls
    .filter((url): url is string => Boolean(url))
    .map((remoteUrl) => ({
      type: "image",
      mimeType,
      source: "remote-url" as const,
      remoteUrl,
    }));
}

export function normalizeAsyncStatus(
  value: string | undefined,
): ImageGenerationJobStatus {
  const normalized = (value ?? "").toUpperCase();
  switch (normalized) {
    case "PENDING":
    case "QUEUED":
    case "1":
      return "queued";
    case "RUNNING":
    case "PROCESSING":
    case "2":
      return "running";
    case "SUCCEEDED":
    case "SUCCESS":
    case "5":
      return "succeeded";
    case "FAILED":
    case "FAIL":
    case "4":
      return "failed";
    case "CANCELED":
    case "CANCELLED":
      return "cancelled";
    case "BLOCKED":
      return "blocked";
    default:
      return "running";
  }
}

export function asJsonObject(
  value: unknown,
  fallback: JsonObject = {},
): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return fallback;
  }
  return value as JsonObject;
}

export function jsonStringify(value: Record<string, unknown>): string {
  return JSON.stringify(value);
}

function sha256Hex(value: string): string {
  return createHmac("sha256", "").update(value).digest("hex");
}

function hmacSha256(key: string | Buffer, value: string): Buffer {
  return createHmac("sha256", key).update(value).digest();
}

export function createTencentCloudAuthorization(params: {
  secretId: string;
  secretKey: string;
  service: string;
  host: string;
  action: string;
  version: string;
  region: string;
  timestamp: number;
  payload: string;
}): string {
  const date = new Date(params.timestamp * 1000).toISOString().slice(0, 10);
  const credentialScope = `${date}/${params.service}/tc3_request`;
  const canonicalHeaders =
    `content-type:application/json; charset=utf-8\n` +
    `host:${params.host}\n` +
    `x-tc-action:${params.action.toLowerCase()}\n`;
  const signedHeaders = "content-type;host;x-tc-action";
  const canonicalRequest = [
    "POST",
    "/",
    "",
    canonicalHeaders,
    signedHeaders,
    sha256Hex(params.payload),
  ].join("\n");
  const stringToSign = [
    "TC3-HMAC-SHA256",
    String(params.timestamp),
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join("\n");
  const secretDate = hmacSha256(`TC3${params.secretKey}`, date);
  const secretService = hmacSha256(secretDate, params.service);
  const secretSigning = hmacSha256(secretService, "tc3_request");
  const signature = createHmac("sha256", secretSigning)
    .update(stringToSign)
    .digest("hex");

  return [
    "TC3-HMAC-SHA256",
    `Credential=${params.secretId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(", ");
}

export async function expectOk(
  response: HttpResponse,
  request: HttpRequest,
): Promise<void> {
  if (response.status >= 200 && response.status < 300) {
    return;
  }
  const message = await buildErrorMessage(response);
  throw new Error(`${request.method} ${request.url} failed. ${message}`);
}

export function getStringRecord(value: JsonValue | undefined): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const result: Record<string, string> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      result[key] = item;
    }
  }
  return result;
}

export function createJobError(
  code: string,
  message: string,
  details?: Record<string, unknown>,
): ImageGenerationJobError {
  return {
    code,
    message,
    retryable: false,
    details,
  };
}
