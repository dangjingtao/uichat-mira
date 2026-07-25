import { isAppError } from "@/utils/errors.js";

const RETRYABLE_NETWORK_CODES = new Set([
  "UND_ERR_CONNECT_TIMEOUT",
  "UND_ERR_HEADERS_TIMEOUT",
  "UND_ERR_BODY_TIMEOUT",
  "ECONNRESET",
  "ETIMEDOUT",
  "EAI_AGAIN",
  "ENETUNREACH",
  "EHOSTUNREACH",
]);

const RETRYABLE_NETWORK_NAMES = new Set([
  "ConnectTimeoutError",
  "HeadersTimeoutError",
  "BodyTimeoutError",
  "SocketError",
]);

export const GITHUB_DEVICE_FLOW_MAX_RETRY_SECONDS = 30;

export const nextGitHubDeviceFlowRetrySeconds = (currentSeconds: number) => {
  const normalized = Number.isFinite(currentSeconds)
    ? Math.max(5, Math.trunc(currentSeconds))
    : 5;
  return Math.min(GITHUB_DEVICE_FLOW_MAX_RETRY_SECONDS, normalized + 5);
};

export const isRetryableGitHubNetworkError = (error: unknown) => {
  if (isAppError(error)) return false;

  let current: unknown = error;
  for (let depth = 0; depth < 6; depth += 1) {
    if (!current || typeof current !== "object") return false;

    const candidate = current as {
      name?: unknown;
      message?: unknown;
      code?: unknown;
      cause?: unknown;
    };
    const name = typeof candidate.name === "string" ? candidate.name : "";
    const message =
      typeof candidate.message === "string" ? candidate.message : "";
    const code = typeof candidate.code === "string" ? candidate.code : "";

    if (name === "TypeError" && /fetch failed/iu.test(message)) return true;
    if (RETRYABLE_NETWORK_NAMES.has(name)) return true;
    if (RETRYABLE_NETWORK_CODES.has(code)) return true;

    current = candidate.cause;
  }

  return false;
};
