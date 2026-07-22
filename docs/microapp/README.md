# MicroAPP 模块总纲

Status: Planned
Owner: integrations / knowledge-base / runtime
Last verified: 2026-07-23
Layer: raw-source
Module: MicroAPP
Feature: MicroAppRuntime
Doc Type: overview
Canonical: true
Related:
  - ../integrations/third-party-integration-architecture.md
  - ../integrations/third-party-integration-consumption-model.md
  - ../integrations/wecom-microapp-interface-design.md
  - office-runtime-task-contract.md
  - office-suite-microapp-design.md
  - image-generation-microapp-poc.md
  - media-capability-packaging-design.md
  - computer-use-microapp-poc.md
  - computer-use-feature-design.md
  - notion-microapp-functional-design.md
  - tts-studio-runtime-notes.md
  - gpt-sovits-microapp-poc.md

## 单点真相范围

这页只回答一件事：

当前项目里，`MicroAPP` 到底是什么，它和第三方平台接入之间是什么关系。

它覆盖：

- `MicroAPP` 的正式定义
- `Platform / Instance / AccessPoint / MicroAPP` 的边界
- 为什么 `知识库调用` 不再被视为接入方式
- 为什么一个接入方式绑定一个 `MicroAPP`
- `MicroAPP` 对未来企微、飞书、钉钉扩展的约束

它不覆盖：

- 某个平台的具体开放 API
- 某个机器人或 webhook 的配置步骤
- MCP / Tool / Harness 的实现设计

## 结论先说

`MicroAPP` 不是平台，也不是接入方式。

`MicroAPP` 是一套可以被复用、可以被注册、可以被不同接入点消费的成熟业务工作流。

当前语境下：

- `企业微信智能机器人` 是接入点
- `企业微信 webhook 机器人` 是接入点
- `知识库调用` 是一个 `MicroAPP`

所以系统不再表达成：

- “接了一个机器人，就天然带一个知识库能力”

而表达成：

- “某个接入点，绑定了某个 `MicroAPP`”

当前主约束定为：

> 一个接入方式绑定一个 MicroAPP。

## 为什么要单独抽 `MicroAPP`

如果继续把“知识库调用”写成接入方式的一部分，会马上遇到三个问题：

1. 同一套知识库问答链路会被重复塞进企微、飞书、钉钉各自的配置逻辑里。
2. 接入点和业务能力会被耦死，后面无法明确“这个入口到底在消费什么业务能力”。
3. 前端会自然退化成“平台配置页”，而不是“入口绑定业务能力”的轻量产品。

所以这里必须拆：

- 接入方式负责“消息怎么进、结果怎么回、认证怎么做”
- `MicroAPP` 负责“收到一个兼容请求后，具体跑哪条业务工作流”

## 核心概念

### 1. Platform

平台提供方。

例如：

- `wecom`
- `lark`
- `dingtalk`

它解决的是协议来源，不解决业务工作流。

### 2. Instance

一个平台下的一个接入实例。

它解决的是配置边界。

例如：

- 某个企业微信企业实例
- 某个飞书租户实例

实例承载：

- 基础凭据
- 实例名称
- 可用能力列表
- 当前状态

### 3. AccessPoint

实例下面一个实际对外收发的入口或出口。

例如：

- 企业微信智能机器人
- 企业微信 webhook 机器人
- 飞书 bot
- 飞书 webhook
- 未来的自定义智能体入口

它解决的是：

- 外部消息从哪进
- 外部结果往哪回
- 接口形态是什么

### 4. MicroAPP

一个可注册、可复用、可配置的业务能力单元。

它解决的是：

- 这条入口进来以后，到底跑哪套业务逻辑

第一批 `MicroAPP` 候选：

- `knowledge_query`
- `knowledge_ingest`
- `org_directory_lookup`
- `sales_copilot`
- `mail_center`
- `image_generation`
- `computer_use`
- `office_suite`（文枢）

## 当前绑定关系

当前模型明确采用：

```text
Platform
  -> Instance
    -> AccessPoint
      -> MicroAPP
```

这里的关键不是平台，而是最后两层：

- `AccessPoint` 负责适配平台协议
- `MicroAPP` 负责承接业务工作流

当前约束：

- 一个 `AccessPoint` 同时只绑定一个 `MicroAPP`

这样做的原因很直接：

1. 桌面端产品要轻，不做 SaaS 运维后台。
2. 单个入口绑定单个微应用，用户心智最清楚。
3. 调试边界更干净，失败时容易判断是入口问题还是工作流问题。

## `MicroAPP` 的接口责任

一个 `MicroAPP` 不是任意脚本集合，它至少要声明三类信息：

### 1. 支持哪些接入点

例如：

- `knowledge_query`
  - 支持：
    - `wecom.smart_robot`
    - `lark.bot`
    - `future.custom_agent`
  - 不支持：
    - `wecom.webhook_robot`

因为 `webhook` 更像通知出口，不是问答入口。

### 2. 接口兼容契约

`MicroAPP` 不能直接依赖某个平台的原始消息结构。

它应该只接受标准化后的请求，例如：

- `text`
- `sender`
- `conversation`
- `mentions`
- `attachments`
- `knowledgeBaseSelector`

也就是说：

- 平台差异在 `AccessPoint Adapter`
- 业务逻辑在 `MicroAPP`

### 3. 运行配置

`MicroAPP` 自己不保存“某个入口当前绑了什么业务参数”。

它只声明：

- 支持哪些接入点
- 绑定时要求填写哪些字段
- 运行时交给哪个执行器

例如 `knowledge_query` 只声明它需要：

- `knowledgeBaseId`

但具体某个企微智能机器人这次选了哪个知识库，不保存在 `MicroAPP` 本体里，而保存在“接入点绑定记录”里。

## 为什么 `MicroAPP` 不是 MCP / Tool

这里必须切开：

- `Tool`
  - 是 agent 或 runtime 可以执行的具体工具
- `MCP`
  - 是能力暴露和调用协议
- `MicroAPP`
  - 是企业集成域里的业务工作流单元

`MicroAPP` 可以内部调用工具，也可以未来被包装成 MCP 能力。

但在产品建模上，它不等于：

- 工具注册
- MCP Server
- Harness capability

否则第三方集成会再次被 runtime 细节绑架。

## 第一批建议的 `MicroAPP`

### `knowledge_query`

作用：

- 接收文本问题
- 调用本地知识库 / RAG 工作流
- 返回一条稳定回答

这是当前第三方集成主线。

### `knowledge_ingest`

作用：

- 接收外部文档或消息源
- 进入知识库导入流程

### `office_suite` / 文枢

作用：

- 统一承接 Word / Excel / PowerPoint 文件处理任务
- 产品上保持一个微应用，内部保持三个 Office 领域 Runtime
- 当前桌面入口主要用于调试和验证
- 当前任务级 Runtime 合同见 `office-runtime-task-contract.md`
- 未来 Skill 只消费稳定 Runtime 合同，不直接依赖底层 Office SDK

当前实现边界与未来方向见：

- `office-runtime-task-contract.md`
- `office-suite-microapp-design.md`

## 当前活跃文档

- `office-runtime-task-contract.md`
- `office-suite-microapp-design.md`
- `media-capability-packaging-design.md`
- `image-generation-microapp-poc.md`
- `computer-use-microapp-poc.md`
- `gpt-sovits-microapp-poc.md`
- `tts-studio-runtime-notes.md`

这更适合飞书等文档平台。

### `org_directory_lookup`

作用：

- 对组织通讯录、部门和成员摘要做统一查询

### `sales_copilot`

作用：

- 未来按业务角色提供销售导向工作流

这类 `MicroAPP` 不应该提前塞进 `smart robot` 逻辑里，而应单独建模。

### `image_generation`

作用：

- 接收 prompt、风格和画幅参数
- 调用外部生图 provider
- 返回可预览、可复用的图片结果与生成元数据

当前 docs-only POC 见：

- `image-generation-microapp-poc.md`

### `mail_center`

作用：

- 保存本地邮箱账号配置
- 通过 SMTP 发送测试邮件
- 通过 IMAP 拉取最近一批收件箱邮件
- 在桌面内展示真实收件箱列表

当前第一版只覆盖：

- backend HTTP 路由
- 本地 SQLite 账号与收件箱缓存
- 邮件中心页面真实列表展示

当前不覆盖：

- 规则中心
- 模板中心
- 多端同步任务编排

### `computer_use`

作用：

- 接收一个明确目标
- 在受控执行面里完成最小界面操作
- 返回截图、步骤状态、结果摘要和失败原因

当前 docs-only POC 见：

- `computer-use-microapp-poc.md`
- `computer-use-feature-design.md`

## 对前端的产品约束

为了避免重新做成平台后台，前端应该遵守下面这条心智：

- 用户在企业集成页里配置的是“接入实例”和“入口”
