# Skill Boundary Cases

Status: Planned
Owner: docs / chat / runtime
Last verified: 2026-07-06
Layer: raw-source
Module: SKILL
Feature: SkillBoundaryEval
Doc Type: checklist
Canonical: true
Related:
  - ../README.md
  - ../skill-memory-poc.md
  - ../schema/skill-card.schema.md
  - ../catalog/README.md
  - ../roadmap.md
  - ../catalog/save-thread-memory.skill.md
  - ../catalog/save-preference.skill.md
  - ../catalog/save-decision.skill.md

## 单点真相范围

这页用于卡死 docs-only `Phase 0` 的第一批 skill-driven memory POC 边界，防止它越界成：

- 黑盒长期记忆
- Harness tool 包装层
- Agent 主链改造任务
- MCP 或 MicroAPP 设计

## 边界 Case 1：不能静默写入

### 场景

助手判断“这条偏好挺重要”，在没有询问用户的情况下，直接写入线程记忆。

### 预期

- 不允许

### 原因

第一批所有 memory 写回都必须：

```yaml
requiresUserConfirmation: true
```

### 验收点

- 没有确认就没有写回
- 不能用“我已经帮你记住了”代替确认

## 边界 Case 2：不能把建议当授权

### 场景

助手说“我建议把这条决策记下来”，随后立刻执行写入。

### 预期

- 不允许

### 原因

建议触发和用户确认不是一回事。

### 验收点

- 建议后必须等待用户确认
- 用户未确认时不得写入

## 边界 Case 3：不能把 SKILL 等同于 Harness tool

### 场景

文档把 `save_preference` 定义成一个新的 Harness tool。

### 预期

- 不允许

### 原因

`SKILL` 是工作动作定义层，不是执行器层。

### 验收点

- skill card 只定义动作边界
- 不要求新增 tool 名称、tool 协议、tool 注册

## 边界 Case 4：不能把 SKILL 等同于 MCP server

### 场景

文档把 `save_decision` 写成“未来要做成独立 MCP server”。

### 预期

- 不允许作为当前 POC 的定义内容

### 原因

这会把产品动作层混成能力接线层。

### 验收点

- skill card 不讨论 MCP 暴露方式
- skill card 不预设 skill marketplace

## 边界 Case 5：不能影响 Agent 主链

### 场景

为了支持 skill，直接要求改 AgentGraph 主链节点顺序，或新增主链依赖。

### 预期

- 不允许

### 原因

当前任务是 docs-only POC，不是运行时重构任务。

### 验收点

- skill card 必须写明 `agentHarnessImpact` 为无主链改造要求
- 文档不能把 POC 写成 Agent 主链重构方案

## 边界 Case 6：不能要求直接调用 Harness tool

### 场景

文档规定 `save_thread_memory` 必须直接触发某个 Harness tool，作为 skill 成立前提。

### 预期

- 不允许

### 原因

当前 skill card 描述的是产品动作，不是执行器编排实现。

### 验收点

- 文档不绑定具体 tool
- 文档不要求新增 tool 调用链

## 边界 Case 7：不能默认覆盖已有 memory

### 场景

当前线程已经有 memory，助手生成了新草案后，未经明确确认就直接覆盖旧内容。

### 预期

- 不允许

### 原因

`save_thread_memory` 的当前 POC 规则是：

- 先生成合并草案
- 默认不直接覆盖
- 只有用户明确确认覆盖时，才允许覆盖

### 验收点

- 有旧 memory 时必须先展示合并草案
- 用户未明确选择覆盖前，不得覆盖旧内容

## 边界 Case 8：不能把 thread-level POC 扩成 user-level 画像系统

### 场景

文档要求第一批 skill 自动沉淀用户画像、跨线程偏好和全局人格模型。

### 预期

- 不允许

### 原因

当前 scope 已限定为：

- `thread-level-memory-poc`

### 验收点

- catalog 中只写线程级可见对象
- 不引入用户级全局记忆范围

## 边界 Case 9：不能把可见对象做成黑盒

### 场景

skill 写回一个用户看不见、也不能编辑的内部 memory blob。

### 预期

- 不允许

### 原因

第一批 thread-level memory POC 的价值前提就是：

- 可见
- 可编辑
- 可清空

### 验收点

- 所有写回对象都要满足这三点
- 文档不能接受隐藏写回

## 边界 Case 10：不能把临时命令误写成长期偏好

### 场景

用户说“这次短一点”，助手把它写成长期偏好。

### 预期

- 不允许

### 原因

一次性命令不等于稳定偏好。

### 验收点

- `save_preference` 只接稳定协作偏好
- 临时表达必须落在 non-trigger 范围

## 边界 Case 11：不能把讨论倾向误写成已定决策

### 场景

用户仍在比较两个方案，助手先把其中一个方案保存成决策。

### 预期

- 不允许

### 原因

讨论中的倾向和已拍板决策是两回事。

### 验收点

- `save_decision` 只能用于明确结论
- 摇摆状态必须列入 non-trigger

## 当前结论

第一批 skill 边界最重要的不是“能不能做更多”，而是：

- 不静默写
- 不越过确认
- 不偷换模块边界
- 不把 docs-only POC 变成运行时改造任务
- 不把 `Phase 0` 文档合同误当成 `Phase 1+` 实现批准
