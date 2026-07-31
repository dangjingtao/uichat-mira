---
status: current
owner: role / chat / runtime
last_verified: 2026-08-01
layer: wiki
module: Role
feature: RoleCurrentTruth
doc_type: current-snapshot
canonical: true
related:
  - role/README.md
  - role/page.md
  - role/role-api.md
  - role/runtime.md
  - role/preview-and-media.md
  - CHAT_CURRENT_TRUTH.md
  - PROVIDER_CURRENT_TRUTH.md
  - archive/role/README.md
---

# UIChat Mira Role 当前真相

> 本页只记录 `dev` 当前可由代码、数据库与现有回归核对的 Role 事实。角色愿景、Prompt Manager 方案、未来成长态和长期记忆不能覆盖这里。

## 1. 结论先说

Mira 当前 Role 是一份属于用户的、可复用且可持久化的角色配置：

```text
Role Row
→ Prompt Fields
→ Optional LLM Profile
→ Thread.roleId
→ Request-only System Context
→ Normal Chat | RAG Generate | Agent Runtime
```

Role 不是：

- Message；
- Knowledge Base；
- Memory；
- Skill；
- Tool Policy；
- Provider Connection；
- per-thread model selector；
- 保证模型严格服从的确定性状态机。

必须区分：

```text
Role 已保存
!= Role 已绑定到 Thread

Role 已绑定
!= Chat UI 当前能显示该 Role

Role Prompt 已注入
!= Role LLM Profile 在所有链路都生效

Preview 看起来正确
!= 真实 Request 相同

status = active
!= 已经过模型行为验收

选择 Role
!= 只改变说话风格
```

选择 Role 在当前桌面集成中还可能自动打开图片生成开关，见“媒体联动”。

## 2. 核心对象

当前 Role 持久化字段：

```text
id
userId
name
summary
avatarId
status
tagsJson
promptJson
llmProfileJson
createdAt
updatedAt
```

API 返回结构：

```text
Role
├─ name
├─ summary
├─ avatarId
├─ status: active | draft
├─ tags[]
├─ prompt
│  ├─ description
│  ├─ worldview
│  ├─ persona
│  ├─ scenario
│  ├─ exampleDialogues
│  ├─ style
│  └─ constraints
└─ llmProfile
   ├─ temperature
   ├─ topP
   ├─ topK
   ├─ maxTokens
   ├─ frequencyPenalty
   └─ presencePenalty
```

### 2.1 真正进入 Role Prompt 的字段

当前后端 `resolveRoleContext` 会使用：

- Role name；
- description；
- worldview；
- persona；
- scenario；
- exampleDialogues；
- style；
- constraints。

当前不会进入模型 Prompt：

- summary；
- tags；
- avatarId；
- status；
- createdAt / updatedAt。

`summary` 主要用于列表和 tooltip；`tags` 用于识别；`avatarId` 用于 UI。不能因为 Preview 显示了这些字段，就认为真实请求也使用它们。

### 2.2 示例对话不是模板引擎

Starter Role 和页面示例使用：

```text
{{user}}
{{char}}
```

当前 Runtime 不会替换这些变量。`exampleDialogues` 会作为普通文本原样写入 Role system message。

## 3. 数据归属与隔离

Role 归属 `userId`。

API：

- 只列出当前用户 Role；
- get / update / delete 会先按当前用户核对；
- 不存在或不属于当前用户时返回 not found。

Role 本体与 Thread 分开持久化：

```text
Role
← Thread.roleId
```

Thread 只保存 Role id，不复制 Role Prompt。因此修改 Role 后，所有仍绑定该 Role 的 Thread 会在下一次请求读取最新内容。

这意味着：

```text
修改 Role
→ 影响所有绑定 Thread 的后续请求
```

当前没有 Role version snapshot，也没有“此 Thread 固定使用旧版本”的能力。

## 4. Workbench 当前保存语义

### 4.1 新建不是本地草稿

点击“新建角色”时，桌面端会立即调用 `POST /roles`，创建一个已经写入 SQLite 的 draft Role。

```text
点击 New
→ 立即创建 backend Role
→ 列表出现 draft
```

关闭页面不会自动撤销这条记录。

### 4.2 主保存

工作台主保存会提交：

- name；
- summary；
- tags；
- avatarId；
- prompt；
- llmProfile；
- `status: active`。

因此当前 UI 的常规语义是：

```text
new Role = draft
第一次主保存 = active
```

UI 没有完整的发布 / 下架工作流，也没有稳定的“active 退回 draft”入口。API 虽然允许更新 status，但不能把它包装成已经完成的角色发布系统。

### 4.3 Prompt 字段与 LLM Profile 的保存不对称

Prompt 字段抽屉的“保存”只更新页面 draft，仍需点击主保存才会写后端。

LLM Profile 抽屉的“保存”会立即单独调用 API，直接写入后端。

```text
Prompt Drawer Save
→ local draft
→ Main Save 才持久化

LLM Profile Drawer Save
→ 立即持久化 profile
```

用户可能得到“参数已保存，但其他未保存角色字段仍只是本地 draft”的中间状态。

### 4.4 表单校验

桌面主表单当前校验：

- name 必填；
- name 最长 50 字符；
- summary 最长 120 字符。

服务端 API 没有同步 name / summary 长度限制。直接调用 API 时，约束比工作台更宽。

Tags：

- API 最多接收 3 个；
- Service trim、过滤空值并只保留前 3 个。

Prompt 字段当前没有长度上限或 token budget 限制。

## 5. status 的真实语义

当前 status 只有：

```text
active
draft
```

工作台列表会读取全部 Role；Chat picker 只请求 `status=active`。

但后端请求注入：

```text
Thread.roleId
→ roleService.getRoleById(...)
```

当前不会检查 Role.status。

所以存在实现漂移：

```text
Thread 绑定 Role
→ Role 被 API 改为 draft
→ Chat picker / UI active list 不再返回该 Role
→ backend 仍继续注入 Role Prompt 与 LLM Profile
```

影响：

- UI 可能不显示 Role 标签、头像和角色名；
- 实际模型请求仍受该 Role 影响；
- 用户难以从界面判断真实上下文。

严重度：Medium，属于状态真相分叉。

目标修复方向应二选一并写成稳定合同：

1. draft Role 不允许继续执行，Thread 自动解绑或请求拒绝；
2. 已绑定 draft Role 仍可执行，UI 必须加载并明确显示其状态。

当前不能假装已经选定其中一种。

## 6. Thread 绑定

### 6.1 Welcome draft

线程尚未创建时，Role id 保存在桌面 draft state。

首次发送：

```text
Welcome draftRoleId
→ create Thread
→ Thread.roleId
```

### 6.2 Persisted Thread

Thread 创建后，以后端 `Thread.roleId` 为准。切换或解绑 Role 会更新 Thread。

Role 不作为 visible Message 保存。

### 6.3 删除 Role

Thread 外键当前为：

```text
role_id REFERENCES roles(id) ON DELETE SET NULL
```

删除 Role 会解除 Thread 绑定，不会删除 Thread 或 Messages。

这与 Knowledge Base 当前的 `ON DELETE CASCADE` 数据风险不同。

删除 Role 后，下一次读取 Thread 时 `roleId` 应为空；当前缺少一条专门覆盖“删除 Role 后保留对话”的显式回归测试，建议后续补齐。

## 7. Request Context

当前 Role 由后端线程上下文 resolver 编译成一条 request-only system message。

真实结构近似：

```text
当前线程绑定的角色设定说明
角色名
角色描述
世界观
人设
场景
示例对话
表达风格
约束
```

空字段不输出对应 section。

当前不是：

- 多条 PromptInjectionEntry；
- 前端 Prompt Manager 编译结果；
- provider adapter 直接查询 Role 数据库。

请求上下文顺序：

```text
Role
→ Thread Summary
→ Thread Memory slot（当前通常为空）
→ Agent execution context（Agent 时）
```

在 RAG generate 阶段，后面还会合并 RAG guardrail 与 retrieval context。

Role 不进入：

- 可见消息列表；
- RAG rewrite；
- Embedding；
- Retrieve；
- Rerank；
- Knowledge Base document / chunk。

## 8. 三条 Chat 路径

### 8.1 Normal Chat

```text
Thread.roleId
→ Role system message
→ visible history
→ global llm role
```

Role Prompt 生效。

Role LLM Profile 会作为本轮 params 传入默认 Chat 调用。

### 8.2 RAG Chat

```text
Thread.roleId
→ requestContextMessages
→ RAG generate
```

Role Prompt 只在 generate 阶段生效，不污染检索 query 和 sources。

当前独立 RAG route 没有接收 Role LLM Profile 参数。因此：

```text
Role Prompt 生效
Role LLM Profile 不生效
```

这是 Medium 一致性缺口，已经记录在 Chat 当前真相，不是新设计。

### 8.3 Agent Chat

Role Prompt 作为 request-only context 进入 Agent input；Role LLM Profile 作为 params 传入 Agent Runtime 入口。

Role 不决定：

- Planner 可见 Tool；
- Harness approval；
- Skill match；
- Workspace permission；
- Agent terminal contract。

角色约束文本可能影响模型判断，但它不是可执行 Policy，不能替代 Harness 和审批。

## 9. LLM Profile

Role LLM Profile 当前只保存数值采样参数：

- temperature；
- topP；
- topK；
- maxTokens；
- frequencyPenalty；
- presencePenalty。

它不保存：

- Provider Connection；
- remote model id；
- model role；
- API Key；
- Vision / Tool capability；
- context window。

所以：

```text
Role LLM Profile
!= Role 专属模型
```

### 当前校验边界

桌面只要求 finite number；API schema 只要求 number；Service 只保留 number。

没有统一的 min / max / integer 约束。例如：

- temperature 没有限定常用范围；
- topP 没有限定 0–1；
- topK / maxTokens 没强制正整数；
- penalties 没限定 provider 常用范围。

实际 Provider 是否接受取决于 adapter 和远端服务。超出范围可能：

- 被 adapter 忽略；
- 被远端拒绝；
- 产生不可预期采样行为。

严重度：Medium configuration risk。

## 10. Preview 的真实含义

Role Workbench 有两种展示：

### Prompt Preview

前端手工拼出一份说明文本，包含 System、Role、Knowledge、History 和测试输入等区块。

它不读取后端 `thread-request-context.node` 的真实输出，也不读取本轮 Provider request snapshot。

### Chat Preview

所谓回复由 `buildRolePreviewChatReply(...)` 按固定模板拼接，不会调用模型。

所以：

```text
Preview
= 编辑辅助展示
!= 实际模型输出
!= 实际 Request
!= Provider capability test
```

当前 Preview 还会展示 summary，而真实 Role system message不使用 summary；这会进一步放大预览与 Runtime 的差异。

严重度：Medium documentation / UX truth gap。

## 11. 媒体联动

### 11.1 TTS

TTS 开关不依赖 Role。Role 只会影响 Assistant 文字内容，之后 TTS 对文字做合成。

```text
Role-shaped Answer
→ TTS Runtime
```

### 11.2 Image Generation

当前桌面选择 Role 时：

- Welcome 状态会同时把 image draft 开关设为 true；
- 已有 Thread 且未绑定 Knowledge Base 时，会写入 `imageEnabled: true`。

自动图片任务还要求：

```text
imageEnabled = true
+ Thread.roleId 存在
+ 未绑定 Knowledge Base
+ Image capability 已配置
```

Assistant 成功后，文字回答会直接作为图片 prompt。

因此选择 Role 可能触发额外图片任务、等待和远端成本。这不是 Role 数据模型本身，而是当前桌面产品集成的隐式耦合。

严重度：Medium product side effect。

删除或解绑 Role 后，图片任务因缺少 roleId 不会继续触发，但 `imageEnabled` 持久化值可能仍保留。

## 12. Starter Role

Backend 内置三个英文示例：

- Formal Reviewer；
- Pilot Helper；
- Archive Guide。

初始化条件当前是：

```text
整张 roles 表 COUNT = 0
```

满足时，会给当时所有 active users 插入 starter roles。

这不是 per-user seed：

```text
已有任意 Role
→ 后创建用户
→ 不会自动得到 Starter Role
```

桌面代码另有一份可本地化的 `buildStarterRoles(...)`，当前没有真实调用方；真实 starter data 以 backend 英文 seed 为准。

严重度：Low–Medium onboarding inconsistency。

## 13. 当前没有的能力

当前没有：

- Role Copy API；
- Role Import / Export；
- Role version history；
- Role snapshot per Thread；
- Role inheritance；
- Role-level Knowledge Base；
- Role-level long-term memory；
- Role growth state；
- Role Tool Policy；
- 真实模型 Preview；
- 真实 request snapshot viewer；
- 统一发布 / 下架工作流；
- per-role Provider / Model binding。

文档不得把“预留”“建议”“后续可做”写成当前工作台操作。

## 14. 已知问题与严重度

| 问题 | 原因 | 影响 | 严重度 |
| --- | --- | --- | --- |
| draft Role 仍可被后端注入 | Runtime 不检查 status，Chat picker 只列 active | UI 与真实请求分叉 | Medium |
| RAG 不应用 Role LLM Profile | 独立 RAG route 未传 role params | 同一 Role 在不同模式采样行为不一致 | Medium |
| Preview 不是真实请求或模型结果 | 前端手写展示与固定模板回复 | 用户可能错误判断 Role 已生效 | Medium |
| LLM Profile 无范围校验 | UI / API 只检查 number | 远端拒绝或行为漂移 | Medium |
| 选择 Role 自动打开 Image | 桌面集成隐式设置 imageEnabled | 可能产生额外任务与成本 | Medium |
| Starter Role 只做全表空 seed | seed gate 不是 per-user | 后创建用户没有示例角色 | Low–Medium |
| Preview 使用 summary，Runtime 不使用 | 展示模板与 resolver 字段不一致 | 编辑判断偏差 | Low–Medium |
| `{{user}} / {{char}}` 不替换 | 当前没有 Role template compiler | 示例变量只是字面文本 | Low |
| Role 删除保留对话缺少专项回归 | 依赖 FK SET NULL | 未来 migration 可能回归 | Low |

本轮只记录，不修改 Runtime。

## 15. 验证依据

本轮回读：

- Role SQLite schema、初始化和 starter seed；
- Role repository / service / route schema；
- Role route tests；
- Personas workbench、useRoles、Preview 和 LLM Profile drawer；
- Chat Role picker 与 welcome / Thread binding；
- Thread request context Role resolver；
- Normal / RAG / Agent route 分流与 role params；
- Chat media lifecycle；
- Thread Role 外键删除行为。

本轮没有运行完整 server / desktop test suite，也没有修改代码。

## 16. 引用优先级

```text
current code + repeatable tests
→ ROLE_CURRENT_TRUTH
→ role/README
→ role/page
→ role/role-api
→ role/runtime
→ role/preview-and-media
→ project-control evidence
→ archived migration / design / recovery notes
```
