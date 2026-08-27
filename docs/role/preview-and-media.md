---
status: current
owner: role / chat / media
last_verified: 2026-08-01
layer: wiki
module: Role
feature: PreviewAndMedia
doc_type: current-contract
canonical: true
related:
  - ../ROLE_CURRENT_TRUTH.md
  - page.md
  - runtime.md
  - ../MICROAPP_CURRENT_TRUTH.md
---

# Role Preview 与媒体联动

## 文档范围

本页说明 Role Workbench Preview 的真实实现，以及 Role 与 Chat 头像、TTS、Image Generation 的当前产品耦合。

## Preview 不是 Runtime 调试器

当前 Workbench 有两种 Preview mode：

```text
chat
rag
```

它们用于编辑辅助，不是后端实际请求回放。

### Prompt Preview

页面用当前 draft 字段手工拼接：

```text
System
Role
Knowledge notice
History notice
Test input
```

它没有调用：

- `thread-request-context.node`；
- RAG Graph；
- Provider adapter；
- Agent Runtime；
- request observation。

当前展示还包含 Role summary，而真实 Role resolver 不使用 summary。

### Chat Preview

Chat reply 由前端 `buildRolePreviewChatReply(...)` 固定模板生成。

它不会：

- 调用默认 LLM；
- 使用 Role LLM Profile；
- 检索 Knowledge Base；
- 执行 RAG guardrail；
- 读取真实 Thread History；
- 验证 Provider 支持。

所以 Preview 只能回答：

> 当前编辑字段大致写了什么。

不能回答：

> 模型最终会怎样回复。

## Preview 使用 draft

Preview 使用当前页面 draft，包括尚未主保存的 Prompt 字段。

真实 Chat 使用后端已保存 Role。

```text
Preview 变化
!= Chat 已使用新内容
```

只有 LLM Profile Drawer 的独立 Save 会立即写后端；其余字段仍需主保存。

## 头像与显示名

Role avatarId 当前只从内置 16 个头像选项解析。

Chat 中 Role 影响：

- Thread context tag；
- Assistant avatar；
- replying / typing label；
- tooltip。

这些 UI 状态来自 Chat 当前加载的 active Role list。

若 Thread 绑定了 draft Role，后端可能继续注入 Role，但 UI 无法解析头像和标签。

## TTS

TTS 不要求 Role。

回答成功后：

```text
Assistant text
→ TTS capability
→ Audio ChatMedia
```

Role 只通过改变文字内容间接影响音频文本。Role 不选择 TTS Provider、Voice 或 Reference Audio。

## Image Generation

### 自动启用行为

选择 Role 时，当前桌面逻辑会：

- Welcome 状态：`draftImageEnabled = true`；
- 已有 Thread 且没有 Knowledge Base：写 `imageEnabled = true`。

因此 Role picker 不只是选择 Persona，还会改变媒体设置。

### 实际触发条件

回答成功后自动图片生成要求：

```text
imageEnabled = true
+ roleId 是字符串
+ knowledgeBaseId 为空
+ Image capability enabled
```

Assistant text 直接作为图片 prompt。

Role Prompt 不会作为结构化图片参数传入；图片生成也不会读取 Role fields 本体。

### 失败语义

- 图片任务异步运行；
- 图片失败不会撤销文字回答；
- 失败状态写入 Assistant metadata.media；
- 用户可对消息再次手动触发图片任务。

### 当前副作用

配置了远端图片 Provider 时，选择 Role 可能产生额外调用和成本。

当前没有在 Role picker 中单独确认“同时启用自动图片生成”。

## Knowledge Base 互斥

自动图片条件要求未绑定 Knowledge Base。

选择 Role 后若绑定 Knowledge Base，图片任务不会触发；之后若解除 Knowledge Base，而 imageEnabled 仍为 true，自动图片可能恢复。

这是当前状态组合的结果，不是 Role 定义的一部分。

## 解绑与残留状态

Welcome 状态解绑 Role 会同时关闭 draft image 开关。

Persisted Thread 解绑 Role 当前只清空 roleId，不一定清空 `imageEnabled`。因为图片触发还要求 roleId，解绑后不会继续生成；但媒体设置值可能残留。

## 当前没有的能力

- 真实 Request Preview；
- 真实 Model Preview；
- Preview 与 Runtime diff；
- Role 专属 TTS voice；
- Role 专属 Image workflow；
- 选择 Role 时的媒体副作用确认；
- Role avatar 自定义上传；
- Role media capability profile。

## 验证清单

- [ ] Preview 字段修改是否已经主保存；
- [ ] 用真实 Chat 验证 Role，而不是只看 Preview；
- [ ] 选择 Role 后检查 Image 开关；
- [ ] 远端 Image Provider 场景确认成本；
- [ ] RAG Thread 不期待自动图片；
- [ ] draft Role 绑定场景检查 UI 与实际回复是否分叉；
- [ ] TTS / Image 失败不误判为主回答失败。
