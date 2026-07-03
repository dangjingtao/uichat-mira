# 第三方平台 Instance-Capability 通用模型设计

Status: Planned
Owner: runtime / chat / integrations
Last verified: 2026-06-27
Layer: raw-source
Module: Develoments
Doc Type: design

## 单点真相范围

这页只回答一件事：

如果当前项目未来不只接企业微信，还会接飞书等其它平台，那么第三方接入的核心模型应该如何设计。

它覆盖：

- 为什么不能继续用单平台单例配置
- 为什么核心模型应该平台无关
- 为什么顶层应该是 `Instance`
- 为什么第二层应该是 `Capability`
- 企业微信作为首个 provider 时应如何落地到这套模型

它不覆盖：

- 任一 provider 的完整 API 细节
- 飞书实施步骤全文
- 最终生产级权限和调度系统

相关文档：

- `integrations/third-party-integration-architecture.md`
- `integrations/enterprise-wecom-integration-poc.md`
- `integrations/enterprise-wecom-implementation-checklist.md`
- `integrations/wecom-mcp-wrapper-design.md`
- `integrations/wecom-robot-phase-1-retrospective.md`

## 背景

当前项目里的企业微信实现，是沿着第一期最小闭环快速落地的：

- 一个全局 `wecom_settings`
- 一个全局智能机器人配置
- 一个全局 webhook 配置
- 一个全局智能机器人连接状态

这条线在第一期验证里是有效的，因为它解决的是：

- 本地应用能否接企业微信智能机器人
- 机器人能否调用本地 RAG
- 设置页能否完成最小配置和测试

但一旦进入下一阶段，这个模型就会暴露出两个问题：

1. 它默认只有一个企业
2. 它默认只有一个平台

而我们已经明确：

- 后续不只会有企业微信
- 未来还可能接飞书、钉钉等其它平台

因此，下一阶段如果继续沿着企微专属单例模型去补丁式扩展，后面几乎一定会推翻重来。

## 问题定义

下一阶段我们要支持的，不应只是：

- 多个企业微信机器人

而应是：

- 多个平台 provider
- 每个平台多个接入实例
- 每个实例多个能力挂点
- 每个能力拥有自己的配置、知识库、路由和运行状态

例如：

- `wecom` 下：
  - 智能机器人
  - webhook 通知
  - 销售智能体
- `lark` 下：
  - bot
  - webhook
  - 文档知识源

因此正确的问题不是“企微怎么多机器人”，而是：

- 第三方平台接入的核心模型应该怎么做

## 结论

推荐采用平台无关的核心模型：

```text
Integration Provider
  -> Integration Instance
    -> Integration Capability
```

也就是说：

- 平台是 provider
- 顶层接入单元是 instance
- 实际挂载的功能单元是 capability

企业微信只是：

- 第一个真实落地的 provider

而不是：

- 整个核心模型的命名基准

## 为什么不能继续做企微专属核心模型

如果现在直接把核心模型写死成：

- `wecom_instances`
- `wecom_capabilities`

短期看是快的，但长期会带来这些问题：

- 飞书接入时只能复制一套平行表结构
- repository 和 runtime 逻辑被 provider 名称绑死
- 设置页心智天然倾向“企微专属管理页”
- 通用能力无法自然抽象

后面很容易变成：

- `wecom_instances`
- `lark_instances`
- `wecom_capabilities`
- `lark_capabilities`

这就意味着核心层已经分裂。

因此，企微可以先实现，但核心模型不应该企微专属。

## 为什么顶层是 `Instance`

这里不建议顶层直接叫：

- `Robot`
- `Bot`
- `Channel`

因为这些词都把模型收窄到了“消息收发对象”，而不是“一个平台中的接入单元”。

顶层建议叫：

- `Integration Instance`

它表示的是：

- 某个平台上的一个接入实例
- 一个企业、工作区、组织或业务域下的一套连接配置
- 一个安装 / 连接 / 管理边界

这个词的好处是：

- 不被某个平台的专有名词绑死
- 比 `Tenant` 更贴近产品和设置页认知
- 能自然承接企业、工作区、环境等不同场景

## 为什么第二层是 `Capability`

第二层也不建议一开始就叫：

- `Robot Instance`
- `Bot Instance`

因为未来挂在某个实例下的对象，不一定都适合叫机器人。

例如：

- `wecom.webhook_robot`
  - 更像通知通道
- `wecom.smart_robot`
  - 更像问答入口
- `wecom.sales_agent`
  - 更像业务角色智能体
- `lark.knowledge_source`
  - 更像知识入口

如果第二层叫 `Capability`，这些对象都能被自然纳入。

它强调的是：

- 这是某个实例下挂载的一项能力

而不是：

- 这一定是某种固定类型的机器人

## 市场抽象参考

这个模型也更接近成熟平台的常见结构。

从官方产品抽象上看：

- Slack 更接近“workspace install + 多种 app 能力”
- Teams 更接近“tenant/app install + bots/tabs/message extensions”
- Feishu 更接近“应用 + 多能力挂载”

共同点都不是“机器人作为顶层对象”，而是：

- 顶层是组织 / 安装 / 连接单元
- 下层挂多种能力

参考：

- [Slack Events API](https://docs.slack.dev/apis/events-api/)
- [Slack Incoming Webhooks](https://docs.slack.dev/messaging/sending-messages-using-incoming-webhooks/)
- [Microsoft Teams app package](https://learn.microsoft.com/en-us/microsoftteams/platform/concepts/build-and-test/apps-package)
- [Feishu 开放平台概览](https://open.feishu.cn/document/platform-overveiw/overview)

## 推荐模型

### 第一层：`Integration Provider`

表示平台提供方。

第一批 provider 可能包括：

- `wecom`
- `lark`
- `dingtalk`

它的作用是：

- 标识平台类型
- 决定底层协议和适配器

### 第二层：`Integration Instance`

表示某个平台上的一个接入实例。

建议字段：

- `id`
- `provider`
- `name`
- `externalTenantId` 或 provider 侧组织标识
- `config`
- `enabled`
- `isDefault`
- `createdAt`
- `updatedAt`

在企微场景下，它承载：

- `corpId`
- `agentId`
- `appSecret`
- `contactsSecret`

在飞书场景下，它将承载飞书自己的租户级配置。

### 第三层：`Integration Capability`

表示某个实例下的一个具体能力挂点。

建议字段：

- `id`
- `instanceId`
- `provider`
- `type`
- `name`
- `enabled`
- `knowledgeBaseId`
- `config`
- `runtime`
- `isDefault`
- `createdAt`
- `updatedAt`

它承载：

- 消息通道配置
- 智能机器人配置
- 智能体配置
- 与能力直接相关的知识库、回复模式、提示词、工具画像等

## capability 命名建议

这里建议区分两层：

### 通用 capability category

用于平台无关分类：

- `webhook`
- `chat_bot`
- `business_agent`
- `org_sync`
- `oauth_binding`
- `knowledge_source`

### 平台专属 capability type

用于真正实例化某个平台能力：

- `wecom.smart_robot`
- `wecom.webhook_robot`
- `wecom.sales_agent`
- `lark.bot`
- `lark.webhook`
- `lark.knowledge_source`

这样做的好处是：

- 核心模型仍保持平台无关
- provider 细节仍然可以准确表达

## 企微作为首个 provider 的落地

当前阶段，我们并不是要一次性实现全平台。

更稳的做法是：

- 核心模型先平台无关
- 第一实现先落企业微信

也就是说：

- 现在先只实现 `provider = wecom`
- 但表结构、运行时抽象、设置页信息架构，已经为飞书等平台留好扩展位

企业微信第一批 capability 建议是：

- `wecom.smart_robot`
- `wecom.webhook_robot`
- `wecom.sales_agent`

其中：

- `wecom.sales_agent` 当前可只占位，不必在本轮做完整实现

## 配置归属原则

### Instance 级配置

属于 `Integration Instance`：

- 企业 / 工作区级配置
- 安装级配置
- 自建应用级配置

在企微里通常是：

- `corpId`
- `agentId`
- `appSecret`
- `contactsSecret`

### Capability 级配置

属于 `Integration Capability`：

- `botId`
- `secret`
- `webhookUrl`
- `replyMode`
- `knowledgeBaseId`
- `routingPolicy`
- `systemPromptProfile`
- `toolProfile`

## 存储策略建议

第一版不建议把所有 provider 的所有专属字段都平铺成列。

推荐：

- 核心表存稳定元数据
- provider 私有配置存 `config_json`

例如：

### `integration_instances`

```text
id
provider
name
external_tenant_id
config_json_encrypted
enabled
is_default
created_at
updated_at
```

### `integration_capabilities`

```text
id
instance_id
provider
type
name
enabled
knowledge_base_id
config_json_encrypted
runtime_json
is_default
created_at
updated_at
```

## 知识库绑定原则

知识库应绑定到 `Capability`，不应绑定到 `Instance`。

原因：

- 同一个实例下可能存在多个不同业务能力
- 每个能力应服务不同知识库或不同策略

例如：

- `wecom.smart_robot` -> 知识库 A
- `wecom.sales_agent` -> 知识库 B
- `wecom.webhook_robot` -> 不需要知识库

因此：

- `knowledgeBaseId` 属于 capability

## 运行时模型建议

### 当前模型

当前企业微信智能机器人是：

- 一个全局 client
- 一个全局状态
- 一组全局 start / stop / status

这只适用于：

- 单平台
- 单企业
- 单机器人

### 目标模型

目标应改为：

```text
IntegrationRuntimeManager
  -> provider
     -> instanceId
        -> capabilityId
           -> client
           -> status
           -> lastError
           -> metrics
```

建议接口：

- `startCapability(capabilityId)`
- `stopCapability(capabilityId)`
- `getCapabilityStatus(capabilityId)`
- `listInstanceCapabilities(instanceId)`

其中：

- `wecom.smart_robot` 走长连接 runtime
- `wecom.webhook_robot` 不维护常驻连接

## 前端信息架构建议

前端也不应继续做成“企微单表单”。

建议统一走：

```text
Settings -> Integrations
  -> Provider List
    -> Provider Instances
      -> Selected Instance
        -> Capabilities
          -> Selected Capability
```

第一阶段即使只实现企业微信，也建议让前端认知保持为：

- 平台
- 实例
- 能力

而不是：

- 企业微信页里的一堆单例字段

## 对现有模型的迁移建议

现有 `wecom_settings` 不应继续扩成最终模型。

建议把它视为：

- 第一阶段遗留结构
- 迁移来源

迁移方向不应是：

- 继续补企微特化表

而应是：

- 把已有企微数据迁到通用 `Integration Instance / Capability`

## 风险提示

这是一次明确的架构层升级，不是简单补几个配置字段。

它会影响：

- 表结构
- repository 边界
- 配置读取方式
- 运行时连接管理
- 身份绑定隔离方式
- 前端设置页信息架构
- 后续 Chat / MCP-style capability 的投影方式

但如果现在不在核心模型上去平台专属化，后面飞书接进来时整体返工会更大。

## Recommendation

如果已经明确未来不只接企业微信，而是还会接飞书等其它平台，那么当前正确的设计结论应当是：

- 核心模型采用平台无关的 `Integration Provider -> Instance -> Capability`
- 企业微信作为第一个真实 provider 落地

这样既不会过度超前到“一次性做全平台引擎”，也不会把核心模型永久锁死在企微专属命名和结构上。
