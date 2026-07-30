---
status: archived
owner: docs / runtime
last_verified: 2026-07-30
layer: historical
module: Tool
feature: ToolArchive
Doc Type: archive
canonical: true
related:
  - ../../TOOL_CURRENT_TRUTH.md
  - ../../harness/README.md
  - ../../tooling-runtime/README.md
  - ../../tooling-runtime/tools-protocol.md
---

# Tool 历史归档

> 这里保存 Mira Tool / Harness 从六月 Read-first 设计、核心四域矩阵、Action Profile 整改，到 CodeGraph 接入前方案的演进资料。它们用于解释历史，不定义当前运行时。

## 当前真相入口

1. [[TOOL_CURRENT_TRUTH]]：当前 Tool 总真相；
2. [[harness/README]]：Harness 当前控制平面；
3. [[harness/agentgraph-harness-protocol]]：Agent concrete invocation 与 Evidence；
4. [[tooling-runtime/README]]：Tool 模块入口；
5. [[tooling-runtime/tools-protocol]]：当前技术协议。

## 本次归档范围

### 旧总入口与总协议

- `tooling-runtime/README.md`：2026-07-09 的旧 Tool 阅读入口；
- `tooling-runtime/tools-protocol.md`：2026-06-27 的旧总协议；
- `agent/AGENT_RUNTIME_TOOLING_SSOT.md`：2026-07-22 工作线程后的 Agent / Tooling 混合 SSOT。

### 六月核心工具设计与整改

- `tooling-runtime/harness-runtime-design.md`：Read-first Harness 设计与旧落地状态；
- `tooling-runtime/core-tool-matrix-review.md`：旧 Read/Edit/Search/Terminal 矩阵评审；
- `tooling-runtime/core-tool-rectification-ledger.md`：旧整改台账；
- `tooling-runtime/read-skill-design.md`：六个 `read_*` primitive 的旧公共面设计；
- `tooling-runtime/terminal-capability-checklist.md`：早期 workspace-only Terminal checklist。

### CodeGraph 进入实现前方案

- `tooling-runtime/codebase-understanding-consensus.md`；
- `tooling-runtime/codebase-engine-benchmark.md`；
- `tooling-runtime/codegraph-managed-mcp-spike.md`；
- `tooling-runtime/codebase-engine-abstraction.md`；
- `tooling-runtime/codegraph-wrapper-contract.md`；
- `tooling-runtime/codegraph-managed-mcp-runtime-implementation-plan.md`。

这些材料记录了从候选、benchmark、Managed MCP spike、wrapper contract 到 implementation plan 的约束来源。当前 `codebase_explore` 已经进入实际 runtime，因此这些页面不再拥有“尚未实现”的当前解释权。

## 为什么归档

这些文档至少满足一项：

- 公共 Read / Edit 工具面已经改变；
- grep、delete、move 等结论已被代码推翻；
- Terminal workspace/sandbox 描述与 Host Runtime 不符；
- Tool Exposure 已改为 <=20 全量、>20 前 20；
- CodeGraph 已经进入实际 runtime；
- 仍保留 Current / Active / Canonical 会误导施工；
- Agent 与 Tool 合同已经拆分到各自 current truth。

## 兼容入口

原路径保留轻量 `superseded` 页：

- 阻止旧搜索结果和旧链接把正文当成当前合同；
- 指向 Tool 当前真相；
- 指向本归档索引；
- 不删除历史证据。

## 不在本次归档范围

- `docs/project-control/tasks/`；
- `docs/project-control/reviews/`；
- `docs/project-control/testEvidence/`；
- 当前 Agent / Harness / Tool / Skill 合同；
- 当前活跃缺陷和恢复记录；
- 当前真实操作 runbook。

施工与测试证据继续保留原位，但其结论不能覆盖当前代码和 [[TOOL_CURRENT_TRUTH]]。
