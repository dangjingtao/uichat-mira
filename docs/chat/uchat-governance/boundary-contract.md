# UChat 边界契约

Status: Current
Owner: chat
Last verified: 2026-07-02
Layer: raw-source
Module: Chat
Feature: UChatGovernance
Doc Type: current-contract
Canonical: false
Related:
  - README.md
  - governance-assessment.md
  - ambiguity-log.md
  - ../../uchat.md
  - ../../uchat-internal-maintenance.md

## 单点真相范围

这页专门定义 `uChat` 治理里最重要的东西：

- `core / ui / integration` 各自该知道什么
- 各自不该知道什么
- 未来新能力接入时，先按什么维度判断落层

一句话：

`uChat` 的治理，本质上不是“代码整理”，而是“边界治理”。

## 为什么边界感最重要

如果边界守不住，`uChat` 后面会同时坏三层：

- `core` 被具体业务对象拖着走，失去 runtime 抽象价值
- `ui` 承接越来越多 feature 判断，最后成为不可维护大组件
- `integration` 变成所有产品能力的收容层，谁都不敢拆

所以治理的第一原则不是“先拆文件”，而是“先守边界”。

## 一层一句话

### `core`

负责聊天 runtime 的通用运行语义。

### `ui`

负责 canonical chat state 的通用展示和交互承载。

### `integration`

负责把 Mira 当前产品能力接进 `uChat`，但不应该反过来定义 `uChat` 的核心形状。

## 三层边界

### 1. `desktop/src/shared/uchat/core`

这一层应该知道：

- thread / message / composer / run 的 canonical 生命周期
- 通用消息 part 模型
- runtime store
- optimistic send / reconcile 机制
- 与具体产品无关的能力抽象

这一层不该知道：

- Mira 的具体页面结构
- 当前 REST 路由名、SSE 事件名
- Role / KnowledgeBase / Workspace / MCP 的领域细节
- Modal、Dropdown、Tooltip 这类 UI 组件概念
- 某个功能按钮应该放在哪

判断标准：

如果一段逻辑离开 Mira 当前页面和接口以后仍然成立，才有资格进 `core`。

### 2. `desktop/src/shared/uchat/ui`

这一层应该知道：

- canonical message / thread / composer 长什么样
- 通用展示形态
- 通用交互承载方式
- execution trace 的通用视图
- 不带业务语义的 slot / callback / capability 呈现

这一层不该知道：

- 某个按钮点开后应该调哪个业务 API
- 角色、知识库、工作空间的后端语义
- 哪些上下文需要持久化
- 当前产品特定的业务判定规则

判断标准：

如果一段逻辑本质上是在决定“业务该怎么做”，而不是“UI 怎么显示”，就不该进 `ui`。

### 3. `desktop/src/features/chat`

这一层应该知道：

- 当前产品的线程领域规则
- 后端协议适配
- Role / RAG / Workspace / Agent / MCP 等能力如何接入聊天
- 当前页面级交互装配

这一层不该变成：

- 新的隐藏核心层
- 永久容纳所有复杂度的巨石层

判断标准：

integration 可以接线，但不能无限膨胀成“把所有未来能力都堆在一起”的默认容器。

## 四类东西必须分开

未来所有能力都先判断自己属于哪类，再谈落层。

### 1. Capability

能力可用性。

它回答的是：

- 当前能不能做某件事
- 当前能显示哪些入口
- 当前哪些动作应该可交互

例子：

- 是否支持附件
- 是否启用 Agent
- 是否可用搜索

### 2. Context

上下文影响因素。

它回答的是：

- 当前回复受哪些隐藏状态影响
- 这些状态是否持久化
- 它们是线程态、欢迎态还是 request-only

例子：

- Role
- Knowledge Base
- Summary
- Future Memory
- 自定义智能体中的静态人格 / 静态知识配置

### 3. Execution

请求执行过程。

它回答的是：

- 这一轮到底做了什么
- 调用了哪些工具 / 节点
- 哪一步成功失败

例子：

- RAG retrieve / rerank
- tool call
- approval flow
- future summary / memory injection trace

### 4. Media

输入输出媒体能力。

它回答的是：

- 用户喂了什么
- 模型回了什么
- 媒体任务如何被表示和呈现

例子：

- 附件上传
- 图片输入
- 文生图结果
- TTS 音频输出

这四类东西一旦混掉，后续 UI 和 runtime 都会越来越乱。

## 当前明确要求

### 1. 不把产品领域对象直接下沉进 `core`

像这些概念，默认都不该直接变成 `uChat core` 的一等领域对象：

- Role
- KnowledgeBase
- Workspace
- MCP
- 自定义智能体

除非已经证明它们是“所有聊天 runtime 都必须理解的通用概念”。

### 2. 不让 `ui` 承担业务判断

`ui` 可以接收：

- `capabilities`
- `context tags`
- `execution data`
- `callbacks`

但不应该自己决定：

- 哪类业务上下文该持久化
- 某个业务能力何时启用
- 某个 feature 该调哪个产品接口

### 3. 不让 `integration` 变成默认垃圾场

`integration` 可以暂时承受复杂度，但不能无限透支。

如果未来继续往这里叠：

- 自定义智能体矩阵
- 文生图
- TTS
- 更复杂的 workspace
- 更复杂的 MCP

那就必须先补 contract，不允许只加条件分支。

## 对未来能力的判断基线

### 自定义智能体

先问：

- 它是 context 组合体
- 还是 capability 集合
- 还是新的运行模式

没回答清楚前，不进 `core`。

### 附件

先问：

- 它是输入媒体
- 还是消息正文一部分
- 还是执行任务资源

没回答清楚前，不扩大 message model。

### 文生图

先问：

- 它是普通 assistant 输出
- 还是一个独立任务执行过程
- 结果是否进入普通消息 part

没回答清楚前，不往现有图片消息语义硬套。

### TTS

先问：

- 它是输出媒体
- 还是 assistant 消息的附属播放能力
- 是否需要 execution trace

没回答清楚前，不草率往 `ChatMessagePart` 里加字段。

## 当前治理动作

后续只要是 `uChat` 相关改动，先过三步：

1. 这次改动属于 `capability / context / execution / media` 哪一类
2. 它应该落在 `core / ui / integration` 哪一层
3. 如果边界不清，先记入 `ambiguity-log.md`，再讨论，不直接改

## 一句话结论

`uChat` 后续能不能继续健康演进，不取决于我们能写多少功能，而取决于：

- 能不能持续把产品复杂度挡在正确的边界之外

