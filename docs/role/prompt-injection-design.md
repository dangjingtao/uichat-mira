---
status: superseded
owner: role / runtime
last_verified: 2026-08-01
layer: wiki
module: Role
feature: PromptInjectionLegacyEntry
doc_type: compatibility-entry
canonical: false
superseded_by: runtime.md
---

# Role Prompt 注入设计（兼容入口）

2026-06-25 的设计原文已归档：

- [[archive/role/prompt-injection-design-20260625]]

当前 Runtime 并没有使用前端 PromptInjection utility 把 Role 编译成多条 entry。真实实现是后端 Role resolver 生成一条 request-only system message。

当前请阅读：

- [[ROLE_CURRENT_TRUTH]]；
- [[role/runtime]]。
