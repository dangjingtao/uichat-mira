import { describe, expect, it } from "vitest";
import { validateInvocationArgs } from "../core/schema.js";
import { githubRepositoryTool } from "./github-domain.tool.js";

const operationNames = () =>
  ((githubRepositoryTool.definition.inputSchema.oneOf ?? []) as Array<
    Record<string, unknown>
  >).map((variant) => {
    const properties = variant.properties as Record<
      string,
      Record<string, unknown>
    >;
    return (properties.operation.enum as string[])[0];
  });

describe("GitHub repository runtime exposure", () => {
  it("exposes 12 operations through the registered github_repository tool", () => {
    expect(operationNames()).toEqual([
      "get",
      "list_branches",
      "list_commits",
      "read_file",
      "create_branch",
      "write_file",
      "delete_file",
      "compare_commits",
      "create",
      "ensure_installation_access",
      "get_pages",
      "configure_pages",
    ]);
  });

  it.each(["docs.example.com", null])(
    "accepts nullable Pages custom domain value %s",
    (customDomain) => {
      expect(() =>
        validateInvocationArgs(
          {
            operation: "configure_pages",
            repository: "dangjingtao/uichat-mira",
            mode: "workflow",
            customDomain,
          },
          githubRepositoryTool.definition.inputSchema,
        ),
      ).not.toThrow();
    },
  );
});
