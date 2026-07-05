# Skill Catalog

Status: Current
Owner: docs / chat / runtime
Last verified: 2026-07-06
Layer: raw-source
Module: SKILL
Feature: SkillCatalog
Doc Type: index
Canonical: true
Related:
  - ../README.md
  - ../schema/skill-card.schema.md
  - ../roadmap.md

## 单点真相范围

这页是 `docs/skill/catalog/` 的入口索引。

它只负责回答：

- 当前有哪些 skill card
- 它们的稳定 id 是什么
- 文件 slug 是什么
- 当前处于哪个阶段

它不负责：

- runtime 实现
- DB schema
- AgentGraph / Harness / MCP 设计

## 当前阶段

当前 catalog 只覆盖 `docs-only Phase 0`。

这表示：

- skill card 已经可评审
- 触发边界和写回对象已经定义
- 但还没有进入 runtime 实现

## 命名规则

- 文件名使用 kebab-case：`<file-slug>.skill.md`
- card 内部稳定 id 使用 snake_case：`<skill_id>`
- `file slug` 和 `skill id` 不是同一个字段

例如：

- file slug: `save-thread-memory`
- filename: `save-thread-memory.skill.md`
- skill id: `save_thread_memory`

## Catalog

| Title | Skill ID | File Slug | Trigger Mode | Phase | Card |
| --- | --- | --- | --- | --- | --- |
| 保存线程记忆 | `save_thread_memory` | `save-thread-memory` | `explicit` | `Phase 0` | [save-thread-memory.skill.md](save-thread-memory.skill.md) |
| 保存偏好 | `save_preference` | `save-preference` | `suggested-with-confirmation` | `Phase 0` | [save-preference.skill.md](save-preference.skill.md) |
| 保存决策 | `save_decision` | `save-decision` | `suggested-with-confirmation` | `Phase 0` | [save-decision.skill.md](save-decision.skill.md) |

## 使用方式

建议阅读顺序：

1. `../README.md`
2. `../schema/skill-card.schema.md`
3. 当前 catalog 中的具体 skill card
4. `../eval/*.md`
5. `../roadmap.md`

## 当前结论

当前 catalog 的作用是把第一批记忆型 skill card 收成统一入口，方便评审、对比和后续演进，不把它提前升级成 runtime 注册表。
