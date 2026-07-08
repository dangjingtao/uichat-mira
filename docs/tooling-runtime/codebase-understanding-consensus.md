---
status: current
owner: docs
last_verified: 2026-07-08
layer: wiki
module: Tool
feature: CodebaseUnderstanding
doc_type: current-contract
canonical: true
related:
  - README.md
  - tools-protocol.md
  - harness-runtime-design.md
  - ../project-control/tasks/code_T001-codebase-understanding-consensus-doc-integration.md
  - ../project-control/reviews/codebase-understanding-docs-review-index.md
---

# Codebase Understanding Consensus

## 这页干什么

这页记录当前仓库对“代码库理解能力”的阶段性共识。

当前阶段只做文档对齐：

- 不修改 Runtime
- 不安装依赖
- 不接入 CodeGraph、`codebase-memory-mcp` 或 Serena
- 不改变 Agent Runtime、Planner、Normalize、Policy、ToolNode、Evidence 主循环
- 不新增或替换现有工具执行路径

后续如果进入实现，必须另开任务卡，并重新确认运行时边界、权限、索引路径、降级策略和验证方式。

## 名词定位

### OpenCode

OpenCode 当前只作为 Harness / Agent 工程实践参考。

它可以帮助我们理解成熟 agent harness 如何组织工具调用、执行观测、人工确认和任务循环，但它不是当前代码索引核心候选，也不应该被直接等同为“代码库理解引擎”。

### CodeGraph

CodeGraph 是当前默认的代码图谱核心候选。

它的候选定位是：为仓库建立可查询的结构化图谱，支持符号、引用、调用关系、影响面和跨文件导航等问题。它适合承担“先快速定位候选代码区域”的职责，但不能单独成为 Evidence 来源。

### `codebase-memory-mcp`

`codebase-memory-mcp` 是强图谱对照候选。

它的价值在于提供另一种图谱化代码理解路径，用来和 CodeGraph 对比索引模型、查询能力、结果解释性、Windows 稳定性、权限边界和降级能力。它不是当前阶段的默认接入对象。

### Serena

Serena 是语义导航增强候选。

它更适合作为代码阅读、语义跳转、局部理解和符号级导航的增强层。它可以补足纯文本搜索和结构化图谱之间的体验差距，但不替代 Harness 的权限、调度、Trace、Evidence 和最终裁决职责。

## 不可删除的基础能力

无论后续是否引入 CodeGraph、`codebase-memory-mcp` 或 Serena，以下基础能力都不可删除：

- `workspace_inventory`
- `search_text`
- `read_file_slice`

原因：

- 它们是最小可解释、最容易审计的仓库读取能力。
- 它们提供图谱索引失败、索引过期、二进制不可用、权限不足或查询质量不足时的降级路径。
- 它们让 Agent 可以直接回到文件原文、行号和上下文，而不是只依赖外部引擎摘要。
- 它们是 Evidence 原文核验的底座。

新增图谱或语义工具只能增强这些基础能力，不能替换它们。

## Evidence 原文核验规则

图谱、索引或语义导航工具返回的结果，默认只能进入候选事实池。

进入 Evidence 前必须满足：

1. 结果包含可定位的 source path。
2. 结果包含可核验的 line range，或能被后续读取映射到具体行。
3. Agent 使用 `read_file_slice` 或同等原文读取能力回到仓库文件核验。
4. Evidence 中保存的是已核验的原文位置、必要摘录和结论，不是图谱工具的裸摘要。

如果图谱结果无法回到原文位置，或原文与图谱摘要不一致，则不得把该图谱结论作为已证实 Evidence。

## Harness 保留的职责

即使 CodeGraph 未来成为核心代码理解工具，Harness 仍保留以下职责：

- 权限：决定哪些 workspace、路径、文件类型和操作允许被访问。
- 调度：决定何时调用图谱、何时回退到文本搜索、何时读取原文。
- Trace：记录工具调用、输入输出摘要、失败原因和关键决策。
- Evidence：只接收经过原文核验的证据，不接收未验证的图谱结论。
- 降级：在索引缺失、结果质量不足、工具不可用或权限受限时回到基础读取能力。
- 最终裁决：由 Harness / Agent 主链综合工具结果、原文证据、任务目标和风险边界后决定下一步。

CodeGraph 可以成为强能力工具，但不能成为运行时主控层。

## 当前阶段边界

当前阶段只完成共识文档，不做实现。

明确不做：

- 不安装 CodeGraph、`codebase-memory-mcp`、Serena 或相关依赖。
- 不新增 MCP server。
- 不修改 `package.json` 或 `pnpm-lock.yaml`。
- 不修改 `server/src/**`、`desktop/src/**`、`electron/**`、`packages/**`。
- 不修改测试文件。
- 不改变现有 Planner、Normalize、Policy、ToolNode、Evidence 链路。
- 不把外部工具原生接口直接暴露给 Planner。

后续实现必须先经过 benchmark、Managed MCP spike 和抽象层设计文档评审，再按任务卡进入代码施工。

## 当前结论

当前项目对代码库理解能力的共识是：

- OpenCode 是 Harness 参考，不是代码索引核心候选。
- CodeGraph 是默认核心候选，但结果必须回到原文核验。
- `codebase-memory-mcp` 是强图谱对照候选。
- Serena 是语义导航增强候选。
- `workspace_inventory`、`search_text`、`read_file_slice` 是不可删除的基础能力。
- Harness 始终保留权限、调度、Trace、Evidence、降级和最终裁决职责。
- 本阶段只做文档，不改 Runtime，不装依赖，不接入实现。
