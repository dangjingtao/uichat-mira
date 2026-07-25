# GitHub 微应用

## 目标

GitHub 微应用负责两件事：

1. 使用 GitHub App Device Flow 连接当前用户，不要求用户填写 PAT，也不在桌面包中保存 Client Secret 或 GitHub App 私钥。
2. 读取 GitHub App installation 的真实仓库范围，按个人账号或组织展示 GitHub 已授权给 Mira 的项目。

仓库授权不由 Mira 自建白名单模拟。用户在 GitHub 原生安装页选择 `All repositories` 或 `Only select repositories`，Mira 只读取 installation 实际返回的仓库。

## 当前边界

- 已实现：GitHub App Client ID / App Slug 配置、Device Flow、令牌本地加密保存、令牌刷新、连接验证、installation 与仓库列表、仓库授权管理入口、断开连接。
- 未实现：在微应用页面里直接封装 Issue、Pull Request、Actions 等业务 API。
- 后续执行面：复用 GitHub MCP，并通过 Harness / Policy 暴露受控工具；不要在页面层重复生成一套 GitHub 工具。

## GitHub App 配置

创建 GitHub App 后：

1. 开启 **Device Flow**。
2. 记录 **Client ID** 和 App URL 中的 **App Slug**。
3. Repository permissions 最少保留 `Metadata: Read-only`；Contents、Issues、Pull requests、Actions 等权限按实际启用的 MCP toolset 再增加。
4. 安装时建议选择 **Only select repositories**，只把明确需要 Mira 处理的项目交给它。

可选环境变量：

```text
UI_CHAT_GITHUB_APP_CLIENT_ID=
UI_CHAT_GITHUB_APP_SLUG=
```

环境变量只用于首次预填，之后配置保存在本地 SQLite。用户访问令牌与刷新令牌使用 Mira 现有 secret encryption 工具加密落库。

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

Device Flow 会话仅保存在当前 server 进程内存中，过期或重启后重新发起即可；访问令牌不会放入该内存会话，而是在授权完成后加密写入 `github_connections`。
