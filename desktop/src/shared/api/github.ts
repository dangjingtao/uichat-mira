import { ApiError, ErrorCodes, get, post, put } from "../lib/request";

export type GitHubConnectionStatus =
  | "unconfigured"
  | "authorizing"
  | "connected"
  | "error"
  | "disabled";

export type GitHubConnectionResponse = {
  connection: {
    id: string;
    clientId: string;
    appSlug: string;
    enabled: boolean;
    status: GitHubConnectionStatus;
    hasToken: boolean;
    userId: string | null;
    login: string | null;
    avatarUrl: string | null;
    tokenExpiresAt: string | null;
    refreshTokenExpiresAt: string | null;
    lastValidatedAt: string | null;
    lastErrorCode: string | null;
    lastErrorMessage: string | null;
  };
  installUrl: string | null;
};

export type GitHubDeviceFlow = {
  flowId: string;
  userCode: string;
  verificationUri: string;
  expiresAt: string;
  intervalSeconds: number;
};

export type GitHubDeviceFlowPoll = {
  status: "pending" | "connected" | "expired" | "denied" | "error";
  retryable?: boolean;
  intervalSeconds?: number;
  errorCode?: string;
  errorMessage?: string | null;
  connection?: GitHubConnectionResponse["connection"];
  installUrl?: string | null;
};

export type GitHubAuthorizedRepository = {
  id: string;
  name: string;
  fullName: string;
  private: boolean;
  htmlUrl: string;
  defaultBranch: string;
  permissions: Record<string, boolean>;
};

export type GitHubInstallation = {
  id: string;
  account: {
    id: string;
    login: string;
    avatarUrl: string | null;
    type: string | null;
  };
  repositorySelection: "all" | "selected";
  permissions: Record<string, string>;
  manageUrl: string;
  repositories: GitHubAuthorizedRepository[];
};

export type GitHubRepositoriesResponse = {
  installations: GitHubInstallation[];
  repositoryCount: number;
};

export function getGitHubConnection() {
  return get<GitHubConnectionResponse>("/microapps/github");
}

export function saveGitHubConnection(input: {
  clientId: string;
  appSlug: string;
  enabled: boolean;
}) {
  return put<GitHubConnectionResponse>("/microapps/github", input);
}

export function startGitHubDeviceFlow() {
  return post<GitHubDeviceFlow>("/microapps/github/device-flow", {});
}

export async function pollGitHubDeviceFlow(flowId: string) {
  try {
    return await post<GitHubDeviceFlowPoll>(
      `/microapps/github/device-flow/${encodeURIComponent(flowId)}/poll`,
      {},
    );
  } catch (error) {
    if (
      error instanceof ApiError &&
      error.code !== undefined &&
      error.code !== ErrorCodes.INTERNAL_ERROR
    ) {
      return {
        status: "error" as const,
        retryable: false,
        errorCode: String(error.code),
        errorMessage: error.message,
      };
    }
    throw error;
  }
}

export function validateGitHubConnection() {
  return post<GitHubConnectionResponse>("/microapps/github/validate", {});
}

export function getGitHubRepositories() {
  return get<GitHubRepositoriesResponse>("/microapps/github/repositories");
}

export function disconnectGitHub() {
  return post<GitHubConnectionResponse>("/microapps/github/disconnect", {});
}
