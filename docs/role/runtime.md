---
status: current
owner: role / chat / runtime
last_verified: 2026-08-01
layer: wiki
module: Role
feature: Runtime
doc_type: current-contract
canonical: true
related:
  - ../ROLE_CURRENT_TRUTH.md
  - README.md
  - role-api.md
  - preview-and-media.md
  - ../CHAT_CURRENT_TRUTH.md
---

# Role Runtime 与 Chat 接入

## 文档范围

本页说明 Role 如何从 Workbench 数据进入 Thread、Request Context，以及 Normal / RAG / Agent 三条 Chat 路径。

## 状态所有权

```text
Welcome state
→ desktop draftRoleId

Persisted Thread
→ threads.role_id

Role content
→ roles row

Visible messages
→ messages table
```

Role Prompt 不写入 messages。

## Welcome 到 Thread

线程尚未创建时，用户选择的 Role 保存在桌面 draft state。

首次发送：

```text
ensureThread()
→ createThread(metadata.roleId)
→ Thread 成为真实状态
```

Thread 创建后，以后端 roleId 为准，不再使用欢迎态 draft 影子状态。

## Thread 切换与解绑

已有 Thread 选择 Role：

```text
PATCH Thread metadata.roleId
→ refresh Thread
```

解绑写入 `roleId: null`。

Chat UI 只加载 active Role 列表，所以当 Thread 指向 draft Role 时，当前界面可能无法解析头像和标签。

## Request Context 编译

后端 Role resolver：

```text
Thread.roleId
→ roleService.getRoleById(roleId, userId)
→ build one request-only system message
```

真实 system message 会包含：

- 固定角色遵循说明；
- Role name；
- 非空 Prompt sections。

当前是一条 system message，不是多条 PromptInjectionEntry。

## Resolver 顺序

```text
Role
→ Context Summary
→ Memory slot
→ Agent execution context
```

Memory slot 当前没有稳定 Thread persistence source，不能写成已完成长期记忆。

## Normal Chat

```text
Role system message
→ visible messages
→ role llm params
→ providerProxyService.generateTextForRole("llm")
```

Role Prompt 与 LLM Profile 都进入默认普通 Chat。

Role 不改变实际模型绑定；模型仍由全局 `llm` role 解析。

## RAG Chat

```text
Role system message
→ requestContextMessages
→ RAG generate
```

Role 不进入：

- rewrite；
- embedding；
- vector / lexical retrieve；
- rerank；
- sources。

RAG generate 的顺序由当前 Graph 合同维护：Role / Summary 等 request context 与 RAG guardrail、retrieval context 一起进入生成。

当前独立 RAG route 没有传 Role LLM Profile params。

## Agent Chat

```text
Role system message
→ Agent requestContextMessages

Role LLM Profile
→ Agent Runtime params
```

Role 是模型上下文，不是 Agent 治理对象。

它不能：

- 增加 Tool Exposure；
- 跳过 Harness Policy；
- 自动批准 Invocation；
- 选择 Skill Runtime；
- 改写 terminal contract；
- 代替 Workspace boundary。

Role.constraints 只是 Prompt 文本，不是可执行安全规则。

## status 漂移

Chat picker：

```text
GET /roles?status=active
```

Runtime resolver：

```text
getRoleById(...)
```

Resolver 不检查 status。

因此 draft Role 可能继续作用于已绑定 Thread。当前 UI 和请求真相会分叉。

## 修改 Role 的影响

Thread 只保存 roleId，不保存 Role 快照。

```text
修改 Role Prompt / Profile
→ 所有绑定 Thread 的后续请求读取新版本
```

历史 Assistant Message 不会重算；旧回复和新 Role 可能不一致。

## 删除 Role

```text
Delete roles row
→ FK SET NULL
→ Thread.roleId cleared
→ Messages remain
```

Role 删除不会自动清除 Thread.contextSummary。若 Summary 含有旧人设信息，解绑或删除 Role 后仍可能出现“旧角色气味”。

## 字段进入 Runtime 的矩阵

| 字段 | UI | Prompt | Params | Routing |
| --- | --- | --- | --- | --- |
| name | 是 | 是 | 否 | 否 |
| summary | 是 | 否 | 否 | 否 |
| avatarId | 是 | 否 | 否 | 否 |
| tags | 是 | 否 | 否 | 否 |
| status | 是 | 否 | 否 | Chat picker 过滤，Runtime 不过滤 |
| prompt.* | Preview / Editor | 是 | 否 | 否 |
| llmProfile.* | Editor | 否 | Normal / Agent | RAG 当前缺失 |

## 当前不变量

- Role 不能写进 visible Message；
- Provider adapter 不直接读取 Role 数据库；
- Role 不进入检索阶段；
- Thread 是绑定真相；
- Role row 是内容真相；
- Role 约束不能替代 Policy。

## 已知偏差

| 偏差 | 影响 |
| --- | --- |
| draft Role 后端仍注入 | UI 与请求不一致 |
| RAG 不接 Role params | 模式间采样不一致 |
| Role 修改立即影响全部 Thread | 没有版本可追溯 |
| Summary 不随 Role 解绑清除 | 可能保留旧语境 |
| Role params 无范围验证 | Provider 可能拒绝 |

本轮只记录，不修改 Runtime。
