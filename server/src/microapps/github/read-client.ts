import {
  githubConnectionRepository,
  type GitHubConnectionRecord,
} from "@/db/repositories/github-connection.repository.js";
import { badRequest, notFound } from "@/utils/route-errors.js";

const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_API_ROOT = "https://api.github.com";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";
const MAX_PAGES = 20;
const PAGE_SIZE = 100;

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type SaveConnection = (
  input: Partial<Omit<GitHubConnectionRecord, "id">>,
) => GitHubConnectionRecord;

export type GitHubReadClientDependencies = {
  fetchImpl: FetchLike;
  getConnection: () => GitHubConnectionRecord | null;
  saveConnection: SaveConnection;
};

export type GitHubAuthorizedRepository = {
  id: number;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  installationId: number;
  permissions: Record<string, boolean>;
};

export type GitHubAuthorizedRepositoryContext = {
  connection: GitHubConnectionRecord;
  repository: GitHubAuthorizedRepository;
};

type GitHubErrorBody = {
  message?: string;
  error?: string;
  error_description?: string;
};

type GitHubTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  error?: string;
  error_description?: string;
};

type GitHubInstallation = {
  id: number;
};

type GitHubInstallationListResponse = {
  installations?: GitHubInstallation[];
};

type GitHubInstallationRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  permissions?: Record<string, boolean>;
};

type GitHubInstallationRepositoriesResponse = {
  repositories?: GitHubInstallationRepository[];
};

const defaultDependencies: GitHubReadClientDependencies = {
  fetchImpl: globalThis.fetch.bind(globalThis),
  getConnection: () => githubConnectionRepository.get(),
  saveConnection: (input) => githubConnectionRepository.upsert(input),
};

const parseErrorMessage = async (response: Response, fallback: string) => {
  try {
    const body = (await response.json()) as GitHubErrorBody;
    return body.error_description || body.message || body.error || fallback;
  } catch {
    return fallback;
  }
};

const expiresAt = (seconds?: number) =>
  typeof seconds === "number" && Number.isFinite(seconds)
    ? new Date(Date.now() + seconds * 1000).toISOString()
    : null;

const isExpiring = (value: string | null, marginMs = 60_000) => {
  if (!value) return false;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) && timestamp <= Date.now() + marginMs;
};

export const normalizeGitHubRepositoryName = (value: unknown) => {
  const repository = typeof value === "string" ? value.trim() : "";
  const segments = repository.split("/");
  if (
    segments.length !== 2 ||
    segments.some((segment) => !segment || /\s/u.test(segment))
  ) {
    throw badRequest("repository must use the owner/repository format");
  }
  return `${segments[0]}/${segments[1]}`;
};

export const encodeGitHubRepositoryPath = (repository: string) =>
  repository
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

export class GitHubReadClient {
  private readonly dependencies: GitHubReadClientDependencies;

  constructor(
    dependencies: Partial<GitHubReadClientDependencies> = {},
  ) {
    this.dependencies = {
      ...defaultDependencies,
      ...dependencies,
    };
  }

  private async refreshAccessToken(
    connection: GitHubConnectionRecord,
    signal?: AbortSignal,
  ) {
    if (!connection.refreshToken) {
      throw badRequest("GitHub authorization expired; reconnect GitHub");
    }

    const response = await this.dependencies.fetchImpl(
      GITHUB_ACCESS_TOKEN_URL,
      {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          client_id: connection.clientId,
          grant_type: "refresh_token",
          refresh_token: connection.refreshToken,
        }),
        signal,
      },
    );

    const payload = (await response.json()) as GitHubTokenResponse;
    if (!response.ok || payload.error || !payload.access_token) {
      throw badRequest(
        payload.error_description ||
          payload.error ||
          "GitHub token refresh failed; reconnect GitHub",
      );
    }

    return this.dependencies.saveConnection({
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token || connection.refreshToken,
      tokenExpiresAt: expiresAt(payload.expires_in),
      refreshTokenExpiresAt: expiresAt(payload.refresh_token_expires_in),
      status: "connected",
      lastErrorCode: null,
      lastErrorMessage: null,
    });
  }

  async getActiveConnection(signal?: AbortSignal) {
    let connection = this.dependencies.getConnection();
    if (!connection?.enabled) {
      throw badRequest("GitHub is not enabled");
    }
    if (!connection.accessToken) {
      throw badRequest("GitHub is not connected");
    }
    if (isExpiring(connection.tokenExpiresAt)) {
      connection = await this.refreshAccessToken(connection, signal);
    }
    return connection;
  }

  async requestJson<T>(
    path: string,
    token: string,
    input: {
      signal?: AbortSignal;
      accept?: string;
      allowNotFound?: boolean;
    } = {},
  ): Promise<T | null> {
    const url = /^https?:\/\//iu.test(path)
      ? path
      : `${GITHUB_API_ROOT}${path.startsWith("/") ? path : `/${path}`}`;
    const response = await this.dependencies.fetchImpl(url, {
      headers: {
        Accept: input.accept || "application/vnd.github+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "UIChat-Mira",
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
      },
      signal: input.signal,
    });

    if (response.status === 404 && input.allowNotFound) {
      return null;
    }
    if (!response.ok) {
      const fallback = `GitHub request failed (${response.status})`;
      const message = await parseErrorMessage(response, fallback);
      if (response.status === 404) {
        throw notFound(message);
      }
      if (response.status === 401) {
        throw badRequest("GitHub authorization is invalid; reconnect GitHub");
      }
      if (response.status === 403) {
        throw badRequest(`GitHub denied this read operation: ${message}`);
      }
      throw badRequest(message);
    }

    return (await response.json()) as T;
  }

  async resolveAuthorizedRepository(
    repositoryName: string,
    signal?: AbortSignal,
  ): Promise<GitHubAuthorizedRepositoryContext> {
    const repository = normalizeGitHubRepositoryName(repositoryName);
    const expected = repository.toLowerCase();
    const connection = await this.getActiveConnection(signal);

    for (let page = 1; page <= MAX_PAGES; page += 1) {
      const result = await this.requestJson<GitHubInstallationListResponse>(
        `/user/installations?per_page=${PAGE_SIZE}&page=${page}`,
        connection.accessToken,
        { signal },
      );
      const installations = result?.installations ?? [];

      for (const installation of installations) {
        for (let repositoryPage = 1; repositoryPage <= MAX_PAGES; repositoryPage += 1) {
          const repositoriesResult =
            await this.requestJson<GitHubInstallationRepositoriesResponse>(
              `/user/installations/${installation.id}/repositories?per_page=${PAGE_SIZE}&page=${repositoryPage}`,
              connection.accessToken,
              { signal },
            );
          const repositories = repositoriesResult?.repositories ?? [];
          const matched = repositories.find(
            (item) => item.full_name.toLowerCase() === expected,
          );
          if (matched) {
            return {
              connection,
              repository: {
                id: matched.id,
                name: matched.name,
                fullName: matched.full_name,
                private: matched.private,
                htmlUrl: matched.html_url,
                defaultBranch: matched.default_branch,
                installationId: installation.id,
                permissions: matched.permissions ?? {},
              },
            };
          }
          if (repositories.length < PAGE_SIZE) break;
        }
      }

      if (installations.length < PAGE_SIZE) break;
    }

    throw badRequest(
      `Repository ${repository} is not authorized for Mira. Add it from the GitHub micro-app first.`,
    );
  }
}

export const createGitHubReadClient = (
  dependencies: Partial<GitHubReadClientDependencies> = {},
) => new GitHubReadClient(dependencies);
