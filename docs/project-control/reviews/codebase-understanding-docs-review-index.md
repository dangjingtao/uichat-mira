---
status: current
owner: docs
last_verified: 2026-07-08
layer: project-control
module: ProjectControl
feature: CodebaseUnderstandingDocsReview
doc_type: review
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/project-control/tasks/code_T001-codebase-understanding-consensus-doc-integration.md
  - docs/project-control/tasks/code_T002-codebase-engine-benchmark.md
  - docs/project-control/tasks/code_T003-codegraph-managed-mcp-spike.md
  - docs/project-control/tasks/code_T004-codebase-engine-abstraction.md
---

# Codebase Understanding Docs Review Index

本文件承接外部 `CARD-05`，用于在四张 `code_T` 任务卡全部完成后执行总审查。

它是 review 材料，不是 task card，不负责定义施工边界。

## Scope

本轮预期只新增或更新文档，不允许：

- 修改 runtime
- 安装依赖
- 接入 CodeGraph 实现
- 修改 `package.json`
- 修改 `pnpm-lock.yaml`

预期目标文档为：

1. `docs/tooling-runtime/codebase-understanding-consensus.md`
2. `docs/tooling-runtime/codebase-engine-benchmark.md`
3. `docs/tooling-runtime/codegraph-managed-mcp-spike.md`
4. `docs/tooling-runtime/codebase-engine-abstraction.md`

本 review 只审上面 4 篇 `docs/tooling-runtime/` 文档，以及它们对应的任务卡回填与台账登记。

不纳入本 review scope 的内容包括：

- dev 分支上其他 runtime / UI / bugfix 改动
- `server/src/**`、`desktop/src/**`、`electron/**`、`packages/**` 的任务外实现变更
- 不属于 `code_T001`、`code_T002`、`code_T003`、`code_T004` 的其他任务卡

这些改动即使与当前工作区同时存在，也不作为本轮 Codebase Understanding docs 审查的通过或不通过依据。

## Scoped Review Conclusion

### Conclusion

- `code_T001` 到 `code_T004` 的 Codebase Understanding 文档施工 scoped review 通过。
- 若按项目 owner 当前汇总口径把“`code_T001-T005` 文档施工”作为一组对外表述，本 review 仅对 `code_T001-T004` 的 4 篇 `docs/tooling-runtime/` 文档给出 scoped pass；`T005` 或其他非本组文档卡仍以各自任务卡和独立 review 为准。

### In-Scope Files

- `docs/tooling-runtime/codebase-understanding-consensus.md`
- `docs/tooling-runtime/codebase-engine-benchmark.md`
- `docs/tooling-runtime/codegraph-managed-mcp-spike.md`
- `docs/tooling-runtime/codebase-engine-abstraction.md`

### Out-Of-Scope Working Tree Changes

- 当前 dev 分支同时包含其他 runtime / UI / bugfix 改动。
- 这些改动不纳入 `code_T001-T004` 文档卡的 scoped 审查范围。
- 它们不能作为本 review 的阻断项，也不能被本 review 自动视为通过。

### Review Decision

- 上述 4 篇文档已完成各自任务卡要求的 docs-only 范围施工与台账回填。
- 本轮 review 不审 runtime 实现、不审 UI 变更、不审 bugfix 代码路径。
- 其他非文档改动必须按对应任务卡单独审查，不得借本 review 一并收口。

### Non-Goals

本 review 明确不做：

- 新增实现
- 安装依赖
- 接入 CodeGraph
- 修改 runtime
- 替代其他任务卡的独立评审

## Review Prompt

```text
请对本次 Codebase Understanding 文档施工进行总审查。

本轮预期只新增/更新文档，不允许修改 runtime、不允许安装依赖、不允许接入 CodeGraph 实现。

预期文件包括：
1. docs/tooling-runtime/codebase-understanding-consensus.md
2. docs/tooling-runtime/codebase-engine-benchmark.md
3. docs/tooling-runtime/codegraph-managed-mcp-spike.md
4. docs/tooling-runtime/codebase-engine-abstraction.md

请重点检查：

一、共识文档
- 是否明确 OpenCode 是 Harness 参考，不是代码索引核心候选。
- 是否明确 CodeGraph 是默认核心候选。
- 是否明确 codebase-memory-mcp 是强图谱对照候选。
- 是否明确 Serena 是语义导航增强候选。
- 是否明确 workspace_inventory / search_text / read_file_slice 不可删除。
- 是否明确图谱结果必须原文核验后进入 Evidence。

二、Benchmark 文档
- 是否包含 CodeGraph / codebase-memory-mcp / Serena 三个候选。
- 是否包含真实仓库测试问题：
  - agentGraph.run 入口
  - Planner -> Normalize -> Policy -> ToolNode -> Evidence 链路
  - selectedToolIds 写入/消费
  - answerReadiness.canAnswer 生成/消费
  - ToolNode 到 executeHarnessInvocation
  - policyNode 影响测试
- 是否包含准确率、工具调用次数、原文位置、Evidence 可用性、Windows 稳定性、索引耗时、重复运行一致性、降级能力等维度。

三、CodeGraph Managed MCP Spike
- 是否对比 Managed MCP server / Node 22.x Worker / 主进程 library 嵌入。
- 是否明确第一阶段推荐 Managed MCP server。
- 是否包含 Windows-only binary、checksum、日志、索引路径、卸载策略。
- 是否包含 telemetry 默认关闭策略。
- 是否包含 workspace 权限和排除规则。
- 是否明确图谱结果需要原文核验。
- 是否包含 Windows-only 生命周期细节：安装检测、启动、停止、重启、崩溃恢复、索引中断、重复启动保护、workspace 切换、日志采集、状态上报。

四、抽象层设计
- 是否预留 codegraph / codebase-memory-mcp / serena / builtin-rg-tsmorph provider。
- 是否包含 index/status/explore/findSymbol/findReferences/impact。
- 是否定义 source path / line range / summary / confidence / limitations / provider 等结果合同。
- 是否明确没有 source path / line range 的结果只能作为线索，不能作为高置信 Evidence。
- 是否明确 CodebaseContext -> 原文核验 -> EvidenceItem 接入关系。
- 是否明确第一阶段只对 Agent 暴露 codebase_explore。
- 是否包含降级策略。

五、禁止项
- 是否没有修改 Agent Runtime。
- 是否没有修改 Planner / Normalize / Policy / ToolNode / Evidence。
- 是否没有新增运行时代码。
- 是否没有安装依赖。
- 是否没有修改 package.json / lockfile。
- 是否没有把 CodeGraph 直接接入实现。

请输出：
1. 总结论：通过 / 不通过
2. 每个文档的审查结果
3. 阻断问题
4. 非阻断建议
5. 需要整改的最小补丁建议
6. 可核验文件路径和关键段落
```

## Immediate Fail Conditions

- 修改运行时代码
- 接入 CodeGraph 实现
- 安装依赖
- 修改 lockfile
- 删除基础工具
- 改 Agent Graph 主循环
- 把外部 MCP 原生工具直接裸露给 Planner
