import crypto from "node:crypto";
import type { FastifyPluginAsync } from "fastify";
import {
  githubConnectionRepository,
  type GitHubConnectionRecord,
} from "@/db/repositories/github-connection.repository.js";
import { badRequest, routeHandler } from "@/utils/route-errors.js";
import { success } from "@/utils/index.js";
import {
  isRetryableGitHubNetworkError,
  nextGitHubDeviceFlowRetrySeconds,
} from "./github-device-flow-retry.js";

const GITHUB_API_VERSION = "2022-11-28";
const GITHUB_API_ROOT = "https://api.github.com";
const GITHUB_DEVICE_CODE_URL = "https://github.com/login/device/code";
const GITHUB_ACCESS_TOKEN_URL = "https://github.com/login/oauth/access_token";

type DeviceFlowRecord = {
  id: string;
  clientId: string;
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  expiresAt: number;
  intervalSeconds: number;
  accessToken?: string;
  refreshToken?: string;
  tokenExpiresAt?: string | null;
  refreshTokenExpiresAt?: string | null;
};

type DeviceCodeResponse = {
  device_code?: string;
  user_code?: string;
  verification_uri?: string;
  expires_in?: number;
  interval?: number;
  error?: string;
  error_description?: string;
};

type DeviceTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_token_expires_in?: number;
  token_type?: string;
  error?: string;
  error_description?: string;
  interval?: number;
};

type GitHubUser = {
  id: number;
  login: string;
  avatar_url: string | null;
};

type GitHubInstallation = {
  id: number;
  account: {
    id: number;
    login?: string;
    slug?: string;
    avatar_url?: string | null;
    type?: string;
  } | null;
  repository_selection: "all" | "selected";
  permissions?: Record<string, string>;
  html_url?: string;
};

type GitHubRepository = {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  default_branch: string;
  permissions?: {
    admin?: boolean;
    maintain?: boolean;
    push?: boolean;
    triage?: boolean;
    pull?: boolean;
  };
};

const deviceFlows = new Map<string, DeviceFlowRecord>();

const retryDeviceFlowAfterNetworkError = (flow: DeviceFlowRecord) => {
  flow.intervalSeconds = nextGitHubDeviceFlowRetrySeconds(flow.intervalSeconds);
  return success({
    status: "pending" as const,
    retryable: true,
    intervalSeconds: flow.intervalSeconds,
    errorCode: "github_network_unavailable",
    errorMessage: "GitHub 网络暂时不可用，Mira 将继续确认授权",
  });
};

const githubHeaders = (token?: string) => ({
  Accept: "application/vnd.github+json",
  "X-GitHub-Api-Version": GITHUB_API_VERSION,
  ...(token ? { Authorization: `Bearer ${token}` } : {}),
});

const parseGitHubError = async (response: Response, fallback: string) => {
  try {
    const body = (await response.json()) as {
      message?: string;
      error_description?: string;
    };
    return body.error_description || body.message || fallback;
  } catch {
    return fallback;
  }
};

const postForm = async <T>(url: string, form: URLSearchParams): Promise<T> => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: form,
  });
  if (!response.ok) {
    throw badRequest(
      await parseGitHubError(response, `GitHub request failed (${response.status})`),
    );
  }
  return (await response.json()) as T;
};

const fetchGitHubJson = async <T>(url: string, token: string): Promise<T> => {
  const response = await fetch(url, { headers: githubHeaders(token) });
  if (!response.ok) {
    throw badRequest(
      await parseGitHubError(response, `GitHub API request failed (${response.status})`),
    );
  }
  return (await response.json()) as T;
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

const refreshAccessToken = async (connection: GitHubConnectionRecord) => {
  if (!connection.refreshToken) {
    throw badRequest("GitHub 授权已过期，请重新连接");
  }
  const payload = await postForm<DeviceTokenResponse>(
    GITHUB_ACCESS_TOKEN_URL,
    new URLSearchParams({
      client_id: connection.clientId,
      grant_type: "refresh_token",
      refresh_token: connection.refreshToken,
    }),
  );
  if (!payload.access_token || payload.error) {
    throw badRequest(
      payload.error_description || payload.error || "GitHub Token 刷新失败",
    );
  }
  return githubConnectionRepository.upsert({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || connection.refreshToken,
    tokenExpiresAt: expiresAt(payload.expires_in),
    refreshTokenExpiresAt: expiresAt(payload.refresh_token_expires_in),
    status: "connected",
    lastErrorCode: null,
    lastErrorMessage: null,
  });
};

const getActiveConnection = async () => {
  let connection = githubConnectionRepository.get();
  if (!connection?.clientId) {
    throw badRequest("请先配置 GitHub App Client ID");
  }
  if (!connection.enabled) {
    throw badRequest("GitHub 微应用已停用");
  }
  if (!connection.accessToken) {
    throw badRequest("请先连接 GitHub");
  }
  if (isExpiring(connection.tokenExpiresAt)) {
    connection = await refreshAccessToken(connection);
  }
  return connection;
};

const readGitHubUser = (token: string) =>
  fetchGitHubJson<GitHubUser>(`${GITHUB_API_ROOT}/user`, token);

const publicConnection = (connection: GitHubConnectionRecord | null) => {
  const value =
    connection ??
    githubConnectionRepository.upsert({
      clientId: process.env.UI_CHAT_GITHUB_APP_CLIENT_ID ?? "",
      appSlug: process.env.UI_CHAT_GITHUB_APP_SLUG ?? "",
    });
  return {
    connection: {
      id: value.id,
      clientId: value.clientId,
      appSlug: value.appSlug,
      enabled: value.enabled,
      status: value.status,
      hasToken: Boolean(value.accessToken),
      userId: value.userId,
      login: value.login,
      avatarUrl: value.avatarUrl,
      tokenExpiresAt: value.tokenExpiresAt,
      refreshTokenExpiresAt: value.refreshTokenExpiresAt,
      lastValidatedAt: value.lastValidatedAt,
      lastErrorCode: value.lastErrorCode,
      lastErrorMessage: value.lastErrorMessage,
    },
    installUrl: value.appSlug
      ? `https://github.com/apps/${encodeURIComponent(value.appSlug)}/installations/new`
      : null,
  };
};

const listInstallations = async (token: string) => {
  const installations: GitHubInstallation[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const result = await fetchGitHubJson<{
      installations?: GitHubInstallation[];
    }>(`${GITHUB_API_ROOT}/user/installations?per_page=100&page=${page}`, token);
    const items = result.installations ?? [];
    installations.push(...items);
    if (items.length < 100) break;
  }
  return installations;
};

const listInstallationRepositories = async (
  token: string,
  installationId: number,
) => {
  const repositories: GitHubRepository[] = [];
  for (let page = 1; page <= 20; page += 1) {
    const result = await fetchGitHubJson<{
      repositories?: GitHubRepository[];
    }>(
      `${GITHUB_API_ROOT}/user/installations/${installationId}/repositories?per_page=100&page=${page}`,
      token,
    );
    const items = result.repositories ?? [];
    repositories.push(...items);
    if (items.length < 100) break;
  }
  return repositories;
};

const githubRoute: FastifyPluginAsync = async (app) => {
  app.get(
    "/microapps/github",
    routeHandler("Failed to load GitHub connection", async () =>
      success(publicConnection(githubConnectionRepository.get())),
    ),
  );

  app.put<{
    Body: { clientId?: string; appSlug?: string; enabled?: boolean };
  }>(
    "/microapps/github",
    routeHandler("Failed to save GitHub settings", async (request) => {
      const body = request.body as {
        clientId?: string;
        appSlug?: string;
        enabled?: boolean;
      };
      const clientId = body.clientId?.trim() ?? "";
      const appSlug = body.appSlug?.trim() ?? "";
      if (!clientId) throw badRequest("GitHub App Client ID 不能为空");
      if (!appSlug) throw badRequest("GitHub App Slug 不能为空");

      const current = githubConnectionRepository.get();
      const clientChanged = Boolean(
        current?.clientId && current.clientId !== clientId,
      );
      const saved = githubConnectionRepository.upsert({
        clientId,
        appSlug,
        enabled: body.enabled ?? true,
        ...(clientChanged
          ? {
              accessToken: "",
              refreshToken: "",
              tokenExpiresAt: null,
              refreshTokenExpiresAt: null,
              userId: null,
              login: null,
              avatarUrl: null,
              status: "unconfigured" as const,
              lastValidatedAt: null,
            }
          : {
              status:
                body.enabled === false
                  ? ("disabled" as const)
                  : current?.accessToken
                    ? ("connected" as const)
                    : ("unconfigured" as const),
            }),
        lastErrorCode: null,
        lastErrorMessage: null,
      });
      return success(publicConnection(saved));
    }),
  );

  app.post(
    "/microapps/github/device-flow",
    routeHandler("Failed to start GitHub device flow", async (request) => {
      const connection = githubConnectionRepository.get();
      if (!connection?.clientId) {
        throw badRequest("请先保存 GitHub App Client ID");
      }
      if (!connection.enabled) {
        throw badRequest("GitHub 微应用已停用");
      }

      let payload: DeviceCodeResponse;
      try {
        payload = await postForm<DeviceCodeResponse>(
          GITHUB_DEVICE_CODE_URL,
          new URLSearchParams({ client_id: connection.clientId }),
        );
      } catch (error) {
        if (isRetryableGitHubNetworkError(error)) {
          request.log.warn(
            { err: error },
            "GitHub device flow start temporarily could not reach GitHub",
          );
          throw badRequest("暂时无法连接 GitHub，请检查网络后重试");
        }
        throw error;
      }
      if (
        payload.error ||
        !payload.device_code ||
        !payload.user_code ||
        !payload.verification_uri
      ) {
        throw badRequest(
          payload.error_description || payload.error || "无法启动 GitHub 设备授权",
        );
      }

      const flow: DeviceFlowRecord = {
        id: crypto.randomUUID(),
        clientId: connection.clientId,
        deviceCode: payload.device_code,
        userCode: payload.user_code,
        verificationUri: payload.verification_uri,
        expiresAt: Date.now() + (payload.expires_in ?? 900) * 1000,
        intervalSeconds: Math.max(payload.interval ?? 5, 5),
      };
      deviceFlows.set(flow.id, flow);
      githubConnectionRepository.upsert({
        status: "authorizing",
        lastErrorCode: null,
        lastErrorMessage: null,
      });

      return success({
        flowId: flow.id,
        userCode: flow.userCode,
        verificationUri: flow.verificationUri,
        expiresAt: new Date(flow.expiresAt).toISOString(),
        intervalSeconds: flow.intervalSeconds,
      });
    }),
  );

  app.post<{ Params: { flowId: string } }>(
    "/microapps/github/device-flow/:flowId/poll",
    routeHandler("Failed to poll GitHub device flow", async (request) => {
      const { flowId } = request.params as { flowId: string };
      const flow = deviceFlows.get(flowId);
      if (!flow) throw badRequest("GitHub 授权会话不存在或已失效");
      if (flow.expiresAt <= Date.now()) {
        deviceFlows.delete(flowId);
        githubConnectionRepository.upsert({
          status: "error",
          lastErrorCode: "expired_token",
          lastErrorMessage: "GitHub 授权码已过期，请重新连接",
        });
        return success({ status: "expired" as const });
      }

      if (!flow.accessToken) {
        let payload: DeviceTokenResponse;
        try {
          payload = await postForm<DeviceTokenResponse>(
            GITHUB_ACCESS_TOKEN_URL,
            new URLSearchParams({
              client_id: flow.clientId,
              device_code: flow.deviceCode,
              grant_type: "urn:ietf:params:oauth:grant-type:device_code",
            }),
          );
        } catch (error) {
          if (isRetryableGitHubNetworkError(error)) {
            request.log.warn(
              { err: error, flowId },
              "GitHub device flow token poll failed temporarily; retrying",
            );
            return retryDeviceFlowAfterNetworkError(flow);
          }
          throw error;
        }

        if (payload.error === "authorization_pending") {
          return success({
            status: "pending" as const,
            intervalSeconds: flow.intervalSeconds,
          });
        }
        if (payload.error === "slow_down") {
          flow.intervalSeconds = Math.max(
            payload.interval ?? flow.intervalSeconds + 5,
            flow.intervalSeconds + 5,
          );
          return success({
            status: "pending" as const,
            intervalSeconds: flow.intervalSeconds,
          });
        }
        if (payload.error) {
          deviceFlows.delete(flowId);
          githubConnectionRepository.upsert({
            status: "error",
            lastErrorCode: payload.error,
            lastErrorMessage:
              payload.error_description || "GitHub 设备授权失败",
          });
          return success({
            status:
              payload.error === "expired_token"
                ? ("expired" as const)
                : payload.error === "access_denied"
                  ? ("denied" as const)
                  : ("error" as const),
            errorCode: payload.error,
            errorMessage: payload.error_description ?? null,
          });
        }
        if (!payload.access_token) {
          throw badRequest("GitHub 未返回访问令牌");
        }

        flow.accessToken = payload.access_token;
        flow.refreshToken = payload.refresh_token ?? "";
        flow.tokenExpiresAt = expiresAt(payload.expires_in);
        flow.refreshTokenExpiresAt = expiresAt(payload.refresh_token_expires_in);
      }

      let user: GitHubUser;
      try {
        user = await readGitHubUser(flow.accessToken);
      } catch (error) {
        if (isRetryableGitHubNetworkError(error)) {
          request.log.warn(
            { err: error, flowId },
            "GitHub device flow user lookup failed temporarily; retrying",
          );
          return retryDeviceFlowAfterNetworkError(flow);
        }
        throw error;
      }

      const saved = githubConnectionRepository.upsert({
        accessToken: flow.accessToken,
        refreshToken: flow.refreshToken ?? "",
        tokenExpiresAt: flow.tokenExpiresAt ?? null,
        refreshTokenExpiresAt: flow.refreshTokenExpiresAt ?? null,
        userId: String(user.id),
        login: user.login,
        avatarUrl: user.avatar_url,
        status: "connected",
        lastValidatedAt: new Date().toISOString(),
        lastErrorCode: null,
        lastErrorMessage: null,
      });
      deviceFlows.delete(flowId);
      return success({
        status: "connected" as const,
        ...publicConnection(saved),
      });
    }),
  );

  app.post(
    "/microapps/github/validate",
    routeHandler("Failed to validate GitHub connection", async () => {
      const connection = await getActiveConnection();
      const user = await readGitHubUser(connection.accessToken);
      const saved = githubConnectionRepository.upsert({
        userId: String(user.id),
        login: user.login,
        avatarUrl: user.avatar_url,
        status: "connected",
        lastValidatedAt: new Date().toISOString(),
        lastErrorCode: null,
        lastErrorMessage: null,
      });
      return success(publicConnection(saved));
    }),
  );

  app.get(
    "/microapps/github/repositories",
    routeHandler("Failed to list GitHub repositories", async () => {
      const connection = await getActiveConnection();
      const installations = await listInstallations(connection.accessToken);
      const items = await Promise.all(
        installations.map(async (installation) => {
          const repositories = await listInstallationRepositories(
            connection.accessToken,
            installation.id,
          );
          return {
            id: String(installation.id),
            account: {
              id: String(installation.account?.id ?? ""),
              login:
                installation.account?.login ||
                installation.account?.slug ||
                "GitHub Account",
              avatarUrl: installation.account?.avatar_url ?? null,
              type: installation.account?.type ?? null,
            },
            repositorySelection: installation.repository_selection,
            permissions: installation.permissions ?? {},
            manageUrl:
              installation.html_url ||
              `https://github.com/settings/installations/${installation.id}`,
            repositories: repositories.map((repository) => ({
              id: String(repository.id),
              name: repository.name,
              fullName: repository.full_name,
              private: repository.private,
              htmlUrl: repository.html_url,
              defaultBranch: repository.default_branch,
              permissions: repository.permissions ?? {},
            })),
          };
        }),
      );
      return success({
        installations: items,
        repositoryCount: items.reduce(
          (count, installation) => count + installation.repositories.length,
          0,
        ),
      });
    }),
  );

  app.post(
    "/microapps/github/disconnect",
    routeHandler("Failed to disconnect GitHub", async () =>
      success(publicConnection(githubConnectionRepository.clearAuthorization())),
    ),
  );
};

export default githubRoute;
