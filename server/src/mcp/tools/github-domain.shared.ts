export * from "./github-domain.api.js";
export * from "./github-domain.model.js";
export * from "./github-domain.schemas.js";

import { createGitHubReadClient, type GitHubReadClientDependencies } from "@/microapps/github/read-client.js";
import { createGitHubReadTools } from "./github-read.tool.js";
import { createGitHubApi } from "./github-domain.api.js";

export const createGitHubDomainRuntime = (
  dependencies: Partial<GitHubReadClientDependencies> = {},
) => ({
  client: createGitHubReadClient(dependencies),
  api: createGitHubApi(
    dependencies.fetchImpl ?? globalThis.fetch.bind(globalThis),
  ),
  baseTools: createGitHubReadTools(dependencies),
});

export type {
  GitHubAuthorizedRepositoryContext,
  GitHubReadClient,
  GitHubReadClientDependencies,
} from "@/microapps/github/read-client.js";
export {
  encodeGitHubRepositoryPath,
  normalizeGitHubRepositoryName,
} from "@/microapps/github/read-client.js";
export { mcpBadRequest, mcpNotFound } from "../core/errors.js";
