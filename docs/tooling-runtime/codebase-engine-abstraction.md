---
status: planned
owner: docs
last_verified: 2026-07-08
layer: wiki
module: Tool
feature: CodebaseEngineAbstraction
doc_type: design
canonical: true
related:
  - README.md
  - codebase-understanding-consensus.md
  - codebase-engine-benchmark.md
  - codegraph-managed-mcp-spike.md
  - tools-protocol.md
  - harness-runtime-design.md
  - ../project-control/tasks/code_T004-codebase-engine-abstraction.md
  - ../project-control/reviews/codebase-understanding-docs-review-index.md
---

# Codebase Engine Abstraction

## Purpose

这页定义代码库理解引擎进入实现前的抽象层设计。

目标不是立刻接入 CodeGraph、`codebase-memory-mcp`、Serena 或新的内建引擎，而是先把“Agent 以后该通过什么统一接口拿代码库理解结果、什么结果能进入 Evidence、失败时如何降级”说清楚。

当前阶段只做文档设计：

- 不修改 runtime
- 不新增 TypeScript 接口文件
- 不安装依赖
- 不接入 CodeGraph
- 不修改 Agent Runtime、Planner、Normalize、Policy、ToolNode、Evidence 主链

## Abstraction Goal

代码库理解层后续要统一四类 provider：

- `codegraph`
- `codebase-memory-mcp`
- `serena`
- `builtin-rg-tsmorph`

统一抽象的目标不是抹平所有实现差异，而是把 Agent 真正需要的稳定合同收敛出来：

1. 对 Agent 暴露一致的探索入口，而不是暴露每个 provider 的原生命令集合。
2. 把 source path、line range、confidence、limitations 等可审计字段变成统一结果合同。
3. 保留 provider 差异，例如索引能力、结构化查询能力、语义导航能力，但不让这些差异直接污染 Planner。
4. 明确保留 `workspace_inventory`、`search_text`、`read_file_slice` 作为原文核验与降级底座。

## Provider Roles

### `codegraph`

定位：结构化代码图谱主候选。

适合承担：

- 索引状态查询
- 符号、引用、调用关系导航
- 跨文件影响面探索

### `codebase-memory-mcp`

定位：强图谱对照 provider。

适合承担：

- 与 `codegraph` 对照图谱结果
- 提供另一种图谱索引与查询路径
- 在默认核心 provider 不稳定时作为候选降级目标

### `serena`

定位：语义导航增强 provider。

适合承担：

- 符号级阅读
- 局部语义跳转
- 小范围结构理解补强

### `builtin-rg-tsmorph`

定位：仓库内建基础 provider。

它不是“临时凑合方案”，而是必须长期保留的基础能力层，组合：

- `rg` / `search_text`
- `read_file_slice`
- `workspace_inventory`
- 必要时的 `tsmorph` 级结构读取

它负责：

- 在没有外部索引时提供最小可用能力
- 在图谱失败、索引 stale 或结果不可核验时承担回退路径
- 为原文核验提供最后一跳

## Phase 1 Exposure Rule

第一阶段对 Agent 只暴露一个稳定能力：

- `codebase_explore`

第一阶段不直接把 `index`、`status`、`findSymbol`、`findReferences`、`impact` 这些原子接口裸露给 Planner 或普通 Agent 规划层。

原因：

- 先把调用面压到一个入口，更容易控制权限、上下文体积和失败降级。
- 避免 Planner 在 provider 细节上过度耦合。
- 让结构化结果先经过统一裁剪，再进入 Agent 上下文。

后续如果需要更细粒度接口，也应由 runtime 内部消费，不应直接把 provider 原生命令平铺给上层。

## Interface Draft

以下接口是抽象层草案，不代表当前仓库已经实现。

### `index`

用途：

- 请求建立索引
- 请求增量更新索引
- 返回索引任务句柄或状态摘要

典型输入：

- workspace root
- include / exclude policy
- provider config

典型输出：

- provider
- engine
- workspace id
- index state
- started at / finished at
- limitations

### `status`

用途：

- 查询 provider 当前可用性
- 查询 workspace 对应索引状态
- 查询是否 stale、degraded、failed

典型输出：

- provider
- engine
- availability
- index freshness
- last error
- limitations

### `explore`

用途：

- 面向 Agent 的统一探索入口
- 根据自然语言问题、symbol hint、path hint 或 topic hint 返回候选上下文

典型输入：

- question
- optional symbol hint
- optional path hint
- optional scope

典型输出：

- ranked result list
- provider summary
- follow-up suggestions
- degradation signal

### `findSymbol`

用途：

- 按符号名、限定名或文件范围定位符号定义

典型输出：

- symbol matches
- source path
- line range
- symbol kind
- confidence

### `findReferences`

用途：

- 查找符号引用、调用点、使用点

典型输出：

- reference matches
- source path
- line range
- reference role
- confidence

### `impact`

用途：

- 评估字段、函数、节点、策略修改的影响面

典型输出：

- impacted files
- impacted symbols
- downstream tests
- confidence
- limitations

## Unified Result Contract

无论底层 provider 是 `codegraph`、`codebase-memory-mcp`、`serena` 还是 `builtin-rg-tsmorph`，抽象层输出都至少要带以下字段：

- `source path`
- `line range`
- `summary`
- `confidence`
- `limitations`
- `engine/provider`
- `raw references`

建议语义如下：

| Field | Meaning | Why It Exists |
| --- | --- | --- |
| `source path` | 结果指向的仓库文件路径 | 没有路径就无法回到原文核验 |
| `line range` | 结果对应的原文行区间 | 没有行号就无法稳定定位 Evidence |
| `summary` | 对结果的最小必要摘要 | 让 Agent 不必先读完整文件 |
| `confidence` | provider 对结果可靠性的自评或 runtime 归一化分值 | 帮助 runtime 决定是否继续核验 |
| `limitations` | 已知缺口、歧义、索引 stale、局部解析失败等说明 | 防止把不确定结果当成确定事实 |
| `engine/provider` | 结果来自哪个引擎与 provider | 方便 trace、对照评测和故障定位 |
| `raw references` | 原始引用、symbol id、query hit、graph edge 或 grep hit | 便于调试和二次核验 |

## Evidence Gate

没有 `source path` 或 `line range` 的结果，只能作为线索，不能作为高置信 Evidence。

这条规则是硬门槛，不因 provider 类型改变：

- 图谱结果缺路径，只能当作候选线索
- 语义结果缺行号，只能当作候选线索
- 自然语言摘要回不到原文，只能当作候选线索

只有当结果能稳定定位到原文，并经 `read_file_slice` 或等价原文读取能力核验后，才允许进入 Evidence。

## Integration Path

抽象层与 Evidence 的关系必须明确为：

`CodebaseContext -> 原文核验 -> EvidenceItem`

含义：

1. `CodebaseContext` 是探索阶段的候选上下文容器，收纳 provider 返回的候选文件、符号、关系和摘要。
2. 原文核验阶段使用 `read_file_slice` 或等价基础读取能力，把候选结果映射回真实文件和行号。
3. 只有核验通过的内容才转成 `EvidenceItem`。

换句话说，抽象层负责提供“去哪里看”的高质量建议，不负责直接宣布“这已经是证据”。

## Result Shapes By Stage

### `CodebaseContext`

用于探索阶段，至少可包含：

- candidate files
- candidate symbols
- candidate references
- provider summary
- limitations
- degradation notes

### Verified Evidence Input

用于原文核验阶段，至少可包含：

- resolved source path
- resolved line range
- raw excerpt
- provider summary
- mismatch notes

### `EvidenceItem`

进入 Evidence 后应只保留已核验事实，例如：

- verified source path
- verified line range
- verified excerpt
- verified summary
- provider trace pointer

如果 provider 摘要与原文不一致，应记录 rejected candidate 或 mismatch，不得静默覆盖。

## Degradation Strategy

抽象层至少要定义三类降级。

### 引擎降级

当默认 provider 不可用时：

- `codegraph` 可降级到 `codebase-memory-mcp`
- 结构化图谱 provider 都不可用时，降级到 `serena`
- 再失败时降级到 `builtin-rg-tsmorph`

降级必须可观测，不能静默换引擎。

### 结构工具失败降级

当 provider 可用，但结构化查询失败时：

- `findSymbol` 失败可退到 `search_text`
- `findReferences` 失败可退到 grep + 原文切片
- `impact` 失败可退到“候选引用集合 + 明确 limitations”

这类降级不代表问题已解决，只代表 runtime 还保留继续探索的能力。

### 索引 Stale 降级

当 provider 状态为 `stale`、`indexing`、`degraded` 或索引 workspace 不匹配时：

- 不把陈旧索引结果直接作为高置信结论
- 优先回到 `builtin-rg-tsmorph`
- 如有必要只返回“索引状态异常，需要原文读取补查”

## Runtime Boundary

抽象层必须服从当前仓库已经确认的运行时边界：

- provider 权限由 Harness / runtime 控制
- renderer 不直接接触 provider 原生接口
- Planner 不直接调度 provider 私有命令
- 原文核验底座仍是仓库内读取能力

抽象层是 runtime 内部治理接口，不是给上层自由拼装 provider 指令的开放市场。

## Recommended Phase Order

建议顺序：

1. 先完成共识文档
2. 再完成 benchmark
3. 再完成 Managed MCP spike
4. 再完成抽象层设计
5. 评审通过后另开实现任务

这能避免在 provider、结果合同、Evidence 门槛和降级策略还没定清前，直接把外部引擎接进主链。

## Out Of Scope

这页明确不做：

- 新增运行时代码
- 新增 TypeScript interface 文件
- 把 provider 直接接入 Agent Runtime
- 让 Planner 直接消费 provider 原生命令
- 修改 `package.json`
- 安装依赖
