import type { GitHubReadClientDependencies } from "@/microapps/github/read-client.js";
import { createGitHubDomainRuntime } from "./github-domain.shared.js";
import { createRepositoryTool } from "./github-repository.tool.js";
import { createExtendedRepositoryTool } from "./github-repository-extended.tool.js";
import { createIssueTool } from "./github-issue.tool.js";
import { createPullRequestTool } from "./github-pull-request.tool.js";
import { createActionsTool } from "./github-actions.tool.js";

export const createGitHubDomainTools = (
  dependencies: Partial<GitHubReadClientDependencies> = {},
) => {
  const { client, api, baseTools } = createGitHubDomainRuntime(dependencies);
  return {
    githubRepositoryTool: createRepositoryTool(
      client,
      api,
      baseTools.githubRepoReadTool,
    ),
    githubIssueTool: createIssueTool(
      client,
      api,
      baseTools.githubIssueReadTool,
    ),
    githubPullRequestTool: createPullRequestTool(
      client,
      api,
      baseTools.githubPrReadTool,
    ),
    githubActionsTool: createActionsTool(
      client,
      api,
      baseTools.githubActionsStatusTool,
    ),
  };
};

const defaultRuntime = createGitHubDomainRuntime();

export const githubRepositoryTool = createExtendedRepositoryTool(
  defaultRuntime.client,
  defaultRuntime.api,
  defaultRuntime.baseTools.githubRepoReadTool,
);
export const githubIssueTool = createIssueTool(
  defaultRuntime.client,
  defaultRuntime.api,
  defaultRuntime.baseTools.githubIssueReadTool,
);
export const githubPullRequestTool = createPullRequestTool(
  defaultRuntime.client,
  defaultRuntime.api,
  defaultRuntime.baseTools.githubPrReadTool,
);
export const githubActionsTool = createActionsTool(
  defaultRuntime.client,
  defaultRuntime.api,
  defaultRuntime.baseTools.githubActionsStatusTool,
);
