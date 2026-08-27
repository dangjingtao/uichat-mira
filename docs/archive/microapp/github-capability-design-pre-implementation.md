# GitHub 能力包设计

Status: Planned
Owner: integrations / harness
Last verified: 2026-07-26
Layer: raw-source
Module: MicroAPP
Feature: GitHubCapabilityPack
Doc Type: current-contract
Canonical: true
Related:
  - README.md
  - ../harness/agentgraph-harness-protocol.md
  - ../tooling-runtime/tools-protocol.md

## 单点真相范围

这份文档定义 Mira 的 GitHub 能力包最终形态。

它只回答四件事：

- GitHub 微应用和 GitHub 工具分别负责什么
- Planner / Harness 最多看到多少个 GitHub 工具
- 每个工具允许哪些 operation，以及参数怎样表达
- 读取、写入和高风险操作怎样进入权限与审批链路

它不重新设计：

- GitHub Device Flow
- GitHub App installation 授权协议
- Agent Graph
- Planner 主合同
- MCP 协议

## 结论

GitHub 能力包最多只暴露四个领域工具：

```text
github_repository
github_issue
github_pull_request
github_actions
```

不继续扩展成十几个 GitHub 原子工具，也不做一个无边界的 `github(action=...)` 万能工具。

四个工具分别承担一个稳定领域。每个工具内部使用有限的 `operation` 枚举，并通过 `oneOf` 或等价的判别联合为不同 operation 提供独立参数结构。

因此：

- 工具数量稳定
- 参数仍然明确
- Planner 不需要理解几十个 GitHub API 名称
- Harness 可以按 operation 精确判断权限、审批和副作用
- 底层可在 GitHub REST API、GraphQL 或 MCP Adapter 之间替换，不影响上层合同

## 系统边界

```text
GitHub 微应用
  └─ 登录、Device Flow、installation、仓库授权范围、连接验证、断开

GitHub Auth Context
  └─ 当前用户令牌、登录身份、installation、已授权仓库

GitHub 能力包
  ├─ github_repository
  ├─ github_issue
  ├─ github_pull_request
  └─ github_actions

Harness
  └─ Schema 校验、仓库边界、审批、Evidence、Trace、结果归一化

Planner
  └─ 只接收当前任务需要的 GitHub 工具和 operation 说明
```

GitHub 微应用仍然只是授权与仓库范围入口，不承载 Issue、PR、Actions 等业务操作界面，也不直接等同于一个工具。

## 共同参数合同

四个工具共享以下基础参数语义：

| 参数 | 类型 | 说明 |
| --- | --- | --- |
| `operation` | enum | 当前工具内的有限操作类型 |
| `repository` | string | `owner/repository`，除少数无需仓库的操作外必填 |
| `installationId` | number，可选 | 通常由服务端解析，不要求模型主动填写 |

共同约束：

1. `repository` 必须先通过 GitHub installation 的真实授权仓库列表校验。
2. 不能因为仓库是 public 就绕过 installation 边界。
3. 用户令牌、refresh token、installation token 不进入模型参数，也不进入 Evidence 明文。
4. 每个 operation 使用独立 Schema；不允许把其他 operation 的字段静默带入。
5. 返回值必须归一化并有界，原始 GitHub 响应只进入受控调试信息。

## 工具一：`github_repository`

负责仓库、分支、提交和文件层操作。

### operations

```text
get
list_branches
list_commits
read_file
create_branch
write_file
delete_file
compare_commits
```

### 参数形态

#### `get`

```json
{
  "operation": "get",
  "repository": "owner/repository",
  "includeReadme": true,
  "includeLanguages": true
}
```

#### `list_branches`

```json
{
  "operation": "list_branches",
  "repository": "owner/repository",
  "limit": 20,
  "page": 1
}
```

#### `list_commits`

```json
{
  "operation": "list_commits",
  "repository": "owner/repository",
  "ref": "main",
  "path": "server/src",
  "author": "optional-login",
  "since": "2026-07-01T00:00:00Z",
  "until": "2026-07-26T00:00:00Z",
  "limit": 20,
  "page": 1
}
```

#### `read_file`

```json
{
  "operation": "read_file",
  "repository": "owner/repository",
  "path": "docs/README.md",
  "ref": "dev"
}
```

#### `create_branch`

```json
{
  "operation": "create_branch",
  "repository": "owner/repository",
  "branch": "feature/example",
  "fromRef": "dev"
}
```

#### `write_file`

```json
{
  "operation": "write_file",
  "repository": "owner/repository",
  "branch": "feature/example",
  "path": "docs/example.md",
  "content": "# Example",
  "commitMessage": "docs: add example",
  "expectedSha": null
}
```

`expectedSha` 用于更新现有文件时做乐观并发保护；创建新文件时为 `null` 或省略。

#### `delete_file`

```json
{
  "operation": "delete_file",
  "repository": "owner/repository",
  "branch": "feature/example",
  "path": "docs/example.md",
  "expectedSha": "current-blob-sha",
  "commitMessage": "docs: remove example"
}
```

#### `compare_commits`

```json
{
  "operation": "compare_commits",
  "repository": "owner/repository",
  "base": "dev",
  "head": "feature/example"
}
```

## 工具二：`github_issue`

负责 Issue 的查询、创建、修改、评论与状态流转。

### operations

```text
list
get
search
create
update
comment
close
reopen
```

### 参数形态

#### `list` / `search`

```json
{
  "operation": "search",
  "repository": "owner/repository",
  "query": "GitHub integration",
  "state": "all",
  "labels": ["bug"],
  "assignee": "optional-login",
  "creator": "optional-login",
  "sort": "updated",
  "direction": "desc",
  "limit": 20,
  "page": 1
}
```

自由文本搜索只能作用于当前已校验仓库，不允许注入额外 `repo:` 等跨仓库限定符。

#### `get`

```json
{
  "operation": "get",
  "repository": "owner/repository",
  "number": 123,
  "includeComments": true,
  "commentLimit": 50
}
```

#### `create`

```json
{
  "operation": "create",
  "repository": "owner/repository",
  "title": "Issue title",
  "body": "Issue body",
  "labels": ["bug"],
  "assignees": ["login"]
}
```

#### `update`

```json
{
  "operation": "update",
  "repository": "owner/repository",
  "number": 123,
  "title": "Updated title",
  "body": "Updated body",
  "labels": ["bug", "priority-high"],
  "assignees": ["login"]
}
```

#### `comment`

```json
{
  "operation": "comment",
  "repository": "owner/repository",
  "number": 123,
  "body": "Comment body"
}
```

#### `close` / `reopen`

```json
{
  "operation": "close",
  "repository": "owner/repository",
  "number": 123,
  "reason": "completed"
}
```

## 工具三：`github_pull_request`

负责 Pull Request 的查询、创建、修改、评论、Review 和合并。

### operations

```text
list
get
create
update
comment
review
merge
```

### 参数形态

#### `list`

```json
{
  "operation": "list",
  "repository": "owner/repository",
  "state": "all",
  "base": "dev",
  "head": "owner:feature/example",
  "sort": "updated",
  "direction": "desc",
  "limit": 20,
  "page": 1
}
```

#### `get`

```json
{
  "operation": "get",
  "repository": "owner/repository",
  "number": 27,
  "includeFiles": true,
  "includeComments": true,
  "includeReviews": true,
  "detailLimit": 100
}
```

#### `create`

```json
{
  "operation": "create",
  "repository": "owner/repository",
  "title": "Feature title",
  "body": "Pull request body",
  "head": "feature/example",
  "base": "dev",
  "draft": true
}
```

#### `update`

```json
{
  "operation": "update",
  "repository": "owner/repository",
  "number": 27,
  "title": "Updated title",
  "body": "Updated body",
  "state": "open",
  "base": "dev"
}
```

#### `comment`

```json
{
  "operation": "comment",
  "repository": "owner/repository",
  "number": 27,
  "body": "Review discussion comment"
}
```

#### `review`

```json
{
  "operation": "review",
  "repository": "owner/repository",
  "number": 27,
  "event": "request_changes",
  "body": "Please address the blocking findings.",
  "comments": [
    {
      "path": "server/src/example.ts",
      "line": 42,
      "side": "RIGHT",
      "body": "Inline review comment"
    }
  ]
}
```

`event` 只允许：

```text
comment
approve
request_changes
```

#### `merge`

```json
{
  "operation": "merge",
  "repository": "owner/repository",
  "number": 27,
  "method": "squash",
  "commitTitle": "feat: merge example",
  "commitMessage": "Optional merge message",
  "expectedHeadSha": "current-head-sha"
}
```

`expectedHeadSha` 用于避免在 PR 已发生新提交后误合并旧审查结果。

## 工具四：`github_actions`

负责 workflow run 查询、日志读取、手动触发、重跑与取消。

### operations

```text
list_runs
get_run
get_logs
dispatch
rerun
cancel
```

### 参数形态

#### `list_runs`

```json
{
  "operation": "list_runs",
  "repository": "owner/repository",
  "workflow": "ci.yml",
  "branch": "dev",
  "event": "pull_request",
  "status": "completed",
  "actor": "optional-login",
  "limit": 20,
  "page": 1
}
```

#### `get_run`

```json
{
  "operation": "get_run",
  "repository": "owner/repository",
  "runId": 123456789,
  "includeJobs": true,
  "jobLimit": 100
}
```

#### `get_logs`

```json
{
  "operation": "get_logs",
  "repository": "owner/repository",
  "runId": 123456789,
  "jobId": 987654321,
  "maxBytes": 1048576
}
```

日志必须限制大小，并在结果中标记是否截断。

#### `dispatch`

```json
{
  "operation": "dispatch",
  "repository": "owner/repository",
  "workflow": "release.yml",
  "ref": "dev",
  "inputs": {
    "environment": "staging"
  }
}
```

#### `rerun`

```json
{
  "operation": "rerun",
  "repository": "owner/repository",
  "runId": 123456789,
  "failedJobsOnly": true
}
```

#### `cancel`

```json
{
  "operation": "cancel",
  "repository": "owner/repository",
  "runId": 123456789
}
```

## 权限与审批

当前 Harness capability 合同中，GitHub 读写都属于网络操作：

```text
sideEffect = network
networkAccess = true
```

审批按 operation 判断，而不是按整个工具粗暴判断。

### 默认无需审批

```text
github_repository: get / list_branches / list_commits / read_file / compare_commits
github_issue: list / get / search
github_pull_request: list / get
github_actions: list_runs / get_run / get_logs
```

这些 operation：

```text
requiresApproval = false
```

### 必须审批

```text
github_repository: create_branch / write_file / delete_file
github_issue: create / update / comment / close / reopen
github_pull_request: create / update / comment / review / merge
github_actions: dispatch / rerun / cancel
```

这些 operation：

```text
requiresApproval = true
```

审批信息必须展示：

- GitHub 账号
- 目标仓库
- operation
- 目标分支、Issue、PR、workflow run 或文件路径
- 将要提交的正文、评论、Review、commit message 或 workflow inputs 摘要

### 高风险确认

下面操作需要比普通远端写入更明确的确认语义：

```text
github_repository.delete_file
github_pull_request.merge
github_pull_request.review(event=request_changes)
github_actions.cancel
```

其中：

- 删除文件必须包含 `expectedSha`
- 合并 PR 必须包含 `expectedHeadSha`
- 取消 workflow 必须显示 run、branch、workflow 和当前状态
- Review 必须显示 event 与正文摘要

## Planner 与动态暴露

Planner 不应在每轮同时看到四个工具的全部 operation 说明。

推荐暴露方式：

- 任务涉及仓库、代码、分支、提交时，暴露 `github_repository`
- 任务涉及 Issue 时，暴露 `github_issue`
- 任务涉及 PR、Review、Merge 时，暴露 `github_pull_request`
- 任务涉及 CI、workflow、run、job、logs 时，暴露 `github_actions`

当一个任务跨多个领域时，可以同时暴露多个 GitHub 工具，但总工具数仍固定为四个，不新增临时原子工具。

Planner 只决定：

```text
tool + operation + args
```

仓库授权校验、审批、令牌注入、API 调用、Evidence 与错误归一化仍由 Harness 和 GitHub Adapter 负责。

## Evidence 与 Trace

每次调用至少记录：

- `toolId`
- `operation`
- `repository`
- installation 校验结果
- GitHub request 类型和耗时
- 结果数量或目标对象编号
- 是否发生分页、截断或重试
- 写操作审批结果
- 远端返回的稳定标识，例如 commit SHA、Issue number、PR number、runId

不得记录：

- access token
- refresh token
- authorization header
- 私钥或 secret
- 未裁剪的大体积日志和文件全文

## 当前实现与迁移

当前过渡实现已经存在四个只读工具：

```text
github_repo_read
github_issue_read
github_pr_read
github_actions_status
```

它们证明了以下底座：

- Device Flow 用户授权
- installation 仓库范围校验
- GitHub 网络代理出口
- Harness 注册、Artifact 与 Trace
- 仓库、Issue、PR、Actions 的只读调用

但它们不是最终工具合同。

迁移原则：

1. 不在现有四个 Read 旁边继续增加十几个写工具。
2. 将现有实现分别迁入四个领域工具的读取 operation。
3. 新增写入 operation 时复用同一 GitHub Auth Context 和 installation 校验。
4. 迁移完成后移除旧工具公开暴露；必要时可保留内部兼容别名，但 Planner 和工作台只显示四个领域工具。
5. 参数工作台根据 `operation` 展示对应字段，不把所有字段平铺在同一张表中。

## 验收标准

### 结构

- 工作台最多显示四个 GitHub 工具
- 每个工具的 `operation` 是有限枚举
- 每个 operation 有独立参数 Schema
- 旧四个 Read 不再作为最终公开工具并列存在

### 安全

- 所有 operation 都强制校验 installation 仓库范围
- 公开仓库不能绕过授权
- 写操作必须审批
- 删除、合并、取消等高风险操作带并发保护或强确认
- token 和 secret 不进入参数、Evidence 或日志

### 产品

用户只需要：

1. 在 GitHub 微应用连接账号
2. 在 GitHub 官方页面选择仓库
3. 在聊天或工具工作台调用 GitHub 能力

用户不需要配置 Client ID、App Slug、PAT、Client Secret 或 GitHub App 私钥。
