import { operationVariant, positiveInteger } from "./github-domain.api.js";

export const repositorySchema = {
  oneOf: [
    operationVariant(
      "get",
      {
        ref: { type: "string" },
        includeReadme: { type: "boolean", default: false },
        includeLanguages: { type: "boolean", default: false },
        includeBranches: { type: "boolean", default: false },
        branchLimit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        commitLimit: { type: "integer", minimum: 0, maximum: 20, default: 0 },
      },
    ),
    operationVariant("list_branches", {
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      page: { type: "integer", minimum: 1, default: 1 },
    }),
    operationVariant("list_commits", {
      ref: { type: "string" },
      author: { type: "string" },
      path: { type: "string" },
      since: { type: "string" },
      until: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      page: { type: "integer", minimum: 1, default: 1 },
    }),
    operationVariant(
      "read_file",
      {
        path: { type: "string" },
        ref: { type: "string" },
      },
      ["path"],
    ),
    operationVariant(
      "create_branch",
      {
        branch: { type: "string" },
        sourceRef: { type: "string" },
      },
      ["branch"],
    ),
    operationVariant(
      "write_file",
      {
        path: { type: "string" },
        content: { type: "string" },
        commitMessage: { type: "string" },
        branch: { type: "string" },
        expectedSha: { type: "string" },
        overwrite: { type: "boolean", default: false },
      },
      ["path", "content", "commitMessage", "branch"],
    ),
    operationVariant(
      "delete_file",
      {
        path: { type: "string" },
        commitMessage: { type: "string" },
        branch: { type: "string" },
        expectedSha: { type: "string" },
      },
      ["path", "commitMessage", "branch"],
    ),
    operationVariant(
      "compare_commits",
      {
        base: { type: "string" },
        head: { type: "string" },
        fileLimit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
        commitLimit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      },
      ["base", "head"],
    ),
  ],
} as const;

export const issueSchema = {
  oneOf: [
    operationVariant("list", {
      state: { type: "string", enum: ["open", "closed", "all"], default: "open" },
      labels: { type: "array", items: { type: "string" }, maxItems: 20 },
      assignee: { type: "string" },
      creator: { type: "string" },
      updatedSince: { type: "string" },
      sort: { type: "string", enum: ["created", "updated", "comments"], default: "updated" },
      direction: { type: "string", enum: ["asc", "desc"], default: "desc" },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      page: { type: "integer", minimum: 1, default: 1 },
    }),
    operationVariant(
      "search",
      {
        query: { type: "string" },
        state: { type: "string", enum: ["open", "closed", "all"], default: "open" },
        labels: { type: "array", items: { type: "string" }, maxItems: 20 },
        assignee: { type: "string" },
        creator: { type: "string" },
        updatedSince: { type: "string" },
        sort: { type: "string", enum: ["created", "updated", "comments"], default: "updated" },
        direction: { type: "string", enum: ["asc", "desc"], default: "desc" },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
        page: { type: "integer", minimum: 1, default: 1 },
      },
      ["query"],
    ),
    operationVariant(
      "get",
      {
        number: positiveInteger("Issue 编号。"),
        includeComments: { type: "boolean", default: false },
        commentLimit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      },
      ["number"],
    ),
    operationVariant(
      "create",
      {
        title: { type: "string" },
        body: { type: "string" },
        labels: { type: "array", items: { type: "string" }, maxItems: 50 },
        assignees: { type: "array", items: { type: "string" }, maxItems: 20 },
        milestone: { type: "integer", minimum: 1 },
      },
      ["title"],
    ),
    operationVariant(
      "update",
      {
        number: positiveInteger("Issue 编号。"),
        title: { type: "string" },
        body: { type: "string" },
        state: { type: "string", enum: ["open", "closed"] },
        stateReason: { type: "string", enum: ["completed", "not_planned", "reopened"] },
        labels: { type: "array", items: { type: "string" }, maxItems: 50 },
        assignees: { type: "array", items: { type: "string" }, maxItems: 20 },
        milestone: { type: "integer", minimum: 1 },
      },
      ["number"],
    ),
    operationVariant(
      "comment",
      {
        number: positiveInteger("Issue 编号。"),
        body: { type: "string" },
      },
      ["number", "body"],
    ),
    operationVariant(
      "close",
      {
        number: positiveInteger("Issue 编号。"),
        reason: { type: "string", enum: ["completed", "not_planned"], default: "completed" },
      },
      ["number"],
    ),
    operationVariant(
      "reopen",
      { number: positiveInteger("Issue 编号。") },
      ["number"],
    ),
  ],
} as const;

export const pullRequestSchema = {
  oneOf: [
    operationVariant("list", {
      state: { type: "string", enum: ["open", "closed", "all"], default: "open" },
      head: { type: "string" },
      base: { type: "string" },
      sort: { type: "string", enum: ["created", "updated", "popularity", "long-running"], default: "updated" },
      direction: { type: "string", enum: ["asc", "desc"], default: "desc" },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      page: { type: "integer", minimum: 1, default: 1 },
    }),
    operationVariant(
      "get",
      {
        number: positiveInteger("Pull Request 编号。"),
        includeFiles: { type: "boolean", default: false },
        includeComments: { type: "boolean", default: false },
        includeReviews: { type: "boolean", default: false },
        detailLimit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      },
      ["number"],
    ),
    operationVariant(
      "create",
      {
        title: { type: "string" },
        head: { type: "string" },
        base: { type: "string" },
        body: { type: "string" },
        draft: { type: "boolean", default: false },
        maintainerCanModify: { type: "boolean", default: true },
      },
      ["title", "head", "base"],
    ),
    operationVariant(
      "update",
      {
        number: positiveInteger("Pull Request 编号。"),
        title: { type: "string" },
        body: { type: "string" },
        state: { type: "string", enum: ["open", "closed"] },
        base: { type: "string" },
        maintainerCanModify: { type: "boolean" },
      },
      ["number"],
    ),
    operationVariant(
      "comment",
      {
        number: positiveInteger("Pull Request 编号。"),
        body: { type: "string" },
      },
      ["number", "body"],
    ),
    operationVariant(
      "review",
      {
        number: positiveInteger("Pull Request 编号。"),
        event: { type: "string", enum: ["comment", "approve", "request_changes"] },
        body: { type: "string" },
        comments: {
          type: "array",
          maxItems: 50,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["path", "body", "line", "side"],
            properties: {
              path: { type: "string" },
              body: { type: "string" },
              line: { type: "integer", minimum: 1 },
              side: { type: "string", enum: ["LEFT", "RIGHT"] },
              startLine: { type: "integer", minimum: 1 },
              startSide: { type: "string", enum: ["LEFT", "RIGHT"] },
            },
          },
        },
      },
      ["number", "event"],
    ),
    operationVariant(
      "merge",
      {
        number: positiveInteger("Pull Request 编号。"),
        mergeMethod: { type: "string", enum: ["merge", "squash", "rebase"], default: "merge" },
        commitTitle: { type: "string" },
        commitMessage: { type: "string" },
        expectedHeadSha: { type: "string" },
      },
      ["number"],
    ),
  ],
} as const;

export const actionsSchema = {
  oneOf: [
    operationVariant("list_runs", {
      workflow: { oneOf: [{ type: "string" }, { type: "integer" }] },
      branch: { type: "string" },
      event: { type: "string" },
      status: { type: "string" },
      actor: { type: "string" },
      limit: { type: "integer", minimum: 1, maximum: 100, default: 20 },
      page: { type: "integer", minimum: 1, default: 1 },
    }),
    operationVariant(
      "get_run",
      {
        runId: positiveInteger("Workflow run ID。"),
        includeJobs: { type: "boolean", default: true },
        jobLimit: { type: "integer", minimum: 1, maximum: 100, default: 50 },
      },
      ["runId"],
    ),
    operationVariant(
      "get_logs",
      {
        runId: positiveInteger("Workflow run ID。"),
        jobId: positiveInteger("可选 Job ID；省略时读取 run 下的多个 Job 日志。"),
        maxChars: { type: "integer", minimum: 1, maximum: 500000, default: 100000 },
      },
      ["runId"],
    ),
    operationVariant(
      "dispatch",
      {
        workflow: { oneOf: [{ type: "string" }, { type: "integer" }] },
        ref: { type: "string" },
        inputs: { type: "object", additionalProperties: true },
      },
      ["workflow", "ref"],
    ),
    operationVariant(
      "rerun",
      {
        runId: positiveInteger("Workflow run ID。"),
        failedJobsOnly: { type: "boolean", default: false },
      },
      ["runId"],
    ),
    operationVariant(
      "cancel",
      { runId: positiveInteger("Workflow run ID。") },
      ["runId"],
    ),
  ],
} as const;
