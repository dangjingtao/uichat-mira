# Skill Selection Cases

Status: Planned
Owner: docs / chat / runtime
Last verified: 2026-07-06
Layer: raw-source
Module: SKILL
Feature: SkillSelectionEval
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

这页用于评估：docs-only `Phase 0` 的第一批 thread-level memory POC 里，什么情况下应该选中哪张 skill card。

它只评估动作选择，不评估 runtime 实现。

## Case 1

### 用户输入

“把我们刚才关于产品定位的结论记成这个线程的长期上下文。”

### 预期

- 应触发：`save_thread_memory`
- 不应触发：`save_preference`
- 不应触发：`save_decision`

### 原因

用户要求沉淀的是一段线程级连续讨论，不是单条偏好，也不是单条拍板结论。

### 验收点

- 输出线程记忆草案
- 明确要求用户确认
- 确认前不能写入

## Case 2

### 用户输入

“以后你先给结论，再补细节，这个偏好帮我记住。”

### 预期

- 应触发：`save_preference`
- 不应触发：`save_thread_memory`
- 不应触发：`save_decision`

### 原因

这是稳定协作偏好，不是一次讨论总结，也不是路线决策。

### 验收点

- 输出偏好条目草案
- 要求用户确认
- 确认后才允许进入线程记忆
- 当前只要求用户能手动编辑或清空整段 memory，不要求逐条编辑偏好条目

## Case 3

### 用户输入

“这件事定了，当前阶段先做 skill，不接飞书和 Notion，把这个决定记一下。”

### 预期

- 应触发：`save_decision`
- 不应触发：`save_thread_memory`
- 不应触发：`save_preference`

### 原因

用户在保存一个已明确的取舍判断。

### 验收点

- 输出决策条目草案
- 明确要求用户确认
- 确认后才允许写回

## Case 4

### 用户输入

“总结一下我们刚才聊了什么。”

### 预期

- 不应触发任何 skill

### 原因

这是即时总结请求，不等于保存为后续 memory。

### 验收点

- 不能把“总结”偷换成“保存记忆”
- 不能出现静默写回

## Case 5

### 用户输入

“这次回答短一点。”

### 预期

- 默认不触发任何 skill

### 原因

这是本轮临时要求，不足以视为稳定偏好。

### 验收点

- 不把临时要求误写成长期偏好
- 不建议写入，除非用户进一步明确“以后都按这个来”

## Case 6

### 用户输入

“我还没决定先做 skill 还是先接 Notion，你先帮我列利弊。”

### 预期

- 不应触发 `save_decision`
- 不应触发任何写回类 skill

### 原因

当前还在讨论阶段，没有形成决策。

### 验收点

- 不把倾向写成决策
- 不出现确认弹出，因为还没有合格草案

## Case 7

### 用户输入

“如果你觉得有价值，可以提醒我是否要把这条偏好记住。”

### 预期

- 可以建议触发：`save_preference`
- 不能直接写入

### 原因

用户允许助手提出建议，但没有授权静默保存。

### 验收点

- 只能建议
- 必须有确认步骤

## Case 8

### 用户输入

“把这轮讨论保存为线程记忆，如果和已有记忆冲突，先给我看草案。”

### 预期

- 应触发：`save_thread_memory`
- 且必须输出候选草案而不是直接覆盖

### 原因

用户已经把确认要求说得很明确。

### 验收点

- 显示待写回内容
- 如果已有 memory，必须先显示合并草案
- 默认不允许直接覆盖已有可见对象
- 只有用户明确确认覆盖时，才允许覆盖

## 当前结论

第一批 skill selection 的核心不是“尽量多触发”，而是：

- 只在边界清楚时触发
- 只生成待确认草案
- 永远不把即时回答动作偷换成长期写回动作
- 当前结论只服务于 docs-only `Phase 0` 评审，不代表 runtime 已批准
