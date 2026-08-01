---
status: current
owner: integrations / harness
last_verified: 2026-08-01
layer: wiki
module: MicroAPP / Tool
feature: GitHubCapabilityPack
doc_type: current-contract
canonical: true
related:
  - ../MICROAPP_CURRENT_TRUTH.md
  - README.md
  - ../TOOL_CURRENT_TRUTH.md
  - ../harness/README.md
  - ../skill/README.md
  - ../../server/src/skills/development/miradocs/SKILL.md
  - ../archive/microapp/github-capability-design-pre-implementation.md
---

# GitHub 微应用与四领域工具当前合同

> 这页定义当前已经落地的 GitHub 连接入口、仓库授权边界、四个 Harness 领域工具、operation 语义、schema 与审批规则。

## 1. 当前结论

GitHub 在 Mira 中分成两层：

```text
GitHub 微应用
  -> Device Flow
  -> GitHub App installation
  -> 授权仓库范围
  -> 连接验证 / 断开

GitHub Tool Pack
  -> github_repository
  -> github_issue
  -> github_pull_request
  -> github_actions
```

微应用负责连接和范围；Tool Pack 负责实际仓库协作。

```text
GitHub page
!= GitHub tool
!= Integration MicroAPP
```

## 2. 当前公共工具面

Planner 当前只使用四个稳定领域工具：

```text
github_repository
github_issue
github_pull_request
github_actions
```

不重新拆成十几个 GitHub 原子工具，也不恢复一个无边界的 `github(action=...)` 万能工具。

旧的只读别名：

```text
github_repo_read
github_issue_read
github_pr_read
github_actions_status
```

只可作为领域工具内部兼容 delegate；不再属于当前公共 Planner 合同，也不能恢复为独立公共入口。

## 3. 连接与可用性

GitHub 工具进入 eligible public surface 前，至少需要：

- GitHub Device Flow 已完成；
- 当前用户身份可验证；
- GitHub App installation 可用；
- 目标仓库出现在 installation 授权范围，或当前 operation 明确用于创建仓库 / 检查 installation；
- GitHub 网络出口可用；
- canonical tool implementation 已注册。

连接成功不等于任意仓库可用。公开仓库也不能绕过 installation scope。

Token、refresh token、installation token 和私钥：

- 不进入模型参数；
- 不进入 Tool result 正文；
- 不进入 Evidence 明文；
- 不写入普通 trace。

## 4. `github_repository`

负责仓库、installation、分支、提交、文件和 GitHub Pages。

当前 operation 共 12 个：

| operation | 作用 | 主要参数 |
| --- | --- | --- |
| `get` | 读取仓库元数据 | `repository`，可选读取项 |
| `list_branches` | 分页读取分支 | `repository`、分页参数 |
| `list_commits` | 按 ref、作者、路径和时间读取提交 | `repository`、筛选参数 |
| `read_file` | 按 path/ref 读取文件 | `repository`、`path`、可选 `ref` |
| `create_branch` | 从明确 ref 创建分支 | `repository`、分支与基线 ref |
| `write_file` | 通过 Contents API 创建或更新文件并产生提交 | `repository`、`branch`、`path`、完整 `content`、`commitMessage`，更新时带并发保护字段 |
| `delete_file` | 删除文件并产生提交 | `repository`、`branch`、`path`、当前 `sha`、`commitMessage` |
| `compare_commits` | 比较 base/head | `repository`、`base`、`head` |
| `create` | 创建新仓库并回读 | `owner`、`name`、`visibility`，可选 `description` / `autoInit`；此 operation 不使用 `repository` |
| `ensure_installation_access` | 检查目标仓库是否进入 Mira installation | `repository`；未授权时返回用户动作，不伪装可访问 |
| `get_pages` | 读取 GitHub Pages 当前状态 | `repository` |
| `configure_pages` | 配置 Pages 并回读最终状态 | `repository`、`mode`；branch 模式需要 `branch`，可选 `/` 或 `/docs`、域名和 HTTPS |

关键约束：

- operation 使用独立参数结构；
- `create` 成功不等于 installation 已授权，必须继续调用 `ensure_installation_access`；
- `write_file` 写完整目标内容，不接受缺失 path/content/commit message 的模糊调用；
- `delete_file` 必须带当前 SHA；
- Pages 的 `workflow` 模式不传 branch/path；`branch` 模式必须明确 branch；
- 创建仓库、写文件、配置 Pages 是不同 invocation，各自审批和回读；
- 远程返回成功但回读不完整时，不得宣称完成。

## 5. `github_issue`

负责 Issue 查询、创建、更新、评论和状态变更。

当前 operation：

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

Issue number、正文、标签、assignee、milestone 和状态字段只在对应 operation 中出现。Issue operation 会拒绝 Pull Request 编号，避免把 GitHub 共用的 Issues API 误当成 Issue。

## 6. `github_pull_request`

负责 Pull Request 查询、创建、修改、评论、Review 和合并。

当前 operation：

```text
list
get
create
update
comment
review
merge
```

约束：

- Review event 只使用有限枚举；
- inline comment 必须绑定路径和有效 diff 位置 / line 语义；
- merge 应带 `expectedHeadSha`，避免用旧审查结果合并已经变化的 PR；
- Main Agent 或 SubAgent 不得把“PR 可合并”当成“已经完成用户要求”。

## 7. `github_actions`

负责 workflow run、job 和日志。

当前 operation：

```text
list_runs
get_run
get_logs
dispatch
rerun
cancel
```

日志必须有大小边界，并标记分页、截断和失败。手动触发、重跑和取消必须展示目标 workflow、ref、run 或 job。

## 8. Operation schema 合同

四个领域工具的 canonical runtime schema 使用以 `operation` 为判别字段的严格 `oneOf`：

```text
canonical tool definition
  -> discriminated oneOf
  -> operation-specific required fields
  -> unrelated fields rejected
  -> Harness 使用原始 schema 再校验
```

以下规则不能混淆：

1. Tool definition 与 Harness runtime validation 永远保留原始严格 `oneOf`。
2. 支持 `oneOf` 的 Provider 直接看到原始结构。
3. 不支持复杂组合 schema 的 Provider，可以在 Provider 请求边界临时投影为兼容对象；投影不得写回 Tool definition，也不得替换 Harness schema。
4. Provider 投影必须保留全部 operation 枚举和各 variant 字段的并集，只把所有 variant 共同必需的字段标为全局 required。
5. 运行时收到参数后，先按 `operation` 选择唯一 variant，再返回具体字段错误，例如 `args.content is required`；不能把所有缺字段、额外字段和类型错误压成同一句 `must match exactly one schema variant`。
6. Provider 兼容投影只是模型输入适配，不是降低审批、installation scope 或远程写入约束。

因此：

```text
provider-visible compatibility schema
!= canonical runtime schema
!= approval grant
```

## 9. 审批规则

GitHub 所有操作都访问网络，但不是所有网络读取都要求审批。

### 默认无需审批

```text
github_repository:
  get / list_branches / list_commits / read_file / compare_commits
  ensure_installation_access / get_pages

github_issue:
  list / get / search

github_pull_request:
  list / get

github_actions:
  list_runs / get_run / get_logs
```

### 必须审批

```text
github_repository:
  create / create_branch / write_file / delete_file / configure_pages

github_issue:
  create / update / comment / close / reopen

github_pull_request:
  create / update / comment / review / merge

github_actions:
  dispatch / rerun / cancel
```

审批是 operation-specific runtime requirement，不是简单读取 tool definition 上的一个静态布尔值。

审批信息至少展示：

- GitHub 身份；
- 目标仓库，或待创建的 owner/name；
- operation；
- visibility、分支、路径、Issue、PR、workflow、run 或 Pages 配置；
- 将提交的正文、文件内容摘要、评论、Review、commit message 或 inputs 摘要。

高风险动作还要有并发保护或更强确认：

- 文件删除：当前 SHA；
- PR 合并：`expectedHeadSha`；
- Request Changes Review：event 与正文；
- Workflow cancel：run、workflow、branch 和当前状态。

## 10. Tool Exposure

GitHub 不使用关键词硬编码决定“只给哪个领域工具”。

它遵守统一 Tool Exposure：

```text
public eligible tools <= 20
  -> 全部暴露

public eligible tools > 20
  -> embedding / rerank
  -> 暴露前 20
```

GitHub 连接与仓库授权决定 availability；ranking 只服务上下文预算，不直接形成 invocation。

Planner 仍然只决定：

```text
toolId + operation + args
```

仓库范围、Token 注入、schema validation、Policy、审批、网络调用、结果归一化和 trace 由 GitHub adapter / Harness 负责。

## 11. 结果与 Evidence

每次调用至少保留：

- `toolId`；
- operation；
- repository，或创建仓库时的 owner/name；
- installation scope 校验结果；
- 请求耗时与重试；
- 分页 / 截断状态；
- 写操作审批结果；
- 稳定远端标识，例如 repository id、commit SHA、Issue number、PR number、runId、Pages URL。

Tool success 只证明一次远端调用完成。

例如：

- 创建仓库不等于 installation 已授权；
- 创建分支不等于代码已经提交；
- 文件写入不等于构建通过；
- 创建 PR 不等于审查通过；
- workflow completed 不等于测试成功；
- Pages 配置写入不等于网站已上线；
- PR mergeable 不等于应该合并；
- 评论发送成功不等于对方已经处理。

这些结果必须进入 Evidence，再由 Planner 判断用户全局目标。

## 12. 与 Skill 和 MiraDocs 的关系

GitHub 协作 Skill 与 MiraDocs Skill 可以提供工作方法、步骤顺序、读前写后验证和交付约束，但：

- 不扩大 ToolExposure；
- 不绕过 installation scope；
- 不绕过 operation-specific approval；
- 不把 Skill 文字变成远程权限；
- 写操作后必须回读远端状态验证；
- 新仓库创建后必须单独检查 installation；
- 本地构建验证属于 Terminal / Workspace 合同，不由 GitHub Tool 假装完成。

## 13. 当前非目标

- 不把 GitHub REST / GraphQL 全量 API 暴露给模型；
- 不在 GitHub 微应用里复制完整 Issue / PR 管理后台；
- 不允许 public repository 绕过用户授权；
- 不把 GitHub Tool Pack 改造成 Integration MicroAPP；
- 不把连接成功包装成所有 operation 已验证；
- 不恢复旧四个 read aliases 的公共入口；
- 不用全局扁平 schema 取代 operation-specific runtime schema。

## 14. 历史

四领域工具形成前的完整设计和迁移口径保存在：

- [[archive/microapp/github-capability-design-pre-implementation]]

需要判断当前工具面时，以本页、[[TOOL_CURRENT_TRUTH]] 和代码为准。