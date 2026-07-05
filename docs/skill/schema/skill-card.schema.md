# Skill Card Schema

Status: Current
Owner: docs / chat / runtime
Last verified: 2026-07-06
Layer: raw-source
Module: SKILL
Feature: SkillCardSchema
Doc Type: current-contract
Canonical: true
Related:
  - ../README.md
  - ../skill-memory-poc.md

## 单点真相范围

这页定义 `docs/skill/catalog/` 下 skill card 的最小结构。

它覆盖：

- skill card 必填字段
- 第一批 thread-level memory POC 的写法约束
- `SKILL` 和相邻模块的边界约束

它不覆盖：

- runtime 实现
- 数据库 schema
- AgentGraph 节点设计

## 结论先说

`SKILL` 是助手内部的工作动作定义层。

当前项目第一批 skill card 只用于描述 thread-level memory POC，不等同于：

- MCP server
- Harness tool
- MicroAPP
- skill marketplace 条目

## 适用范围

当前 schema 只适用于第一批记忆型 skill：

- `save-thread-memory`
- `save-preference`
- `save-decision`

这些 skill 的共同硬约束是：

1. `triggerMode` 只能是显式触发或建议触发，不能静默后台触发。
2. `requiresUserConfirmation` 必须为 `true`。
3. 写回对象必须可见、可编辑、可清空。
4. skill card 只描述工作动作，不描述底层执行器实现。
5. skill card 不能要求修改 Agent 主链、Harness、MCP、ToolNode、Policy、Planner。

## 必填字段

每个 skill card 必须包含这些字段：

### `id`

稳定标识符。

要求：

- kebab-case
- 在 `docs/skill/catalog/` 内唯一

### `title`

用户和产品都能看懂的中文标题。

### `status`

当前建议值：

- `planned`
- `active`
- `historical`

第一批 POC 默认写 `planned`。

### `scope`

定义 skill 作用域。

第一批只允许：

- `thread-level-memory-poc`

### `triggerMode`

定义 skill 的触发方式。

当前允许值：

- `explicit`
- `suggested-with-confirmation`

说明：

- `explicit` 表示用户明确提出“记住 / 保存 / 沉淀”
- `suggested-with-confirmation` 表示助手可以建议，但不能自己写入

### `inputs`

定义 skill 读取什么。

至少要写清：

- 来源是什么
- 读哪些线程内上下文
- 哪些内容不应被当成输入

### `outputs`

定义 skill 产出什么结构化结果。

第一批建议写清：

- 草案文本
- 条目类型
- 建议写回位置

### `writes`

定义 skill 计划写回什么对象。

第一批只允许写线程级可见对象，不允许写黑盒长期存储。

### `requiresUserConfirmation`

布尔值。

第一批必须是：

```yaml
requiresUserConfirmation: true
```

### `agentHarnessImpact`

描述它对现有 agent / harness 的影响边界。

第一批必须明确：

- 不新增 runtime
- 不改 Agent 主链
- 不要求直接调用 Harness tool
- 不要求改 MCP 协议

### `trigger examples`

列出应该触发 skill 的对话例子。

### `non-trigger examples`

列出不应该触发 skill 的对话例子。

### `acceptance criteria`

列出这张 skill card 被接受时必须满足的标准。

至少应覆盖：

- 触发边界清楚
- 需要用户确认
- 写回对象可见、可编辑、可清空
- 不影响 Agent 主链

## 建议模板

```yaml
id: <required>
title: <required>
status: planned | active | historical
scope: thread-level-memory-poc
triggerMode: explicit | suggested-with-confirmation
inputs:
  - <required>
outputs:
  - <required>
writes:
  - <required>
requiresUserConfirmation: true
agentHarnessImpact:
  - no-agent-main-chain-change
  - no-harness-runtime-change
  - no-direct-tool-requirement
  - no-mcp-contract-change
trigger examples:
  - <required>
non-trigger examples:
  - <required>
acceptance criteria:
  - <required>
```

## 字段解释原则

### `inputs` 写什么

写“这个动作需要哪些线程内信息”。

不要写：

- 模型内部推理细节
- Planner / Policy 选择策略
- 底层 tool 调度细节

### `outputs` 写什么

写“生成了什么候选结果供用户确认”。

不要写：

- 已经落库的结果
- 自动写入后的黑盒状态

### `writes` 写什么

写“确认后，用户可见对象会被怎样更新”。

第一批建议围绕：

- thread memory 文本区
- thread memory 中的 preference 条目
- thread memory 中的 decision 条目

### `agentHarnessImpact` 写什么

写“这个 skill card 对现有运行时边界的要求”。

如果一张卡片需要：

- 新增 AgentGraph 节点
- 修改 Harness 注册表
- 修改 MCP 路由
- 新增 ToolNode 语义

那它就超出当前 docs-only POC 范围。

## 当前阶段的禁止项

当前 skill card 不允许包含这些设计：

1. 静默写入长期记忆
2. 自动绕过用户确认
3. 直接把 `SKILL` 设计成 tool marketplace
4. 直接把 `SKILL` 映射成 MCP server
5. 把 skill card 写成某个平台接入方案
6. 要求改动 AgentGraph / Harness / MCP / ToolNode / Policy / Planner

## 当前结论

这套 schema 的目的不是把 skill 直接实现出来，而是先把：

- 动作边界
- 触发条件
- 写回对象
- 用户确认要求
- 对主链的影响边界

定义成可评审、可对比、可演进的基础数据。
