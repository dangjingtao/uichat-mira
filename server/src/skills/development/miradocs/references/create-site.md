# 创建 MiraDocs 站点

用于 `create_site` 操作。

## 1. 参数合同

### 阻塞参数

| 参数 | 说明 | 缺失处理 |
| --- | --- | --- |
| `site.name` | 站点显示名称 | 询问 |
| `target.mode` | `local` / `new_github_repo` / `existing_github_repo` | 询问 |
| `target.localPath` | 本地创建位置，仅本地模式需要 | 询问，或使用用户已明确的当前工作区 |
| `target.repository` | `owner/repo`，GitHub 模式需要 | 询问 |
| `repository.visibility` | 新建仓库的 `public` / `private` | 询问，不默认公开 |
| `existingRepo.writePolicy` | 已有非空仓库是否允许修改 | 读取后展示影响并取得明确确认 |

### 可推断参数

| 参数 | 推断方式 |
| --- | --- |
| `contentMode` | “博客”→ `blog`；“文档站”→ `docs`；未说明→ `docs_and_blog` |
| `appearancePreset` | “个人博客”→ `personal_blog`；“技术文档”→ `docs`；未说明→ `minimal` |
| `description` | 根据站点名和用户目标生成短草案 |
| `deployment` | “先本地 / 先不部署”→ `none`；明确“上线 / Pages”→ `github_pages` |

### 稳定默认值

```yaml
contentMode: docs_and_blog
appearancePreset: minimal
deployment: none
customDomain: null
logo: null
accentColor: default
author: null
```

创建 GitHub 仓库不等于自动部署。

### 可延后参数

```text
Logo
自定义主色
自定义域名
作者主页
评论系统
统计代码
社交链接
```

这些参数不得阻塞站点初始化。

## 2. 询问方式

信息不足时，一次询问一组关联参数：

```text
先给我三项：网站名、创建位置（本地 / 新 GitHub 仓库 / 已有仓库），以及风格（默认简洁 / 技术文档 / 个人博客）。
```

新 GitHub 仓库仍缺可见性时，再单独问：

```text
这个新仓库要公开还是私有？
```

不要继续追问 Logo、域名、作者链接等非阻塞配置。

## 3. 目标位置检查

### 本地目录

写入前确认：

- 目标路径是否存在；
- 是否为空；
- 当前工作区是否就是目标目录；
- 是否存在需要保留的文件；
- 依赖与运行环境是否可用。

非空目录不得直接覆盖。先列出影响文件并询问用户是新建子目录、合并还是取消。

### 新 GitHub 仓库

创建前确认：

- owner；
- repository name；
- public / private；
- 是否已经存在同名仓库；
- 用户是否要求立即部署。

使用现有 GitHub 领域工具执行：

```text
github_repository.create
→ 创建 public / private 仓库
→ 回读 repository id、fullName、defaultBranch、visibility、htmlUrl

github_repository.ensure_installation_access
→ 确认新仓库是否已授权给 Mira
→ 未授权时返回 GitHub App installation 设置入口和明确用户动作
→ 用户授权后重新检查
```

创建仓库、授权检查、写文件和启用部署是不同 invocation，各自按现有审批合同执行。不得因为仓库已创建就假设 installation 已授权。

### 已有 GitHub 仓库

先读取：

- 默认分支；
- 仓库是否为空；
- 当前框架和构建脚本；
- 是否已有 MiraDocs 配置；
- 是否有未合并 PR 或活跃施工分支；
- 当前部署工作流；
- 可能被覆盖或冲突的文件。

读取后给出初始化、迁移或保持现状的草案，不直接覆盖。

## 4. 站点施工草案

参数足够后使用：

```text
网站名：Tomz Lab
位置：新建 dangjingtao/tomz-lab
仓库可见性：私有
内容：文档 + 博客
风格：默认简洁
部署：暂不部署
自定义域名：暂不配置
```

用户可以直接纠正不对的项。只有草案中的阻塞参数仍缺失时才继续追问。

完整模板：

```text
skill://miradocs/templates/site-draft.md
```

## 5. 施工顺序

### 本地站点

```text
确认阻塞参数
→ 读取目标目录
→ 展示施工草案
→ 写入最小可运行站点
→ 安装依赖
→ 类型检查
→ 静态构建
→ 验证首页和启用的内容入口
→ 交付路径和剩余项
```

### 新 GitHub 站点

```text
确认阻塞参数
→ 检查同名仓库
→ 展示施工草案
→ github_repository.create
→ github_repository.ensure_installation_access
→ 创建独立施工分支
→ 写入最小可运行站点
→ 本地安装、类型检查和静态构建
→ 创建 PR 并检查 Actions
→ 用户要求上线时配置 Pages
→ 回读仓库、CI、Pages 和最终 URL
→ 交付地址、分支、PR 和剩余项
```

### 已有 GitHub 站点

```text
确认目标仓库
→ 读取当前事实和冲突
→ 展示施工草案及影响
→ 创建独立分支
→ 写入最小变更
→ 安装、类型检查和构建
→ 创建或更新 PR
→ 检查 Actions / Pages
→ 回读结果并交付
```

## 6. 最小可运行站点

至少包含：

```text
MiraDocs 配置
首页
文档示例或文档入口（contentMode 包含 docs 时）
博客示例或博客入口（contentMode 包含 blog 时）
开发命令
构建命令
静态产物输出配置
README 中的本地启动说明
```

示例内容必须明确标记为示例，不得伪装成用户真实内容。

风格预设只应决定必要的布局、字体层级、间距和基础主题，不在 V1 引入复杂主题编辑器。

## 7. GitHub Pages 部署

`deployment: github_pages` 时：

```text
github_repository.get_pages
→ 读取当前 Pages 是否启用、build type、source、域名、HTTPS 和 URL

写入并验证部署工作流或目标分支产物

github_repository.configure_pages
→ mode=workflow：使用 GitHub Actions 部署
→ mode=branch：必须给出 branch 和 / 或 /docs 路径
→ 按用户要求设置或移除 customDomain、配置 enforceHttps
→ 写后回读最终 Pages 状态

检查 Actions 与最终 Pages URL
```

规则：

- `deployment: none`：只创建并验证项目，不配置远程部署；
- 自定义域名仅在用户明确提出时处理；
- Pages 配置与仓库创建分开审批；
- 工作流模式不传 branch/path；分支模式必须明确 branch；
- 没有 Actions 和 Pages 回读证据时，只能说“部署配置已写入”，不能说“网站已上线”。

## 8. 失败与恢复

每一步完成后记录可回读事实，不使用只存在于对话里的“已经做过”作为恢复依据。

### 仓库已创建，但 installation 未授权

```text
completed: github_repository.create
blocked: github_repository.ensure_installation_access
not_run: branch / files / PR / Pages
```

返回仓库 `fullName`、`htmlUrl` 和 GitHub App installation 操作入口。用户完成授权后，先重新调用 `ensure_installation_access`；不得再次调用 `create`。

### 文件已写入，但本地验证失败

保留施工分支和文件，明确失败在依赖安装、TypeScript、内容发现还是静态构建。Pages 必须保持 `not_run`。修复时从失败层继续，不重新初始化整个站点。

### PR 或 Actions 失败

保留现有 PR，在同一施工分支修复。先读取最新 PR、commit 和 Actions 状态，不能创建第二张重复 PR 来逃避失败。

### Pages 配置失败

先调用 `github_repository.get_pages` 读取当前状态，再决定是否重试 `configure_pages`。仓库、站点文件和 PR 已经完成时，不因 Pages 失败而重复写入或回滚正确内容。

## 9. 完成标准

只有同时满足以下条件，才能说站点已创建：

- 站点文件已写入目标位置或施工分支；
- 新 GitHub 仓库已完成创建回读和 installation 授权检查；
- 依赖安装结果明确；
- 类型检查结果明确；
- 静态构建结果明确；
- 首页和启用的内容入口可被发现；
- 用户要求部署时，Pages 配置、Actions 与最终 URL 已回读；
- 用户能看到本地路径或仓库、分支、PR、预览或部署地址；
- 每个步骤的 `completed`、`blocked`、`failed` 或 `not_run` 状态明确；
- 失败步骤和剩余配置被明确列出。

不能仅凭模板文件已生成宣布建站完成。