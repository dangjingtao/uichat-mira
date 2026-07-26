import { mcpBadRequest, mcpNotFound } from "../core/errors.js";
import type { GitHubReadClientDependencies } from "@/microapps/github/read-client.js";

export const GITHUB_API_ROOT = "https://api.github.com";
export const GITHUB_API_VERSION = "2022-11-28";
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;
export const MAX_TEXT_CHARS = 100_000;
export const MAX_FILE_CHARS = 500_000;
export const MAX_COMPARE_ITEMS = 100;

export const GITHUB_WORKBENCH = {
  groupId: "github",
  groupLabel: "GitHub",
  groupDescription:
    "在 GitHub 官方 installation 授权范围内管理仓库、Issue、Pull Request 与 Actions。读取操作直接执行，远程写入操作按精确参数审批。",
  groupOrder: 50,
  icon: "github",
} as const;

export const repositoryProperty = {
  type: "string",
  minLength: 3,
  description:
    "目标仓库，必须使用 owner/repository 格式，并且已在 GitHub 微应用中授权给 Mira。",
} as const;

export const positiveInteger = (description: string) => ({
  type: "integer",
  minimum: 1,
  description,
});

export const operationVariant = (
  operation: string,
  properties: Record<string, unknown>,
  required: string[] = [],
) => ({
  type: "object",
  additionalProperties: false,
  required: ["operation", "repository", ...required],
  properties: {
    operation: {
      type: "string",
      enum: [operation],
    },
    repository: repositoryProperty,
    ...properties,
  },
});

export type FetchLike = GitHubReadClientDependencies["fetchImpl"];

export type GitHubApiRequest = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  accept?: string;
  allowNotFound?: boolean;
};

export const parseGitHubError = async (response: Response, fallback: string) => {
  try {
    const payload = (await response.json()) as {
      message?: string;
      error?: string;
      error_description?: string;
      errors?: unknown;
    };
    const detail =
      payload.error_description || payload.message || payload.error || fallback;
    return payload.errors ? `${detail}: ${JSON.stringify(payload.errors)}` : detail;
  } catch {
    return fallback;
  }
};

export const createGitHubApi = (fetchImpl: FetchLike) => {
  const request = async (
    path: string,
    token: string,
    input: GitHubApiRequest = {},
  ) => {
    const url = /^https?:\/\//iu.test(path)
      ? path
      : `${GITHUB_API_ROOT}${path.startsWith("/") ? path : `/${path}`}`;
    const response = await fetchImpl(url, {
      method: input.method ?? "GET",
      headers: {
        Accept: input.accept ?? "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        "User-Agent": "UIChat-Mira",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
      ...(input.body === undefined
        ? {}
        : { body: JSON.stringify(input.body) }),
      signal: input.signal,
    });

    if (response.status === 404 && input.allowNotFound) {
      return null;
    }
    if (!response.ok) {
      const message = await parseGitHubError(
        response,
        `GitHub request failed (${response.status})`,
      );
      if (response.status === 404) throw mcpNotFound(message);
      if (response.status === 401) {
        throw mcpBadRequest("GitHub authorization is invalid; reconnect GitHub");
      }
      if (response.status === 403) {
        throw mcpBadRequest(`GitHub denied this operation: ${message}`);
      }
      throw mcpBadRequest(message);
    }
    return response;
  };

  return {
    async json<T>(
      path: string,
      token: string,
      input: GitHubApiRequest = {},
    ): Promise<T | null> {
      const response = await request(path, token, input);
      if (!response || response.status === 204 || response.status === 205) {
        return null;
      }
      const text = await response.text();
      return text ? (JSON.parse(text) as T) : null;
    },

    async text(
      path: string,
      token: string,
      input: GitHubApiRequest = {},
    ): Promise<string | null> {
      const response = await request(path, token, input);
      return response ? response.text() : null;
    },
  };
};

export const normalizeString = (
  value: unknown,
  name: string,
  input: {
    required?: boolean;
    maxLength?: number;
    preserveWhitespace?: boolean;
    allowEmpty?: boolean;
  } = {},
) => {
  if (value === undefined || value === null) {
    if (input.required) throw mcpBadRequest(`${name} is required`);
    return undefined;
  }
  if (typeof value !== "string") {
    throw mcpBadRequest(`${name} must be a string`);
  }
  const checked = value.trim();
  if (input.required && !checked && !input.allowEmpty) {
    throw mcpBadRequest(`${name} is required`);
  }
  const maxLength = input.maxLength ?? 20_000;
  if (value.length > maxLength) {
    throw mcpBadRequest(`${name} is too long`);
  }
  if (!checked) {
    return input.allowEmpty ? (input.preserveWhitespace ? value : "") : undefined;
  }
  return input.preserveWhitespace ? value : checked;
};

export const normalizeInteger = (
  value: unknown,
  name: string,
  input: { required?: boolean; fallback?: number; min?: number; max?: number } = {},
) => {
  if (value === undefined) {
    if (input.required) throw mcpBadRequest(`${name} is required`);
    return input.fallback;
  }
  if (!Number.isInteger(value)) {
    throw mcpBadRequest(`${name} must be an integer`);
  }
  const result = value as number;
  if (result < (input.min ?? 1) || result > (input.max ?? Number.MAX_SAFE_INTEGER)) {
    throw mcpBadRequest(
      `${name} must be between ${input.min ?? 1} and ${input.max ?? Number.MAX_SAFE_INTEGER}`,
    );
  }
  return result;
};

export const normalizeBoolean = (value: unknown, name: string, fallback = false) => {
  if (value === undefined) return fallback;
  if (typeof value !== "boolean") {
    throw mcpBadRequest(`${name} must be a boolean`);
  }
  return value;
};

export const normalizeStringArray = (
  value: unknown,
  name: string,
  maxItems = 50,
) => {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw mcpBadRequest(`${name} must be an array of strings`);
  }
  if (value.length > maxItems) {
    throw mcpBadRequest(`${name} cannot contain more than ${maxItems} items`);
  }
  return value.map((item) => item.trim()).filter(Boolean);
};

export const normalizeObject = (value: unknown, name: string) => {
  if (value === undefined) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw mcpBadRequest(`${name} must be an object`);
  }
  return value as Record<string, unknown>;
};

export const normalizeOperation = <T extends string>(
  value: unknown,
  allowed: readonly T[],
): T => {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw mcpBadRequest(`operation must be one of ${allowed.join(", ")}`);
  }
  return value as T;
};

export const GITHUB_LOGIN_PATTERN = /^[a-z\d](?:[a-z\d-]{0,38})$/iu;

export const normalizeGitHubLogin = (value: unknown, name: string) => {
  const login = normalizeString(value, name, { maxLength: 39 });
  if (login !== undefined && !GITHUB_LOGIN_PATTERN.test(login)) {
    throw mcpBadRequest(`${name} must be a valid GitHub login`);
  }
  return login;
};

export const normalizeGitHubDate = (value: unknown, name: string) => {
  const date = normalizeString(value, name, { maxLength: 100 });
  if (date !== undefined && !Number.isFinite(Date.parse(date))) {
    throw mcpBadRequest(`${name} must be a valid date or ISO 8601 timestamp`);
  }
  return date;
};

export const sanitizeIssueSearchQuery = (value: unknown) => {
  const query = normalizeString(value, "query", { maxLength: 500 });
  if (!query) return undefined;
  const sanitized = query
    .replace(/[\\":()]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  return sanitized ? `${sanitized} in:title,body` : undefined;
};

export const normalizeRepositoryPath = (value: unknown, name = "path") => {
  const path = normalizeString(value, name, { required: true, maxLength: 4_000 })!;
  const normalized = path.replace(/^\/+/, "");
  if (
    !normalized ||
    normalized.split("/").some((segment) => !segment || segment === "." || segment === "..")
  ) {
    throw mcpBadRequest(`${name} must be a repository-relative file path`);
  }
  return normalized;
};

export const encodeRepositoryFilePath = (value: string) =>
  value
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export const truncate = (value: string, maxChars: number) =>
  value.length > maxChars
    ? `${value.slice(0, maxChars)}\n…[truncated]`
    : value;

export const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

export const withOperation = (operation: string, result: unknown) =>
  isRecord(result) ? { operation, ...result } : { operation, result };
