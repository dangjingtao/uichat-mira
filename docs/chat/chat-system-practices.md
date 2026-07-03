# 对话系统开发实践

Status: Current
Owner: chat
Last verified: 2026-06-25
Layer: raw-source
Module: Chat
Feature: UChat
Doc Type: reference

## 单点真相范围

这页文档汇总开发对话系统时积累下来的工程实践、坑点和回归约束，重点覆盖：

- 线程列表与消息持久化
- 用户隔离
- Assistant UI / `uchat` 接入
- RAG 来源卡片、历史恢复和运行时稳定性

相关文档：

- [[uchat]]
- [[uchat-internal-maintenance]]
- [[architecture/provider-proxy-api]]
- [[maps/AREA_MAP_CHAT]]

## 适合什么时候读

下面这些场景建议先读这篇：

- 改线程列表、历史恢复、消息持久化
- 改 RAG 来源卡片
- 改聊天协议适配或运行时装配
- 排查“刷新后消息不对 / 来源丢失 / 顺序错乱 / 重复消息”这类问题

## 当前事实

这篇文档不是一份从零设计方案，而是基于本项目已经踩过的坑沉淀出来的经验页。

如果它和当前代码行为不一致，应优先核对本地实现，再同步更新文档。

## 线程列表与消息持久化

### ThreadHistoryAdapter 的基本约束

- 编码后的消息对象应直接作为 canonical message 使用
- 不要假设转换结果里还包一层 `content`
- 追加与恢复逻辑必须基于同一套消息形状

## 用户隔离

- 线程、消息和知识库绑定都必须按当前用户隔离
- 不要把全局默认状态偷偷回灌到用户态线程里

## 接入 `uchat` 时的原则

- 先接 canonical 状态，再接页面展示
- 先确认协议适配层正确，再排查 UI
- 不要把一次性业务分支直接塞进 `uchat` core

## 相关文档

- `uchat.md`
- `uchat-internal-maintenance.md`
