# GitHub 微应用

## 目标

GitHub 微应用负责两件事：

1. 使用 Mira 内置 GitHub App 的 Device Flow 连接当前用户，不要求用户填写 PAT、Client ID 或 App Slug，也不在桌面包中保存 Client Secret 或 GitHub App 私钥。
2. 读取 GitHub App installation 的真实仓库范围，按个人账号或组织展示 GitHub 已授权给 Mira 的项目。

仓库授权不由 Mira 自建白名单模拟。用户在 GitHub 原生安装页选择 `All repositories` 或 `Only select repositories`，Mira 只读取 installation 实际返回的仓库。

## 当前边界

- 微应用页面只负责：连接、Device Flow、installation 仓库列表、添加仓库授权、验证连接和断开连接。
- GitHub App Client ID / App Slug 属于 Mira 应用配置，不进入用户侧配置面。
- Issue、Pull Request、Actions 等执行能力不在微应用页面中实现，而是通过 Harness capability 暴露。
- 当前 GitHub 能力包为只读；没有修改 Planner、审批协议或 MCP 架构。

## GitHub Read 能力包

Harness 当前注册四个独立工具，每个工具有自己的参数 Schema，不使用万能 `action` 参数：

| 工具 | 作用 | 关键参数 |
| --- | --- | --- |
| `github_repo_read` | 读取仓库元数据，可选 README、语言、分支和最近提交 | `repository`、`ref`、`includeReadme`、`includeLanguages`、`includeBranches`、`branchLimit`、`commitLimit` |
| `github_issue_read` | 列出或读取 Issue；单条模式可读取评论 | `repository`、`number`、`query`、`state`、`labels`、`assignee`、`creator`、`updatedSince`、`includeComments`、`limit`、`page` |
| `github_pr_read` | 列出或读取 Pull Request；单条模式可读取文件、评论和 Reviews | `repository`、`number`、`state`、`base`、`head`、`includeFiles`、`includeComments`、`includeReviews`、`detailLimit`、`limit`、`page` |
| `github_actions_status` | 列出或读取 workflow run；单条模式可读取 Jobs 与 Steps | `repository`、`runId`、`workflow`、`branch`、`event`、`status`、`actor`、`includeJobs`、`jobLimit`、`limit`、`page` |

四个工具执行前都会使用当前 GitHub 用户令牌读取 installation 的真实仓库列表，并再次验证目标 `owner/repository` 是否已经授权。模型传入仓库名不能绕过 installation 边界。

四个工具在 Tools 工作台中归入同一个 `github_read` 工具包，但仍然是四个独立执行单元。它们均为网络只读能力：

```text
sideEffect = network
requiresApproval = false
networkAccess = true
```

## GitHub App 配置

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

GitHub App 必须开启 **Device Flow**。Repository permissions 至少需要 `Metadata: Read-only`；要使用当前四个只读工具，还需要根据实际调用开放 `Contents`、`Issues`、`Pull requests` 和 `Actions` 的只读权限。

用户访问令牌与刷新令牌使用 Mira 现有 secret encryption 工具加密落库。Client Secret、GitHub App Private Key 和 Webhook Secret 不进入项目代码。

## API

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
