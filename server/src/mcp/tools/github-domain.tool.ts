import type { GitHubReadClientDependencies } from "@/microapps/github/read-client.js";
import type { McpToolImplementation } from "../core/definitions.js";
import { createProviderVisibleInputSchema } from "../core/provider-visible-schema.js";
import { createGitHubDomainRuntime } from "./github-domain.shared.js";
import { createExtendedRepositoryTool } from "./github-repository-extended.tool.js";
import { createIssueTool } from "./github-issue.tool.js";
import { createPullRequestTool } from "./github-pull-request.tool.js";
import { createActionsTool } from "./github-actions.tool.js";

const withAgentIntentInputSchema = (
  tool: McpToolImplementation,
): McpToolImplementation => ({
  ...tool,
  definition: {
    ...tool.definition,
    inputSchemaByExposure: {
      ...tool.definition.inputSchemaByExposure,
      agent_intent: createProviderVisibleInputSchema(tool.definition.inputSchema),
    },
  },
});

export const createGitHubDomainTools = (
  dependencies: Partial<GitHubReadClientDependencies> = {},
) => {
  const { client, api, baseTools } = createGitHubDomainRuntime(dependencies);
  return {
    githubRepositoryTool: withAgentIntentInputSchema(
      createExtendedRepositoryTool(
        client,
        api,
        baseTools.githubRepoReadTool,
      ),
    ),
    githubIssueTool: withAgentIntentInputSchema(
      createIssueTool(
        client,
        api,
        baseTools.githubIssueReadTool,
      ),
    ),
    githubPullRequestTool: withAgentIntentInputSchema(
      createPullRequestTool(
        client,
        api,
        baseTools.githubPrReadTool,
      ),
    ),
    githubActionsTool: withAgentIntentInputSchema(
      createActionsTool(
        client,
        api,
        baseTools.githubActionsStatusTool,
      ),
    ),
  };
};

const defaultTools = createGitHubDomainTools();

export const githubRepositoryTool = defaultTools.githubRepositoryTool;
export const githubIssueTool = defaultTools.githubIssueTool;
export const githubPullRequestTool = defaultTools.githubPullRequestTool;
export const githubActionsTool = defaultTools.githubActionsTool;
