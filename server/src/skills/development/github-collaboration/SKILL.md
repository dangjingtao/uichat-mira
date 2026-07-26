---
id: github-collaboration
displayName: GitHub 协作
description: "理解和维护已授权的 GitHub 项目，管理 Issue、审查 Pull Request、诊断 Actions，并在 Harness 审批边界内安全推进远程变更。"
version: 0.1.0
category: development
visibility: public
source: Mira
status: draft
executionContext: fork
agent: subAgent
allowedTools: github_repository, github_issue, github_pull_request, github_actions
workspaceBound: false
---

# Draft status

这是一份 GitHub 协作 Base Skill 拟稿。

它通过渐进式披露向 Agent 提供 GitHub 项目协作方法、执行顺序、质量规则和交付格式。它不是 Tool，不注册能力，不扩大 `state.toolExposure`，不绕过 Harness 的仓库授权、Policy、审批、Evidence 或 Trace。

当前执行边界由四个 GitHub 领域工具独立提供：

```text
github_repository
github_issue
github_pull_request
github_actions
```

Skill 命中只表示“当前任务应该采用 GitHub 协作方法”。四个工具是否真实可用，继续以 Harness 和当前环境为准。

# 一句话目标

> 看懂项目，推进工作，守住远程操作边界。

# 何时使用

适用于用户希望：

- 了解某个已授权 GitHub 项目的近期状态、风险和待处理项；
- 搜索、读取、创建、更新、评论、关闭或重新打开 Issue；
- 阅读、审查、评论、提交 Review、更新或合并 Pull Request；
- 查看 Actions 运行、Jobs、Steps 和日志，诊断失败并按需 rerun、dispatch 或 cancel；
- 创建分支、读取或提交文件，并通过 PR 推进交付；
- 在多轮对话中继续处理同一个仓库、Issue、PR、分支或 Actions run。

不适用于：

- 用户只想讨论 Git / GitHub 一般知识；
- 目标仓库未通过 GitHub App installation 授权给 Mira；
- 用户要求绕过审批、仓库权限、分支保护或组织安全策略；
- 本地工作区代码理解可以独立完成且任务并不涉及 GitHub 远程事实或操作。

# 核心工作方法

所有 GitHub 任务默认遵循同一闭环：

```text
理解目标
  ↓
确认仓库与对象
  ↓
读取当前事实
  ↓
形成判断
  ↓
提出可审阅动作
  ↓
Harness 审批远程写入
  ↓
执行
  ↓
回读验证
  ↓
交付结果与剩余缺口
```

## 1. 先确认对象

在调用工具前，尽量确认：

- `repository`：`owner/repository`；
- 目标对象：仓库、Issue、PR、workflow、run、job、branch 或 file；
- 用户目标：只分析、准备建议、执行写入，还是推进到某个完成状态；
- 对远程写入的预期范围。

同一任务续轮中，可以继承最近明确的仓库和对象，但不得把旧任务中的仓库静默带入一个明显的新任务。

## 2. 写入前先读取当前事实

任何远程写入之前，先读取足够的当前状态：

- 创建 Issue 前先搜索可能重复项；
- 更新、评论、关闭或重新打开 Issue 前先读取目标 Issue；
- Review、更新或合并 PR 前先读取 PR、变更、讨论、Reviews 和 CI；
- 写入或删除文件前先读取目标分支与文件 SHA；
- rerun、cancel 或诊断 Actions 前先读取 run、Jobs 和必要日志。

不得以模型记忆、上一轮旧快照或用户口头描述替代远程当前事实。

## 3. 读与写分开

用户只要求分析、总结或建议时，不主动产生远程写入。

远程写入必须让 Harness 进入审批链。Skill 不自行模拟批准，也不把多个不同写入合并成一个模糊动作。

高风险操作包括但不限于：

```text
github_repository.delete_file
github_pull_request.merge
github_actions.cancel
```

这些操作除了普通写入检查，还必须明确说明对象、影响和不可逆部分。

## 4. 执行后回读验证

不能只相信写接口返回。执行后应重新读取关键对象并确认最终状态，例如：

- 创建 Issue 后回读 Issue 编号、标题、状态、标签和链接；
- 提交文件后确认 branch、path、file SHA 和 commit SHA；
- 创建 PR 后回读 PR 编号、head、base、draft 状态和链接；
- 提交 Review 后确认 Review 状态；
- 合并 PR 后确认 `merged=true` 和合并提交；
- dispatch、rerun 或 cancel 后回读 run 状态。

# 五类主要工作流

## A. 项目脉搏

用户常见表达：

```text
看看这个项目最近怎么样
这个仓库现在有什么风险
今天 GitHub 上有什么需要我处理
```

优先组合：

```text
github_repository.get / list_commits
github_issue.list
github_pull_request.list
github_actions.list_runs
```

输出至少包含：项目状态、正在进行、阻塞与风险、最近失败、建议优先处理。

按需披露：

```text
skill://github-collaboration/references/project-pulse.md
```

## B. Issue 管理

用户常见表达：

```text
把这个需求建成 Issue
更新 Issue #42
给这个 Issue 留个评论
这个问题可以关闭了
```

默认先搜索重复项，再准备结构化标题、正文、标签、负责人和验收标准。更新或关闭前先回读当前 Issue。

按需披露：

```text
skill://github-collaboration/references/issue-stewardship.md
skill://github-collaboration/templates/issue-template.md
```

## C. Pull Request 审查

用户常见表达：

```text
审查 PR #42
这个 PR 能合并吗
帮我提交 request changes
```

审查时至少联合考虑：PR 元数据、文件变化、会话评论、行级评论、已有 Reviews、Actions 状态与日志。只有用户明确要求提交 Review 时，才执行 `comment`、`approve` 或 `request_changes`。

按需披露：

```text
skill://github-collaboration/references/pr-review.md
skill://github-collaboration/templates/pr-review-template.md
```

## D. 交付推进

用户常见表达：

```text
把这个修改推到 GitHub
创建分支并提交文件
为这些修改创建 PR
```

默认使用独立 feature branch，不直接写默认分支。推荐顺序：

```text
读取仓库与默认分支
→ 创建分支
→ 读取目标文件与 SHA
→ 写入或删除文件
→ 创建 PR
→ 检查 Actions
→ 回读验证
```

按需披露：

```text
skill://github-collaboration/references/delivery-flow.md
skill://github-collaboration/templates/delivery-summary.md
```

## E. Actions 故障诊断

用户常见表达：

```text
CI 为什么失败
看看 run 123 的日志
修好后重跑失败任务
取消这个错误的工作流
```

先定位失败 run、job 和 step，再读取必要日志。诊断与执行分开：给出原因和修复建议不等于自动 rerun、dispatch 或 cancel。

按需披露：

```text
skill://github-collaboration/references/actions-triage.md
```

# 工具路由

| 用户目标 | 主要工具 | 常用 operation |
| --- | --- | --- |
| 仓库概览、分支、提交、文件 | `github_repository` | `get`、`list_branches`、`list_commits`、`read_file`、`compare_commits` |
| 分支和文件远程变更 | `github_repository` | `create_branch`、`write_file`、`delete_file` |
| Issue 查询与维护 | `github_issue` | `list`、`search`、`get`、`create`、`update`、`comment`、`close`、`reopen` |
| PR 查询、审查与推进 | `github_pull_request` | `list`、`get`、`create`、`update`、`comment`、`review`、`merge` |
| Actions 状态与诊断 | `github_actions` | `list_runs`、`get_run`、`get_logs` |
| Actions 远程操作 | `github_actions` | `dispatch`、`rerun`、`cancel` |

不要因为 Skill 命中就假设这些工具已进入本轮 ToolExposure。Planner 只能使用当前真实暴露的能力。

# 输出风格

对用户的交付尽量固定为四块：

```text
我看到了什么
我判断了什么
我做了什么
接下来还差什么
```

避免把底层 `operation`、HTTP 响应或未经解释的 JSON 直接当成主要交付。

对每个已执行写入，给出可核验标识：Issue/PR 编号、branch、path、commit SHA、run ID、最终状态和链接。

# Hard Rules

1. 未授权仓库立即停止，不退化为读取公开仓库。
2. 任何远程写入前先读取当前事实。
3. 创建 Issue 前先搜索重复项；发现高相似项时先向用户说明。
4. 修改文件前读取当前文件 SHA；不得盲覆盖远程文件。
5. 默认创建独立分支，不直接写默认分支。
6. Review PR 前检查变更、讨论、已有 Reviews 和 CI。
7. 合并 PR 前确认目标 PR 未关闭、可合并，并说明 CI 与分支保护状态。
8. Skill 不注册 Tool、不扩大 ToolExposure、不绕过 Harness 审批。
9. 执行后必须回读验证，不把“请求已发送”冒充成最终完成。
10. 用户只要求分析时，不主动写入 GitHub。
11. 不在回答、Artifact 或 Trace 中暴露 access token、refresh token 或其他凭据。
12. 不能确认的信息必须标为缺口，不根据常识伪造 GitHub 当前状态。

# Completion Criteria

一个 GitHub 协作任务只有在以下条件满足时才算完成：

- 目标仓库和对象已明确；
- 所有结论基于当前远程事实；
- 必需写入已经过 Harness 审批；
- 执行结果已回读验证；
- 用户能看到关键编号、状态、链接或提交标识；
- 未完成、阻塞、权限不足或需要人工决定的部分被明确列出；
- 没有越过 installation、Policy、审批或分支保护边界。
