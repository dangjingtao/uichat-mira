---
status: historical
owner: docs / role
last_verified: 2026-08-01
layer: archive
module: Role
feature: ArchiveIndex
doc_type: archive-index
canonical: false
related:
  - ../../ROLE_CURRENT_TRUTH.md
  - ../../role/README.md
---

# Role 历史归档

本目录保存 2026 年 6 月 Role CRUD、Thread 绑定、Prompt 注入、RAG 接入和蓝屏恢复阶段的原始文档。

它们用于追溯：

- Role 从设置页 mock / 素材工作台迁移到真实 API；
- Thread.roleId 与 request-only context 的落地过程；
- Role + RAG generate 接入；
- Prompt Manager 与多 entry 注入的设计设想；
- 蓝屏后的恢复与人工验收记录。

这些页面不再定义 2026-08-01 的当前行为。

## 原文快照

- `role-overview-20260625.md`：旧模块总览；
- `role-page-20260625.md`：旧页面合同；
- `role-api-20260625.md`：旧 API 说明；
- `chat-integration-20260625.md`：旧 Chat 接入说明；
- `prompt-injection-design-20260625.md`：旧 Prompt Injection 设计；
- `migration-checklist-20260625.md`：主链迁移清单；
- `rag-integration-checklist-20260625.md`：Role + RAG 清单；
- `recovery-regression-checklist-20260626.md`：蓝屏恢复回归记录。

## 当前入口

```text
ROLE_CURRENT_TRUTH
→ role/README
→ role/page
→ role/role-api
→ role/runtime
→ role/preview-and-media
```

历史文档里这些说法不能继续当现状引用：

- Preview 等于真实请求；
- 前端 PromptInjection utility 已进入主 Runtime；
- Role 由多条 PromptInjectionEntry 编译；
- 工作台已有 Copy / Import；
- active / draft 已形成完整发布系统；
- Role LLM Profile 在 RAG 中生效；
- Starter Role 会为每个新用户初始化。
