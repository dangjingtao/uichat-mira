# Skill 驱动记忆 POC（已废弃）

Status: Historical
Owner: chat / runtime / docs
Last verified: 2026-07-22
Layer: raw-source
Module: SKILL
Feature: SkillMemoryPOC
Doc Type: historical
Canonical: false
Related:
  - README.md
  - skill-runtime-design.md

## 状态

这份设计已于 `2026-07-22` 被新的 Skill 定义替代，不再作为当前实现、施工或评审依据。

旧定义围绕“记忆型工作动作 / skill-driven memory”展开；当前正式定义改为：

> `Skill = 内部状态 + 多工具编排 + 业务语义封装`。

当前真相源：

1. `README.md`
2. `skill-runtime-design.md`

## 历史说明

旧 POC 曾尝试以这些 memory action 作为 Skill 起点：

- `save_thread_memory`
- `save_preference`
- `save_decision`

这组卡片、旧 card schema、旧 eval 和旧 roadmap 仅保留历史参考意义。

`Memory` 现在明确不属于 Skill 的基础定义；它只能作为 Skill 可选读写的外部能力或长期信息对象。

需要查看旧设计细节时使用 Git 历史，不要从本页恢复旧合同。
