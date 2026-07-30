---
status: current
owner: integrations / harness
last_verified: 2026-07-30
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
  - ../archive/microapp/github-capability-design-pre-implementation.md
---

# GitHub 微应用与四领域工具当前合同

> 这页定义当前已经落地的 GitHub 连接入口、仓库授权边界、四个 Harness 领域工具、operation 语义和审批规则。

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

不再属于当前公共 Planner 合同；必要的兼容读取不能恢复它们的当前解释权。

## 3. 连接与可用性

GitHub 工具进入 eligible public surface 前，至少需要：

- GitHub Device Flow 已完成；
- 当前用户身份可验证；
- GitHub App installation 可用；
- 仓库出现在 installation 授权范围；
- GitHub 网络出口可用；
- canonical tool implementation 已注册。

连接成功不等于任意仓库可用。公开仓库也不能绕过 installation scope。

Token、refresh token、installation token 和私钥：

- 不进入模型参数；
- 不进入 Tool result 正文；
- 不进入 Evidence 明文；
- 不写入普通 trace。

## 4. `github_repository`

负责仓库、分支、提交和文件操作。

当前 operation：

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

核心参数：

- `repository: owner/repository`；
- operation 对应的独立参数；
- 写文件使用目标分支、路径、完整内容和必要的并发保护字段；
- 删除文件需要当前 SHA；
- compare 使用明确 base / head。

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

Issue number、正文、标签、assignee、milestone 和状态字段只在对应 operation 中出现，不把所有字段平铺成一个模糊 schema。

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
- merge 应带 `expectedHeadSha`，避免用旧审查结果合并已经发生变化的 PR；
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

## 8. 审批规则

GitHub 所有操作都访问网络，但不是所有网络读取都要求审批。

### 默认无需审批

```text
github_repository:
  get / list_branches / list_commits / read_file / compare_commits

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
  create_branch / write_file / delete_file

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
- 目标仓库；
- operation；
- 分支、路径、Issue、PR、workflow 或 run；
- 将提交的正文、评论、Review、commit message 或 inputs 摘要。

高风险动作还要有并发保护或更强确认：

- 文件删除：当前 SHA；
- PR 合并：`expectedHeadSha`；
- Request Changes Review：event 与正文；
- Workflow cancel：run、workflow、branch 和当前状态。

## 9. Tool Exposure

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

仓库范围、Token 注入、Policy、审批、网络调用、结果归一化和 trace 由 GitHub adapter / Harness 负责。

## 10. 结果与 Evidence

每次调用至少保留：

- `toolId`；
- operation；
- repository；
- installation scope 校验结果；
- 请求耗时与重试；
- 分页 / 截断状态；
- 写操作审批结果；
- 稳定远端标识，例如 commit SHA、Issue number、PR number、runId。

Tool success 只证明一次远端调用完成。

例如：

- 创建分支不等于代码已经提交；
- 创建 PR 不等于审查通过；
- workflow completed 不等于测试成功；
- PR mergeable 不等于应该合并；
- 评论发送成功不等于对方已经处理。

这些结果必须进入 Evidence，再由 Planner 判断用户全局目标。

## 11. 与 Skill 的关系

GitHub 协作 Skill 可以提供工作方法、读前写后验证和交付约束，但：

- 不扩大 ToolExposure；
- 不绕过 installation scope；
- 不绕过 operation-specific approval；
- 不把 Skill 文字变成远程权限；
- 写操作后必须回读远端状态验证。

## 12. 当前非目标

- 不把 GitHub REST / GraphQL 全量 API 暴露给模型；
- 不在 GitHub 微应用里复制完整 Issue / PR 管理后台；
- 不允许 public repository 绕过用户授权；
- 不把 GitHub Tool Pack 改造成 Integration MicroAPP；
- 不把连接成功包装成所有 operation 已验证；
- 不恢复旧四个 read aliases 的公共入口。

## 13. 历史

四领域工具形成前的完整设计和迁移口径保存在：

- [[archive/microapp/github-capability-design-pre-implementation]]

需要判断当前工具面时，以本页、[[TOOL_CURRENT_TRUTH]] 和代码为准。