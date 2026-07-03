# UChat 治理一期目标

Status: Current
Owner: chat
Last verified: 2026-07-02
Layer: raw-source
Module: Chat
Feature: UChatGovernance
Doc Type: implementation-plan
Canonical: false
Related:
  - README.md
  - governance-assessment.md
  - boundary-contract.md
  - ambiguity-log.md

## 这期要解决什么

一期不是“大重构 `uChat`”，而是做一轮短期内能收口、且能明显改善后续可维护性的治理。

一期目标只有一句话：

把 `uChat` 当前最危险的边界混杂点，先收成清楚的 contract 和稳定的落点，避免后续新能力继续无序叠加。

## 一期范围

一期只做这些：

1. 明确线程上下文 contract
2. 限制 `thread.metadata` 继续无规则扩张
3. 收口 chat integration 层里最混杂的线程上下文装配逻辑
4. 为附件 / 文生图 / TTS / 自定义智能体预留正确的分类入口

一期明确不做：

- 不做 `uChat` 全量重写
- 不强拆所有大文件
- 不把自定义智能体完整做完
- 不一次性完成附件 / 文生图 / TTS 的正式接入
- 不重做现有 chat UI 外观

## 一期完成后的前后差别

### 改之前

当前主要问题是：

- `Role / KnowledgeBase / Summary / Workspace / Agent`
  的线程上下文语义分散在 draft state、thread metadata、runtime policy、UI 组件判断里
- `thread.metadata` 已经在承担事实上的上下文容器职责，但没有明确边界
- 新能力一来，默认动作很容易变成“先往 metadata 塞，再在 integration 层补判断”
- 大家知道 `core / ui / integration` 要分层，但遇到具体需求时没有统一落点标准

### 改之后

一期完成后应达到：

- 线程上下文有一份清楚的 contract，能明确区分：
  - `persisted thread state`
  - `welcome draft state`
  - `request-only context`
- `thread.metadata` 不再是默认随手扩展槽，而是只承载被明确允许的字段
- `Role / KnowledgeBase / Summary / Workspace / Agent`
  在前端接线层有更稳定的装配边界
- 后续要接附件 / 文生图 / TTS / 自定义智能体时，先有分类基线，不再直接撞进现有实现

## 一期交付物

### 1. 线程上下文 contract 文档

需要产出一页明确文档，回答：

- `Role`
- `KnowledgeBase`
- `Summary`
- `Workspace`
- `Agent`
- `Future Memory`

各自属于：

- 持久化线程态
- 欢迎态草稿
- request-only 注入态

这是一期最关键交付物。

### 2. metadata 使用白名单

需要把当前允许长期挂在线程上的 metadata 字段写清。

至少要回答：

- 哪些字段暂时允许继续存在
- 哪些字段后面要升级成显式 contract
- 哪些字段不允许再加

### 3. chat integration 的线程上下文收口

一期不求把 integration 拆漂亮，但要把“线程上下文相关逻辑”先收成相对独立的装配区域，而不是继续散在多个组件和协议接线里。

这里的重点不是拆文件数量，而是先让职责更清楚。

### 4. 新能力接入前的判断模板

要形成一份短模板，让后续每个能力先判断：

1. 它是 `capability / context / execution / media` 哪一类
2. 它该落 `core / ui / integration` 哪一层
3. 它是否会新增线程持久化字段

没有过这三步，不直接落代码。

## 一期验收标准

一期结束时，至少应满足：

### 1. 线程上下文语义清楚

产品和开发都能回答：

- 当前有哪些线程上下文
- 哪些会持久化
- 哪些只在欢迎态存在
- 哪些只在请求时参与注入

### 2. metadata 不再继续裸长

后续要加新上下文字段时，不再默认：

- 先塞进 `thread.metadata`
- 再在 UI / protocol / runtime 各处补判断

而是先经过 contract 判断。

### 3. integration 层的线程上下文逻辑更可定位

即便暂时还没有完全拆成多个文件，也必须做到：

- 查线程上下文逻辑时，有清晰入口
- 不再散落成“到处都能改一点”

### 4. 二期入口明确

一期结束后，能很清楚地知道哪些问题留给二期，而不是把一期做成模糊过渡态。

## 一期明确不收的债

这些不放在一期：

### 1. 全量组件拆分

`UChatThreadView.tsx`、`UChatThread.tsx`、`protocol.ts`、`runtime.ts`
都偏大，但一期不以“把文件拆小”作为主目标。

### 2. 自定义智能体完整模型

一期只做边界预留，不做完整对象建模。

### 3. 多模态完整 message model

附件 / 文生图 / TTS 的最终 message model 不在一期定稿。

一期只做分类基线和接入前约束。

### 4. 完整 plugin 化 sidebar / chat surface

一期不把 `sidebarEntries` 演进成完整插件系统。

## 二期以后可能处理什么

这部分只是提前占位，不在一期实现：

- 二期：线程上下文 contract 落代码、integration 分层收口
- 三期：媒体能力 contract、附件 / 文生图 / TTS 正式接入
- 四期：自定义智能体能力矩阵与更完整 workspace 语义

## 一句话结论

一期的目标不是让 `uChat` 立刻变优雅，而是让它先停止继续无序变坏。

