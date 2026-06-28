# 第三方集成后端设计

Status: Planned
Owner: backend / integrations
Last verified: 2026-06-27
Layer: raw-source
Module: Develoments
Feature: IntegrationPlatform
Doc Type: design

## 单点真相范围

这页只回答一件事：

如果当前项目要把企业微信、飞书等第三方接入做成可扩展的后端能力平台，backend 应该怎么设计。

它覆盖：

- 领域边界
- 核心数据模型
- repository 分层
- 运行时管理
- provider 适配器边界
- 管理 API 分层
- 迁移与兼容策略

它不覆盖：

- 前端页面布局
- 某个 provider 的完整 API 细节
- 第二期以后所有高级能力的一次性实现

相关文档：

- `integrations/third-party-integration-architecture.md`
- `integrations/wecom-instance-capability-design.md`
- `integrations/wecom-instance-capability-implementation-checklist.md`
- `integrations/enterprise-wecom-integration-poc.md`

## 1. 设计目标

当前项目已经验证过企业微信机器人最小闭环，但现状仍偏向：

- 单 provider
- 单例配置
- 单运行时

这不适合继续承接：

- 多企业
- 多机器人
- 多平台
- 多种能力类型

因此 backend 的目标应升级为：

1. 用统一核心模型承接多平台接入
2. 把 provider 细节关在适配层内
3. 让业务侧只消费“能力”，不直接消费企微/飞书协议
4. 允许一个实例下挂多种 capability
5. 兼容现有 WeCom 第一期开出的真实配置

## 2. 核心结论

backend 核心模型定为：

```text
Integration Provider
  -> Integration Instance
    -> Integration Capability
```

其中：

- `Provider`
  - 平台类型，例如 `wecom`、`lark`
- `Instance`
  - 一个企业、工作区或安装单元
- `Capability`
  - 该实例下可单独启停、配置、消费的一项能力

这意味着：

- 企业微信不是核心模型
- 飞书也不会需要复制一套平行核心结构
- 业务层以后面向 capability 工作

## 3. 领域边界

backend 里建议把第三方集成视为独立领域：

- `integrations domain`

它与现有模块的关系如下：

### integrations domain 负责

- 管理 provider / instance / capability 元数据
- 保存接入配置与 secret
- 管理 capability 运行时
- 适配 provider SDK / API
- 向业务层暴露统一能力入口
- 沉淀 provider 侧状态、错误和审计信息

### 业务域负责

- `chat`
  - 决定何时调用通知或问答 capability
- `knowledge-base`
  - 提供知识库查询、绑定对象和访问契约
- `auth`
  - 在未来需要时消费身份绑定能力
- `evaluation / jobs`
  - 在未来需要时消费通知或流程动作能力

### 明确不负责

第三方集成域不直接承载：

- 通用 RAG 检索实现
- 知识库文档生命周期
- 业务对话 UI 状态
- provider 无关的聊天线程持久化

## 4. 后端分层

建议分成五层：

```text
routes
  -> application services
    -> repositories / runtime manager
      -> provider adapters
        -> external provider sdk/api
```

### 4.1 routes

职责：

- 管理接口收口
- 参数校验
- 权限校验
- 将请求路由到 application service

### 4.2 application services

职责：

- 编排 instance / capability 的增删改查
- 编排 capability 启停与测试
- 编排 capability 与知识库绑定
- 为业务域提供统一消费入口

这一层不应直接写 SQL，也不应直接拼 provider 协议。

### 4.3 repositories

职责：

- 负责本地数据读写
- 不关心 provider SDK
- 不承载业务编排

### 4.4 runtime manager

职责：

- 管理长连接、缓存 client、运行状态
- 按 capability 维度维护运行时对象
- 屏蔽不同 provider 运行时差异

### 4.5 provider adapters

职责：

- 对接具体 provider 的 SDK / HTTP API
- 实现 capability 级发送、接收、认证、状态检查
- 将 provider payload 转换为内部统一模型

## 5. 数据模型策略

## 5.1 核心表

当前核心表建议固定为两张：

- `integration_instances`
- `integration_capabilities`

其中：

### `integration_instances`

承载“企业 / 工作区 / 安装单元”级配置。

建议字段职责：

- `id`
- `provider`
- `name`
- `external_tenant_id`
- `config_json_encrypted`
- `enabled`
- `is_default`
- `created_at`
- `updated_at`

实例级配置只放“租户级 / 安装级 / 企业级”信息，例如：

- WeCom:
  - `corpId`
  - `agentId`
  - `appSecret`
  - `contactsSecret`
- Lark:
  - `appId`
  - `appSecret`
  - `tenantKey`

### `integration_capabilities`

承载“某个实例下的一项能力”。

建议字段职责：

- `id`
- `instance_id`
- `provider`
- `type`
- `name`
- `enabled`
- `knowledge_base_id`
- `config_json_encrypted`
- `runtime_json`
- `is_default`
- `created_at`
- `updated_at`

能力级配置只放“该能力独有的接入参数”，例如：

- `wecom.webhook_robot`
  - `webhookUrl`
  - `webhookSecret`
- `wecom.smart_robot`
  - `botId`
  - `secret`
  - `replyMode`

## 5.2 为什么不用一开始就拆很多 provider 专属表

第一期后端不建议直接拆成：

- `wecom_instances`
- `lark_instances`
- `wecom_smart_robots`
- `wecom_webhook_robots`

原因是：

- 当前差异主要在 config 内容和运行时协议
- 还没积累到值得拆 provider 专属聚合表的复杂度
- 先用稳定的通用主表，可以更快承接第二个平台

如果未来某 provider 出现强结构化对象，再在 provider 子域内部增加扩展表，而不是破坏核心主表。

## 5.3 配置与状态分离

必须区分：

- 配置真相
- 运行时状态

建议原则：

- 长期配置放 `config_json_encrypted`
- 短期状态放 `runtime_json`
- 更高频的瞬时状态优先在内存 runtime manager 中维护

其中 `runtime_json` 只落可恢复、可展示的摘要状态，例如：

- 最近连接状态
- 最近错误摘要
- 最后成功时间

不建议把完整长连接会话状态持久化进数据库。

## 6. Repository 边界

## 6.1 通用 repository

建议保留：

- `integration-instances.repository.ts`
- `integration-capabilities.repository.ts`

它们只做：

- CRUD
- 默认实例 / 默认能力选择
- 旧数据迁移辅助

它们不做：

- 启动 WebSocket
- 发消息
- 调 RAG
- 拼 provider 请求

## 6.2 provider repository 不应成为新核心

像 `wecom-settings.repository.ts` 这类旧 repository：

- 当前阶段保留
- 仅作为迁移来源和兼容入口

但它不应继续扩展成新的核心写路径。

主写路径应逐步迁到：

- `integration_instances`
- `integration_capabilities`

## 7. 运行时管理设计

## 7.1 为什么必须引入 runtime manager

像 WeCom 智能机器人这类长连接能力，不适合继续做成：

- 全局单 client
- 读一份全局 settings 即启动

因为未来会出现：

- 多实例
- 多 capability
- 不同 capability 独立启停
- 一个 capability 出错不能拖垮别的 capability

## 7.2 推荐模型

建议新增统一运行时管理器，例如：

- `IntegrationRuntimeManager`

运行时键建议为：

```text
provider + capabilityId
```

每个 runtime entry 至少维护：

- `capabilityId`
- `provider`
- `type`
- `status`
- `lastError`
- `startedAt`
- `lastHeartbeatAt`
- `clientRef`

## 7.3 运行时职责

`IntegrationRuntimeManager` 负责：

- `startCapability(capabilityId)`
- `stopCapability(capabilityId)`
- `restartCapability(capabilityId)`
- `getCapabilityStatus(capabilityId)`
- `listStatuses(instanceId?)`

同时负责：

- 防重复启动
- 出错隔离
- 断线重连策略挂接
- provider runtime 生命周期托管

## 7.4 provider runtime adapter

每类 capability 需要一个 runtime adapter，例如：

- `WeComSmartRobotRuntimeAdapter`

它只关心：

- 如何 connect
- 如何 receive
- 如何 reply / send
- 如何把 provider 消息转成内部事件

它不直接决定知识库选哪个，也不直接决定业务页面怎么消费。

## 8. Provider 适配层边界

provider 目录建议继续维持：

```text
server/src/integrations/
  core/
  wecom/
  lark/
```

其中：

### `core/`

负责：

- 通用类型
- capability 类型注册
- runtime manager 接口
- provider registry
- 统一错误模型
- 统一事件模型

### `wecom/`

负责：

- WeCom instance config 解码
- WeCom capability config 解码
- webhook robot 发送适配
- smart robot 长连接适配
- WeCom 消息入站转换

### `lark/`

当前可先空置或只放占位类型，不急着提前实现大量逻辑。

## 9. API 分层

backend API 应分三类，不要混成一个大而杂的 `wecom` 路由。

## 9.1 管理 API

面向设置页。

例如：

- `GET /integrations/providers`
- `GET /integrations/instances`
- `POST /integrations/instances`
- `PATCH /integrations/instances/:id`
- `GET /integrations/instances/:id/capabilities`
- `POST /integrations/capabilities`
- `PATCH /integrations/capabilities/:id`
- `POST /integrations/capabilities/:id/test`
- `POST /integrations/capabilities/:id/start`
- `POST /integrations/capabilities/:id/stop`

## 9.2 provider callback / event API

面向第三方平台。

例如未来如果某 provider 需要公网回调，可保留：

- `/integrations/wecom/callback/*`
- `/integrations/lark/callback/*`

但对桌面长连接模式来说，这层可能很薄，甚至不存在 HTTP 入站。

## 9.3 内部消费 API / service

面向项目内部业务模块。

例如：

- chat 里调用“发送到某 capability”
- smart robot 收到消息后调用“按 capability 绑定知识库执行问答”

这一层更适合做成 service，而不是额外暴露 HTTP。

## 10. 业务消费模型

业务层不要再拿 provider 配置自己拼协议。

应该统一通过 capability 消费。

例如：

### 通知发送

业务层传入：

- `capabilityId`
- `message payload`

由 integrations service 决定：

- capability 类型
- 用哪个 provider adapter
- 如何发送

### 机器人问答

智能机器人收到入站消息后，统一走：

1. 根据 `capabilityId` 找到 capability
2. 读取 `knowledgeBaseId`
3. 调本地 RAG service
4. 将结果交回对应 provider adapter 回复

这样业务层依赖的是：

- “问答能力”

而不是：

- “企微 SDK 某个 reply 方法”

## 11. 迁移与兼容策略

这次不是普通小修，而是架构级迁移。

但迁移策略应保持温和：

## 11.1 保留旧表

`wecom_settings` 暂时保留，角色是：

- 历史配置来源
- 升级兼容入口

不建议立刻删除。

## 11.2 新表成为主模型

初始化阶段可执行一次轻量迁移：

1. 若不存在 `wecom` default instance，则从 `wecom_settings` 生成
2. 若 default instance 下不存在 capability，则迁移：
   - `wecom.webhook_robot`
   - `wecom.smart_robot`

此后新功能主路径优先读写新表。

## 11.3 兼容期策略

兼容期内建议：

- 启动时允许旧表导入新表
- 页面读优先新表
- provider runtime 优先新表

而不是长期双写。

长期双写会让真相再次分裂。

## 12. 首期能力边界

第一期只建议把后端能力收敛到：

- `wecom.webhook_robot`
- `wecom.smart_robot`

并为未来预留：

- `wecom.sales_agent`
- `lark.bot`
- `lark.webhook`

其中：

- `sales_agent` 先作为 capability type 占位
- 不急着实现完整业务语义

## 13. 建议目录结构

建议后端逐步收敛到：

```text
server/src/integrations/
  core/
    types.ts
    providers.ts
    capability-types.ts
    provider-registry.ts
    runtime-manager.ts
    errors.ts
    events.ts
    services/
      integration-management.service.ts
      integration-dispatch.service.ts
  wecom/
    types.ts
    config.ts
    provider.ts
    webhook-robot.adapter.ts
    smart-robot.adapter.ts
    smart-robot.runtime.ts
```

这不是要求一次性重写，而是后续增量改造时的收敛方向。

## 14. 后端冻结结论

这轮后端设计应冻结以下原则：

1. 核心模型固定为 `Provider -> Instance -> Capability`
2. 主数据结构固定为 `integration_instances` 与 `integration_capabilities`
3. provider 专属逻辑只进 adapter，不进入核心表命名
4. 长连接类能力必须走 capability 级 runtime manager
5. 业务层统一按 capability 消费，不直接消费企微/飞书协议
6. `wecom_settings` 仅保留为迁移兼容来源，不再作为长期核心模型

如果后面继续实现时发现某些 provider 差异很大，也应优先在：

- provider adapter
- provider 扩展表

里消化，而不是推翻这套核心主模型。
