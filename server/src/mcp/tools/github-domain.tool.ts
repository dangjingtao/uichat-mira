import type { GitHubReadClientDependencies } from "@/microapps/github/read-client.js";
import { createGitHubDomainRuntime } from "./github-domain.shared.js";
import { createExtendedRepositoryTool } from "./github-repository-extended.tool.js";
import { createIssueTool } from "./github-issue.tool.js";
import { createPullRequestTool } from "./github-pull-request.tool.js";
import { createActionsTool } from "./github-actions.tool.js";

export const createGitHubDomainTools = (
  dependencies: Partial<GitHubReadClientDependencies> = {},
) => {
  const { client, api, baseTools } = createGitHubDomainRuntime(dependencies);
  return {
    githubRepositoryTool: createExtendedRepositoryTool(
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

const defaultTools = createGitHubDomainTools();

export const githubRepositoryTool = defaultTools.githubRepositoryTool;
export const githubIssueTool = defaultTools.githubIssueTool;
export const githubPullRequestTool = defaultTools.githubPullRequestTool;
export const githubActionsTool = defaultTools.githubActionsTool;
