# UChat 运行时

Status: Current
Owner: chat
Last verified: 2026-06-25
Layer: raw-source
Module: chat
Doc Type: current-contract

`uchat` 是当前项目新的自有对话运行时方案，作为聊天状态和运行时框架的唯一主实现。

## 单点真相范围

这篇文档是以下内容的单点真相页：

- `uchat` 运行时的职责边界
- chat 主实现的分层口径
- 当前线程与知识库绑定的产品语义

相关概念：

- [[CONCEPT_UCHAT]]
- [[CONCEPT_RUNTIME]]
- [[CONCEPT_KNOWLEDGE_BASE]]
- [[AREA_MAP_CHAT]]

## 运行时口径

当前 chat 运行时规则统一维护在：

- `docs/uchat-internal-maintenance.md`
- `docs/architecture/provider-proxy-api.md`

历史整改记录只作为背景材料阅读，不再作为当前主契约。

## 目标

- UI 无关：核心不依赖 React 组件、Provider 栈、浏览器本地聊天存储
- 协议无关：核心不直接认识当前项目的 REST 路由、SSE 事件名、附件元数据格式
- 可扩展：后续可以替换线程存储、流式协议、附件上传方式，而不改核心状态机
- 自己可控：只保留项目真正需要的能力，不再围绕第三方 runtime 适配

## 当前边界

当前 `uchat` 应被理解为三层：

- core：状态、类型、runtime orchestration
- ui：与 canonical message / thread / composer 对应的展示组件
- integration：与当前项目业务协议和页面装配发生连接的适配层

不要再把 UI、协议和业务规则重新揉回同一层。

## 适合什么时候读

这些场景建议先读这页：

- 改聊天主链路
- 改线程与消息状态模型
- 改知识库绑定语义
- 评审某段 chat 改动是否越过了分层边界

## 相关文档

- `uchat-internal-maintenance.md`
- `chat-system-practices.md`
- `architecture/provider-proxy-api.md`
