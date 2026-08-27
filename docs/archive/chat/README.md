---
status: current
owner: docs / chat
last_verified: 2026-08-01
layer: schema
module: Chat
feature: ArchiveIndex
doc_type: archive-index
canonical: true
related:
  - ../../CHAT_CURRENT_TRUTH.md
  - ../../chat/README.md
  - ../../uchat.md
  - ../../chat/persistence-and-media.md
  - ../README.md
---

# Chat 历史归档

> 本目录保存被当前 Chat / UChat 合同替代的旧总纲。它们用于追溯界面和运行时演进，不回答 `dev` 当前的 Thread、Message、发送路径或删除行为。

## 当前阅读入口

```text
CHAT_CURRENT_TRUTH
→ chat/README
→ uchat
→ chat/persistence-and-media
```

## 历史快照

- [[archive/chat/chat-overview-20260730]]：2026-07-30 的 Chat 总览，内容主要围绕 Agent UI；
- [[archive/chat/uchat-contract-20260722]]：2026-07-22 的 UChat 运行时合同。

## 为什么归档

旧页面仍有背景价值，但存在以下不足：

- Chat 总览把普通回答写成 Main Planner 路径，未区分 Normal / RAG / Agent 三路；
- 没有完整说明 User / Assistant 持久化时序；
- 没有公开 edit / regenerate 会删除旧 tail；
- 没有说明 Message 表并未持久化分支树；
- 没有说明 Stop 只停止客户端流；
- 没有说明附件和媒体清理缺口；
- 没有公开删除 Knowledge Base 级联删除 Thread 的高严重度缺陷；
- UChat 旧合同混合了当前稳定事实与阶段施工说明。

## 使用规则

历史资料可以解释：

- UChat 为什么采用 core / ui / integration；
- 应用级 runtime 如何形成；
- Agent UI、Composer slot 和 streaming renderer 如何演进。

历史资料不能证明：

- 当前普通 Chat 支持 Tool Calling；
- 当前拥有可切换 Message Branch；
- Thread modelName 驱动 Provider；
- Stop 已取消 backend work；
- Attachment storage 已有完整 GC；
- 删除 Knowledge Base 会保留对话历史。
