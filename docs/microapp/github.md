# GitHub 微应用与能力包

## 目标

GitHub 微应用负责两件事：

1. 使用 Mira 内置 GitHub App 的 Device Flow 连接当前用户，不要求用户填写 PAT、Client ID 或 App Slug，也不在桌面包中保存 Client Secret 或 GitHub App 私钥。
2. 读取 GitHub App installation 的真实仓库范围，按个人账号或组织展示 GitHub 已授权给 Mira 的项目。

仓库授权不由 Mira 自建白名单模拟。用户在 GitHub 原生安装页选择 `All repositories` 或 `Only select repositories`，Mira 只允许工具访问 installation 实际返回的仓库；仓库创建与 installation 授权检查是两个独立步骤。

## 系统边界

- 微应用页面只负责：连接、Device Flow、installation 仓库列表、添加仓库授权、验证连接和断开连接。
- GitHub App Client ID / App Slug 属于 Mira 应用配置，不进入用户侧配置面。
- 仓库、Issue、Pull Request 与 Actions 操作通过 Harness capability 暴露，不在微应用页面中重复实现。
- 不修改 Agent Graph、Planner 主合同、MCP 协议或现有审批指纹协议。

## GitHub 能力包

Harness 只注册四个领域工具，不继续扩成十几个原子工具：

```text
github_repository
github_issue
github_pull_request
github_actions
```

每个工具使用有限 `operation` 枚举，并通过以 `operation` 为判别字段的 `oneOf` 为不同 operation 声明独立参数。传给某个 operation 的无关字段会在执行前被拒绝。

Provider 若不支持复杂组合 schema，只能在 Provider 请求边界使用临时兼容投影。兼容投影不得替换 Tool definition 或 Harness 的严格 `oneOf` 校验。

### `github_repository`

| operation | 作用 |
| --- | --- |
| `get` | 读取仓库元数据，可选 README、语言、分支和最近提交 |
| `list_branches` | 分页读取分支 |
| `list_commits` | 按 ref、作者、路径和时间范围读取提交 |
| `read_file` | 按 path/ref 读取仓库文件 |
| `create_branch` | 从指定 ref 创建分支 |
| `write_file` | 通过 Contents API 创建或更新完整文件并产生提交 |
| `delete_file` | 使用当前 SHA 删除文件并产生提交 |
| `compare_commits` | 比较 base/head，返回提交与文件变更摘要 |
| `create` | 使用 owner/name/visibility 创建仓库并回读；不使用 repository 参数 |
| `ensure_installation_access` | 检查仓库是否已进入 Mira installation；未授权时返回用户动作 |
| `get_pages` | 读取 GitHub Pages 当前状态、来源、域名、HTTPS 与 URL |
| `configure_pages` | 配置 workflow 或 branch Pages，并回读最终状态 |

关键顺序：

```text
create
→ read-back repository
→ ensure_installation_access
→ create_branch / write_file
→ local verification
→ PR / Actions
→ user requested deployment 时才 get_pages / configure_pages
```

不得因为仓库创建成功就假设 installation 已授权，也不得因为 Pages 配置请求成功就声称网站已经上线。

### `github_issue`

| operation | 作用 |
| --- | --- |
| `list` | 按状态、标签、负责人、创建者和更新时间列出 Issue |
| `search` | 在当前授权仓库的标题和正文内搜索 Issue |
| `get` | 读取单个 Issue，可选评论 |
| `create` | 创建 Issue |
| `update` | 更新标题、正文、状态、标签、负责人和里程碑 |
| `comment` | 添加评论 |
| `close` | 以 completed 或 not_planned 原因关闭 |
| `reopen` | 重新打开 |

Issue operation 会拒绝 Pull Request 编号，避免把 GitHub 共用的 Issues API 误当成 Issue。

### `github_pull_request`

| operation | 作用 |
| --- | --- |
| `list` | 按状态、head、base、排序和分页列出 PR |
| `get` | 读取 PR，可选文件、会话评论、行级评论和 Reviews |
| `create` | 从 head 向 base 创建 PR，可选 Draft |
| `update` | 更新标题、正文、状态、base 和 maintainer_can_modify |
| `comment` | 添加 PR 会话评论 |
| `review` | 提交 comment、approve 或 request_changes Review，可带行级评论 |
| `merge` | 使用 merge、squash 或 rebase 合并，可校验 expectedHeadSha |

### `github_actions`

| operation | 作用 |
| --- | --- |
| `list_runs` | 按 workflow、branch、event、status、actor 列出运行 |
| `get_run` | 读取单次运行，可选 Jobs 与 Steps |
| `get_logs` | 按 run 或 job 读取纯文本 Job 日志，并做长度限制 |
| `dispatch` | 触发启用了 workflow_dispatch 的工作流 |
| `rerun` | 重跑整个 run 或仅重跑失败 Jobs |
| `cancel` | 取消运行中的 workflow run |

## Schema 与错误合同

Canonical runtime schema 保持严格：

```text
operation-specific oneOf
→ 按 operation 选择唯一 variant
→ 校验该 variant 的 required / type / additionalProperties
→ Harness 执行前再次校验
```

Provider 兼容投影必须：

- 保留全部 operation 枚举；
- 保留各 variant 字段的并集；
- 只把所有 variant 共同要求的字段设为全局 required；
- 不写回 registry，不降低 runtime validation。

运行时错误应指出具体字段，例如：

```text
args.content is required
args.branch is not allowed
args.operation must be one of: ...
```

不能把所有错误都压成 `args must match exactly one schema variant`。

## 授权与审批

四个工具每次执行都会重新读取当前用户的 GitHub App installation 仓库范围，并验证目标 `owner/repository`。公开仓库也不能绕过 installation 授权。

默认无需审批的仓库 operation：

```text
get
list_branches
list_commits
read_file
compare_commits
ensure_installation_access
get_pages
```

需要精确输入指纹审批的仓库 operation：

```text
create
create_branch
write_file
delete_file
configure_pages
```

其他三个领域工具的读取 operation 直接执行；远程写入 operation 使用当前 Harness 的精确输入指纹审批：

```text
scope = github.remote_write
```

以下高风险 operation 使用更明确的审批范围：

```text
github_repository.delete_file
github_pull_request.merge
github_actions.cancel

scope = github.high_risk
```

审批只对当前 `toolId + inputHash` 生效；仓库、visibility、分支、正文、文件内容、SHA、Pages 配置或其他参数变化后必须重新审批。未获审批时不会发送 GitHub 写请求。

## GitHub App 权限

Mira 当前内置 GitHub App：

```text
Client ID: Iv23li60DOYKM6wpvuXn
App Slug: uichat-mira-local-dev
```

环境变量仅供开发者或私有部署覆盖内置配置，普通用户无需填写：

```text
UI_CHAT_GITHUB_APP_CLIENT_ID=
UI_CHAT_GITHUB_APP_SLUG=
```

GitHub App 必须开启 **Device Flow**。要完整使用四个领域工具，Repository permissions 应配置为：

| Permission | 建议级别 | 对应能力 |
| --- | --- | --- |
| Metadata | Read-only | 仓库基础信息与 installation 范围 |
| Contents | Read and write | 分支、提交、文件读取与文件提交/删除 |
| Issues | Read and write | Issue 读取、创建、更新与评论 |
| Pull requests | Read and write | PR 读取、创建、更新、Review 与合并 |
| Actions | Read and write | Runs、Jobs、日志、dispatch、rerun、cancel |
| Workflows | Read and write | 修改 `.github/workflows` 或使用相关部署流程时需要 |
| Pages | Read and write | 读取和配置 GitHub Pages |
| Administration | Read and write | 由 App/组织策略决定；创建仓库本身仍通过用户或组织 API 权限完成 |

GitHub App 提升权限后，已有 installation 可能需要用户或组织管理员在 GitHub 中确认新权限；在确认前，相应 operation 会收到 GitHub `403`。

用户访问令牌与刷新令牌使用 Mira 现有 secret encryption 工具加密落库。Client Secret、GitHub App Private Key 和 Webhook Secret 不进入项目代码。

## 网络与代理

GitHub Device Flow、用户信息、installation 仓库读取以及四个 GitHub 工具都会复用 Mira **通用设置**中的 SOCKS5 配置。服务端仅对 `github.com` 与 `api.github.com` 使用该代理，其他网络请求保持原有出口。

代理设置会在每次 GitHub 请求时读取，因此用户调整 SOCKS5 Host、Port、Username 或 Password 后，不需要为 GitHub 单独保存一份配置。没有配置 SOCKS5 时，GitHub 请求保持直接连接。

Device Flow 遇到临时连接超时、DNS 抖动或连接重置时，不会立即终止授权；Mira 会在授权码有效期内退避重试，直到连接成功、GitHub 明确拒绝或授权码过期。

## 兼容与迁移

旧实现：

```text
github_repo_read
github_issue_read
github_pr_read
github_actions_status
```

继续作为四个领域工具内部的读取 delegate 保留，用于复用已经稳定的读取与归一化逻辑，但不再注册为 Harness capability，也不再出现在 Tools 工作台或 Planner 工具候选中。

## 微应用 API

```text
GET    /microapps/github
PUT    /microapps/github
POST   /microapps/github/device-flow
POST   /microapps/github/device-flow/:flowId/poll
POST   /microapps/github/validate
GET    /microapps/github/repositories
POST   /microapps/github/disconnect
```

现有后端授权协议保持不变。Device Flow 会话仅保存在当前 server 进程内存中，过期或重启后重新发起即可；访问令牌不会放入该内存会话，而是在授权完成后加密写入 `github_connections`。
