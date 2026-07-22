# SKILL 模块总纲

Status: Current
Owner: chat / runtime / docs
Last verified: 2026-07-22
Layer: raw-source
Module: SKILL
Feature: SkillSystem
Doc Type: overview
Canonical: true
Related:
  - ./skill-runtime-design.md
  - ../harness/agentgraph-harness-protocol.md
  - ../tooling-runtime/harness-runtime-design.md
  - ../tooling-runtime/tools-protocol.md
  - ../development/agent-observability.md

## 单点真相范围

这页定义当前项目里 `Skill` 的正式产品和运行时边界。

核心定义：

> `Skill = 内部状态 + 多工具编排 + 业务语义封装`。

这一定义自 `2026-07-22` 起替代此前“记忆型工作动作 / skill-driven memory”方向。

详细运行时设计见：

- `skill-runtime-design.md`

## 当前结论

`Skill` 是一个有生命周期的业务能力单元。

它同时具备三部分：

1. **内部状态**：维护当前任务阶段、资源引用、中间结果、产物、checkpoint、错误与恢复状态。
2. **多工具编排**：组合 Harness / MCP / Runtime 已有工具完成一个完整业务目标。
3. **业务语义封装**：向 Agent 暴露高层业务能力和领域判断，而不是把一长串底层工具直接推给上层处理。

层级：

```text
Agent
  ↓
Skill
  ↓
Tool / MCP / Runtime
```

- `Tool`：原子执行能力。
- `Skill`：有状态的业务能力。
- `Agent`：目标理解、能力选择和跨 Skill / Tool 协调。

## Skill 不是什么

Skill 不是：

- 一组纯 Prompt 文件
- 一个固定 `A -> B -> C` Workflow
- 一个 MCP server 包装
- 一个 Tool alias
- 一个新的 Agent
- 一个独立 Planner
- 一个长期 Memory 系统
- 一个新的 Harness / approval / sandbox / trace runtime

Skill 可以包含 Prompt，也可以调用 Memory，但它们都不等于 Skill 本身。

## Code 与 Prompt 的分工

Skill 内部明确区分确定性代码和概率性模型语义。

### Code / Runtime

负责“必须正确”的部分：

- 能做什么
- 怎么执行
- 状态机和合法迁移
- 工具调用边界
- 参数校验
- 权限与 side effect 边界
- checkpoint
- cancel / resume
- 错误处理和恢复
- artifact / state 持久化

### Prompt / Semantic Policy

负责“需要理解和判断”的部分：

- 什么时候做
- 为什么做
- 模糊业务目标怎么理解
- 多个合法动作中怎么选
- 怎样才算做得好
- 当前结果是否满足业务质量标准

原则：

> 必须正确的东西写代码；需要理解和判断的东西交给模型。

## 和相邻模块的边界

### Skill vs Tool

`Tool` 是单个执行能力。

例如：

- `read_open`
- `edit_file`
- `web_search`
- `terminal_session`

Skill 可以组合多个 Tool，并在多步执行期间维护自己的业务状态。

一句话：

- Tool = 原子动作
- Skill = 有状态的业务能力

### Skill vs Agent

Agent 负责用户总目标和跨能力决策。

Skill 只负责自己业务域内的状态、语义和工具组合。

Skill 可以多步运行，但不拥有第二套 Agent Loop。

当前原则：

```text
Parent Agent Loop 是唯一控制循环
Skill Runtime 是被它驱动的有状态业务层
```

### Skill vs Workflow

Workflow 更适合表达固定、确定流程。

Skill 允许：

- 代码提供稳定骨架
- state 限定合法动作
- 模型根据业务语义选择局部路径

所以 Skill 可以包含确定性流程节点，但不能被缩减成一张死流程图。

### Skill vs MCP

MCP 是能力接入协议。

Skill 可以调用 MCP Tool，但：

- 不复制 MCP Registry
- 不复制连接和鉴权
- 不自己执行 MCP 协议
- 仍然通过现有 Harness / MCP runtime 使用能力

### Skill vs Memory

Memory 是长期信息对象或外部上下文能力。

Skill 的内部状态不是长期 Memory。

区别：

```text
Skill State
= 服务于一次 Skill instance 的运行状态

Memory
= 可跨任务、跨实例继续使用的长期信息
```

Skill 可以显式读取或写入 Memory，但 Memory 不属于 Skill 的基础定义。

### Skill vs MicroAPP

MicroAPP 是产品入口和独立业务模块形态，可能包含 UI、平台接入和 Runtime。

Skill 是 Agent 可调用的业务能力单元。

两者可以配合：

```text
Office MicroAPP
  提供 Office runtime / UI / debug surface

Office Skill
  封装“合同审阅”“文档整理”“PPT 美化”等 Agent 业务能力
```

MicroAPP 不自动等于 Skill，Skill 也不要求必须有 MicroAPP。

## 当前运行时边界

Skill Runtime 只新增 Skill 自己必须拥有的部分：

- SkillDefinition registry
- SkillInstance
- internal state
- semantic policy
- allowed tool surface
- state reducer / lifecycle
- checkpoint
- cancel / resume
- version binding

其余全部复用现有系统：

```text
Planner / Agent     -> 继续使用现有 Agent 主循环
Policy              -> 继续负责执行策略和 approval 边界
ToolNode             -> 继续执行 frozen tool call
Harness              -> 继续负责真实 Tool invocation
MCP                  -> 继续负责外部能力接入
Observability        -> 继续使用现有 trace / artifact 体系
```

Skill 不允许另起一套平行基础设施。

## 多工具编排原则

Skill 不写死单一路径。

推荐模型：

```text
业务目标
  ↓
Skill State
  ↓
合法工具集合 + 业务语义
  ↓
Agent / 模型选择下一步
  ↓
Policy -> ToolNode -> Harness
  ↓
Tool Result / Evidence
  ↓
Skill 更新 State
```

Skill 可以定义硬约束，例如：

- 保存前必须完成必要校验
- 某阶段只能使用特定工具
- 某类 side effect 必须经过 approval

但“用户真实想要什么”“几个合法动作下一步选哪个”“质量是否足够”等判断仍交给模型。

## 内部状态原则

SkillInstance 的状态只保存恢复业务执行真正需要的信息。

典型内容：

- 当前 stage
- 输入 / resource refs
- 已确认中间结果
- pending actions / changes
- artifact refs
- checkpoint
- error / recovery marker

不应默认把这些全部塞进 state：

- 完整聊天历史
- 全量 Tool Result
- 全量 execution trace
- 大文件内容

它们应继续由现有上下文、trace、artifact 或文件系统承载，Skill 保存引用。

## 第一类适合 Skill 的业务

Skill 最适合“需要多个工具协作，并且执行过程中需要保留业务状态”的任务。

例如：

- Office 文档整理
- 合同审阅
- PPT 美化
- 代码库迁移
- 发布流程
- 数据分析与报告生成

一个 `office_document_edit` Skill 可能：

```text
inspect_document
read_content
render_preview
edit_content
verify_document
save_document
```

但实际顺序根据文档状态和用户目标动态变化，而不是固定 Workflow。

## 当前硬规则

1. `Skill = 内部状态 + 多工具编排 + 业务语义封装` 是当前唯一正式定义。
2. Skill 不拥有独立 Agent Loop。
3. Skill 不替代 Planner / Policy / ToolNode / Harness。
4. Tool 执行必须复用现有 Harness / MCP / Runtime。
5. Skill 不能扩大 Tool 原有权限。
6. Skill state 与长期 Memory 分离。
7. 代码负责确定性和硬边界，Prompt 负责业务理解和概率性判断。
8. V1 不建设 Skill Marketplace、Workflow DSL 或通用 state migration framework。
9. 运行中的 SkillInstance 固定绑定 Skill version，不热切换定义。
10. 旧 memory-skill 设计不再驱动实现。

## 已废弃的旧设计

以下内容属于上一版 Skill 思路，不再作为当前实现依据：

- `skill-memory-poc.md`
- `roadmap.md` 中的 memory skill card 路线
- `catalog/` 下 `save_thread_memory` / `save_preference` / `save_decision` 卡片
- `schema/skill-card.schema.md` 旧 card schema
- `eval/` 下旧 memory skill 评估用例

即使旧文件仍保留历史内容，也必须以本页和 `skill-runtime-design.md` 为当前真相源。

## 推荐阅读顺序

1. `README.md`
2. `skill-runtime-design.md`
3. `../harness/agentgraph-harness-protocol.md`
4. `../tooling-runtime/harness-runtime-design.md`
5. `../tooling-runtime/tools-protocol.md`
6. `../development/agent-observability.md`

## Code Anchors

- `server/src/agent/graph/build-graph.ts`
- `server/src/harness/registry.ts`
- `server/src/mcp/routes.ts`

Skill Runtime 的最终源码目录在实现任务批准后再确定，不在总纲里提前制造新结构。
