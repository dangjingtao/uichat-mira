# UChat 需求不清与禁止瞎改清单

Status: Current
Owner: chat
Last verified: 2026-07-02
Layer: raw-source
Module: Chat
Feature: UChatGovernance
Doc Type: working-log
Canonical: false
Related:
  - README.md
  - governance-assessment.md

## 这页干什么

这页专门记录：

- 当前看起来不够优雅、但可能是有意为之的行为
- 当前需求语义尚未讲清，不允许直接“顺手修复”的地方
- 未来接新能力前，必须先对齐的问题

原则只有一个：

不清楚，就先记；没对齐，就不改。

## 当前不清楚项

### 1. `uChat` 的定位边界

当前不清楚的是：

- `uChat` 是继续保持“相对通用的聊天 runtime”
- 还是正式演进成“UIChat Mira 专属聊天平台层”

这个问题直接影响：

- 哪些字段能进入 `shared/uchat/core`
- 哪些能力必须留在 `features/chat`
- 哪些 UI 能进 `shared/uchat/ui`

当前动作：

- 在定位没确认前，不把更多 Mira 业务字段直接加进 canonical core

### 2. 线程持久化与 request-only 的边界

当前不清楚的是：

- `Role / KnowledgeBase / Summary / Agent / Workspace / Future Memory`
  到底哪些应该线程持久化
- 哪些只是欢迎态草稿
- 哪些只该参与请求构建，不该长期存在线程对象里

当前动作：

- 未确认前，不新增新的“先塞进 metadata 再说”的持久化字段

### 3. 工作空间到底是聊天分组，还是长期项目上下文

当前实现里 workspace 已经承担：

- 线程分组
- Agent 启用前置条件

但还不清楚它未来是否还要承担：

- 文件上下文
- 工具范围
- 多线程共享上下文
- 自定义智能体作用域

当前动作：

- 未确认前，不默认把所有新能力都绑定到 workspace 上

### 4. 自定义智能体在产品上是什么

当前已知它可能是这些东西的组合：

- RAG
- Role
- MCP
- 当前 Agent

但还不清楚它最终是：

- 一个线程模板
- 一个运行模式
- 一个能力组合体
- 一个新的一级对象

当前动作：

- 未明确前，不把“自定义智能体”直接当成 `agentEnabled` 的增强版去硬补

### 5. 附件、文生图、TTS 是否属于同一消息模型

状态：已明确。

当前 `ChatMessagePart` 已支持：

- `text`
- `image`
- `file`
- `data`

已确定：

- 文生图结果不是现有用户输入用的 `image` part
- TTS 不新增 `audio` part
- 生成中、成功、失败和任务关联信息放在助手消息 `metadata.media` 扩展中
- 数据库保存媒体产物的绝对路径，并由 backend 提供受控读取接口
- 媒体必须绑定 `threadId`、`messageId` 和任务 ID
- 重新生成、删除消息、清理分支和删除线程时，必须清理关联文件和记录

因此不修改现有 `ChatMessagePart`，不改变 provider 请求、附件处理、RAG 来源和执行 trace 的既有语义。

### 6. execution trace 的产品边界

当前不清楚的是：

- timeline 只展示本轮执行，还是未来要承接长期上下文注入解释
- summary / memory 是否一定进入同一条 timeline
- 用户是否需要显式看到某些隐藏上下文被注入

当前动作：

- 未明确前，不为了“都能展示”就把所有内部状态都推给 timeline

### 7. Sidebar 可插拔的上限

当前 `ChatSidebarEntry` 已经能承接新入口，但还不清楚：

- 它是轻量入口协议
- 还是未来完整 sidebar plugin system 的起点

当前动作：

- 未明确前，不往 `ChatSidebarEntry` 持续添加业务专属字段

## 产品能力矩阵关注项

## 本次 TTS / 生图接入的硬边界

本次只接入现有助手消息完成后的媒体能力，不改变以下核心逻辑：

- AgentGraph 的图编排、节点、状态、工具循环和审批
- RAG 的检索与生成链路
- Chat 的文本发送、流式协议和历史上下文
- Role 的角色模型、prompt 注入和请求编排

媒体接入只允许读取现有消息结果和现有 Role/RAG 状态，并负责媒体按钮、TTS/生图任务、消息关联、绝对路径持久化、读取和清理。

后续每接一类能力，都先判断它属于哪类：

### 线程上下文能力

- Role
- Knowledge Base
- Summary
- Future Memory
- 自定义智能体中的静态人格/知识配置

### 执行能力

- MCP
- 内置工具
- Web Search
- 当前 Agent tool run

### 输入能力

- 附件上传
- 图片输入
- 文件输入
- 语音输入（如后续有）

### 输出能力

- 文本回复
- 图片生成结果
- TTS 音频结果
- 结构化结果卡片

### 展示能力

- execution trace
- source detail
- approval flow
- context badges

只要不先分类，后面就一定会混写。

## 当前工作方式

后续本专项维护时：

1. 先把新问题归到这页
2. 再决定是文档澄清、代码限制，还是后续改造
3. 没过这一步，不直接改 `uChat` 核心边界

