---
id: github-collaboration
displayName: GitHub 协作
description: "理解和维护已授权的 GitHub 项目，管理 Issue、审查 Pull Request、诊断 Actions，并在 Harness 审批边界内安全推进远程变更。"
version: 0.1.0
category: development
visibility: public
source: Mira Lab
status: current
execution.agent: subAgent
execution.allowedTools: github_repository, github_issue, github_pull_request, github_actions
execution.workspaceBound: false
---

# GitHub 协作

这是 GitHub 协作 Base Skill。它通过一个 Skill-owned SubAgent 提供远程项目理解、Issue/PR/Actions 维护和交付推进方法。

Skill 命中不注册 Tool、不扩大 ToolExposure、不绕过仓库授权、Policy、审批、Evidence 或 Trace。真实能力取决于当前 Harness 是否暴露对应 GitHub 领域 Tool。

# 一句话目标

> 看懂项目，推进工作，守住远程操作边界。

# Routing

适用于：

- 查看已授权仓库的近期状态、风险和待处理项；
- 创建、读取、更新、评论、关闭或重新打开 Issue；
- 阅读、审查、评论、提交 Review、更新或合并 Pull Request；
- 查看 Actions run / job / step / log，诊断失败并按需操作；
- 创建分支、读取或提交文件，通过 PR 推进交付；
- 在同一任务续轮中继续处理明确的仓库、Issue、PR、branch 或 run。

不适用于：

- 只讨论 Git / GitHub 一般知识；
- 仓库未授权给 Mira；
- 绕过审批、权限、分支保护或组织安全策略；
- 任务只涉及本地工作区且不需要 GitHub 当前事实。

# Core loop

```text
理解目标
-> 确认仓库与对象
-> 读取当前事实
-> 形成判断
-> 准备精确动作
-> Harness approval for writes
-> 执行
-> 回读验证
-> 交付结果与缺口
```

## 1. 先确认对象

尽量确定：

- `owner/repository`；
- 目标对象类型与编号；
- 用户要分析、建议还是执行写入；
- 远程写入范围。

同一任务可以继承最近明确对象；明显新任务不得静默沿用旧仓库。

## 2. 写入前读取当前事实

- 创建 Issue 前搜索重复项；
- 更新/关闭 Issue 前读取目标 Issue；
- Review/merge PR 前读取 PR、diff、讨论、reviews 与 CI；
- 修改文件前读取 branch 与当前 file SHA；
- rerun/cancel Actions 前读取 run、jobs 与必要日志。

模型记忆、旧快照或用户口述不能替代当前远程事实。

## 3. 读写分开

用户只要求分析时，不产生远程写入。

远程写入必须形成 exact invocation 并进入审批链。高风险动作必须明确对象、影响和不可逆部分。

## 4. 执行后回读

不能只相信写接口返回。执行后重新读取关键对象并核验：

- Issue / PR 编号、状态、标签和链接；
- branch、path、file SHA、commit SHA；
- Review / merge 状态；
- run / job 状态。

# Workflows

## A. Project pulse

按需读取：

```text
skill://github-collaboration/references/project-pulse.md
```

交付至少包含：项目状态、正在进行、阻塞与风险、最近失败、优先处理建议。

## B. Issue stewardship

按需读取：

```text
skill://github-collaboration/references/issue-stewardship.md
```

创建前搜索重复项；更新或关闭前回读当前 Issue。

## C. Pull Request review

按需读取：

```text
skill://github-collaboration/references/pr-review.md
```

审查联合考虑元数据、diff、讨论、已有 Reviews 和 CI。只有用户明确要求时才提交 Review 或 merge。

## D. Delivery flow

按需读取：

```text
skill://github-collaboration/references/delivery-flow.md
```

默认使用独立工作分支，不直接写默认分支：

```text
读取仓库与 base
-> 创建 branch
-> 读取目标文件与 SHA
-> 写入
-> 创建 PR when required
-> 检查 CI
-> 回读验证
```

## E. Actions triage

按需读取：

```text
skill://github-collaboration/references/actions-triage.md
```

先定位失败 run/job/step，再读取必要日志。诊断不等于自动 rerun、dispatch 或 cancel。

# Tool boundary

```text
github_repository
github_issue
github_pull_request
github_actions
```

`execution.allowedTools` 是最大 fork 边界，不是权限授予，也不是每个任务都必须同时具备的清单。每个步骤只要求当前真正需要的 Tool。

真实能力：

```text
Skill declared tools
∩ current Harness exposure
∩ repository authorization
∩ Policy / Approval
```

# Output

尽量按以下结构交付：

```text
我看到了什么
我判断了什么
我做了什么
接下来还差什么
```

对已执行写入给出可核验标识：Issue/PR 编号、branch、path、commit SHA、run ID、最终状态和链接。

# Hard Rules

1. 未授权仓库立即停止，不退化为其它读取路径。
2. 任何远程写入前读取当前事实。
3. 创建 Issue 前搜索重复项。
4. 修改文件前读取当前文件 SHA。
5. 默认创建独立 branch，不直接写默认分支。
6. Review PR 前检查 diff、讨论、Reviews 与 CI。
7. Merge 前确认状态、CI 和保护边界。
8. Skill 不注册 Tool、不扩大 ToolExposure、不绕过审批。
9. 写入后必须回读验证。
10. 用户只要求分析时不主动写入。
11. 不暴露 token 或凭据。
12. 不能确认的当前状态必须标为缺口。
13. completed 结果必须由远程 Evidence 支持。

# Completion

任务完成需要：

- 仓库与对象明确；
- 结论基于当前远程事实；
- 写入经过审批；
- 执行结果回读验证；
- 用户获得关键编号、状态、链接或提交标识；
- 阻塞、权限不足和未完成项被明确列出。