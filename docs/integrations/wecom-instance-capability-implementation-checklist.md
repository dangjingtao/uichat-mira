# 第三方平台 Instance-Capability 实施清单（企微先行）

Status: Planned
Owner: runtime / chat / integrations
Last verified: 2026-06-27
Layer: raw-source
Module: Develoments
Feature: EnterpriseIntegration
Doc Type: checklist

## 单点真相范围

这页只回答一件事：

如果要把当前第三方接入从“单平台单例配置”升级到平台无关的 `Provider -> Instance -> Capability` 模型，并由企业微信作为首个 provider 落地，具体应该怎么推进。

它覆盖：

- 本次升级的实施目标
- 通用数据模型与迁移清单
- 后端运行时改造清单
- 前端设置页改造清单
- API 改造清单
- 分阶段验收项

它不覆盖：

- 飞书完整实现
- 所有未来 provider 的一次性上线
- 最终生产级监控与告警体系

相关文档：

- `integrations/wecom-instance-capability-design.md`
- `integrations/third-party-integration-architecture.md`
- `integrations/third-party-integration-backend-design.md`
- `integrations/enterprise-wecom-implementation-checklist.md`
- `integrations/wecom-mcp-wrapper-design.md`

## Goal

本次实施的目标不是继续给企微单例配置打补丁，而是完成一次明确的核心模型升级：

- 从 provider 专属单例配置
- 升级到平台无关的：
  - `Provider`
  - `Instance`
  - `Capability`

并确保这次升级之后，项目具备下面这些基础能力：

1. 核心模型不再写死为企微专属单例
2. 支持多个接入实例
3. 每个实例下支持多个能力挂点
4. 企业微信可以作为首个 provider 落地
5. 后续飞书等平台可以复用这套核心结构

## 当前落地范围

### In scope

- 平台无关 `Instance-Capability` 数据模型
- 旧企微单例配置迁移策略
- 多实例 API 与设置页基础结构
- 企业微信作为首个 provider 的第一版落地
- 企微 `smart_robot` 与 `webhook_robot` 两类 capability 的第一版实现
- 智能机器人连接管理从全局单例升级为 capability 级

### Out of scope

- 飞书完整接入
- `sales_agent` 完整业务逻辑
- 通讯录多 provider 完全联动
- Chat / MCP 最终统一抽象的大升级

## 实施原则

### 1. 核心模型平台无关

本轮虽然先落企业微信，但核心层不应写死为：

- `WeCom Instance`
- `WeCom Capability`

而应优先抽成：

- `Integration Instance`
- `Integration Capability`

### 2. provider 先少、模型先稳

第一轮只实现：

- `provider = wecom`

但模型、命名、API 结构要为：

- `lark`
- `dingtalk`

留出扩展位。

### 3. 第一版 capability 先少

企微第一版只建议正式支持：

- `wecom.smart_robot`
- `wecom.webhook_robot`

`wecom.sales_agent` 先保留模型位置，不急着在本轮全部实现。

### 4. 迁移优先，不做硬切

现有企微单例数据已经承载了真实调试结果，因此不建议直接删除。

应采用：

- 旧结构作为迁移来源
- 新结构作为主路径

## Phase 0：设计冻结

目标：

- 确认本轮主模型为平台无关的 `Provider -> Instance -> Capability`
- 确认企业微信是首个 provider
- 确认第一版 capability 类型

Checklist：

- [ ] 确认核心模型使用平台无关命名
- [ ] 确认 `provider` 为显式字段
- [ ] 确认企业微信是 first provider
- [ ] 确认第一版企微 capability 类型为：
  - [ ] `wecom.smart_robot`
  - [ ] `wecom.webhook_robot`
- [ ] 确认 `wecom.sales_agent` 只占位，不在本轮完整实现
- [ ] 确认 `knowledgeBaseId` 归属到 capability
- [ ] 确认企业 / 工作区级配置归属到 instance

## Phase 1：通用数据模型升级

目标：

- 引入平台无关的实例表和能力表
- 保持旧企微单例表可读

Checklist：

- [ ] 新增 `integration_instances`
- [ ] 新增 `integration_capabilities`
- [ ] 为 `integration_instances.provider` 建立索引
- [ ] 为 `integration_capabilities.instance_id` 建立索引
- [ ] 为 `integration_capabilities.type` 建立索引
- [ ] 定义 `config_json_encrypted` 结构
- [ ] 定义 `runtime_json` 结构

建议字段：

### `integration_instances`

- [ ] `id`
- [ ] `provider`
- [ ] `name`
- [ ] `external_tenant_id`
- [ ] `config_json_encrypted`
- [ ] `enabled`
- [ ] `is_default`
- [ ] `created_at`
- [ ] `updated_at`

### `integration_capabilities`

- [ ] `id`
- [ ] `instance_id`
- [ ] `provider`
- [ ] `type`
- [ ] `name`
- [ ] `enabled`
- [ ] `knowledge_base_id`
- [ ] `config_json_encrypted`
- [ ] `runtime_json`
- [ ] `is_default`
- [ ] `created_at`
- [ ] `updated_at`

## Phase 2：企微迁移策略落地

目标：

- 把旧的企微单例配置迁成平台无关 instance / capability

Checklist：

- [ ] 读取旧 `wecom_settings`
- [ ] 生成一个默认 `integration_instance`
- [ ] 该 instance 的 `provider = wecom`
- [ ] 将企微企业级配置写入 instance config
- [ ] 若存在 `robotWebhookUrl`，迁移出一个 `wecom.webhook_robot`
- [ ] 若存在 `smartRobotBotId / smartRobotSecret`，迁移出一个 `wecom.smart_robot`
- [ ] 保留 `smartRobotKnowledgeBaseId`
- [ ] 保留 `smartRobotReplyMode`
- [ ] 迁移完成后，新逻辑优先走新表
- [ ] 兼容期内保留旧表读取能力

迁移验收：

- [ ] 企微已有配置在升级后仍可见
- [ ] 已有知识库绑定没有丢失
- [ ] 已有回复模式没有丢失
- [ ] 旧环境升级后不需要手工重新录入

## Phase 3：后端仓储与配置改造

目标：

- 从企微单例 repository 升级到通用实例 / 能力 repository

Checklist：

- [ ] 新增 `integration-instances.repository.ts`
- [ ] 新增 `integration-capabilities.repository.ts`
- [ ] 支持 `getInstance(instanceId)`
- [ ] 支持 `listInstances(provider?)`
- [ ] 支持 `getCapability(capabilityId)`
- [ ] 支持 `listCapabilities(instanceId)`
- [ ] 支持 `createInstance()`
- [ ] 支持 `updateInstance()`
- [ ] 支持 `createCapability()`
- [ ] 支持 `updateCapability()`
- [ ] 支持 `deleteCapability()`

企微适配层：

- [ ] 企微配置读取改为从通用 instance/capability 映射
- [ ] provider 适配层继续放在 `server/src/integrations/wecom/*`

## Phase 4：企微智能机器人运行时改造

目标：

- 从企微全局单 client 升级为 capability 级运行时

Checklist：

- [ ] 设计通用 `IntegrationRuntimeManager`
- [ ] 按 `provider + capabilityId` 管理运行时对象
- [ ] 企微 `smart_robot` 长连接按 capability 独立维护
- [ ] 支持：
  - [ ] `startCapability(capabilityId)`
  - [ ] `stopCapability(capabilityId)`
  - [ ] `getCapabilityStatus(capabilityId)`
  - [ ] `listCapabilityStatuses(instanceId)`

运行时验收：

- [ ] 两个不同企微 capability 可分别启动
- [ ] 一个 capability 出错不影响另一个 capability
- [ ] capability 状态能独立查询

## Phase 5：企微 webhook capability 改造

目标：

- webhook 从全局 URL 升级为 capability 级配置

Checklist：

- [ ] `sendWecomRobotMarkdownMessage` 支持按 capability 发送
- [ ] `sendWecomRobotTextMessage` 支持按 capability 发送
- [ ] webhook key 从 capability 配置读取
- [ ] 测试消息接口支持指定 capability
- [ ] 设置页支持按 capability 发送测试消息

## Phase 6：API 契约升级

目标：

- 让前端能管理 provider / instance / capability

Checklist：

- [ ] 新增 `GET /integrations/providers`
- [ ] 新增 `GET /integrations/:provider/instances`
- [ ] 新增 `POST /integrations/:provider/instances`
- [ ] 新增 `PUT /integrations/:provider/instances/:instanceId`
- [ ] 新增 `GET /integrations/:provider/instances/:instanceId`
- [ ] 新增 `GET /integrations/:provider/instances/:instanceId/capabilities`
- [ ] 新增 `POST /integrations/:provider/instances/:instanceId/capabilities`
- [ ] 新增 `PUT /integrations/capabilities/:capabilityId`
- [ ] 新增 `DELETE /integrations/capabilities/:capabilityId`
- [ ] 新增 `POST /integrations/capabilities/:capabilityId/start`
- [ ] 新增 `POST /integrations/capabilities/:capabilityId/stop`
- [ ] 新增 `GET /integrations/capabilities/:capabilityId/status`
- [ ] 新增 `POST /integrations/capabilities/:capabilityId/test/send-message`

兼容策略：

- [ ] 旧 `/mcp/wecom/config` 标记为兼容接口
- [ ] 旧企微单例接口在兼容期内映射到默认企微 instance / capability

## Phase 7：前端设置页升级

目标：

- 从企微单表单切到：
  - provider
  - instance
  - capability

Checklist：

- [ ] `Settings -> Integrations` 支持 provider 视角
- [ ] 当前阶段至少可展示 `wecom`
- [ ] provider 下显示实例列表
- [ ] 支持新建企微 instance
- [ ] 支持选择当前企微 instance
- [ ] 支持编辑 instance 基础配置
- [ ] 当前 instance 下显示 capability 列表
- [ ] 支持新增 capability
- [ ] 支持 capability 绑定知识库
- [ ] 支持 capability 启停
- [ ] 支持 capability 状态查看
- [ ] 支持 capability 发送测试消息

页面结构验收：

- [ ] 不再只有企微单例机器人表单
- [ ] 用户可以同时看到多个 instance
- [ ] 用户可以在某个 instance 下管理多个 capability

## Phase 8：企微第一版 capability 验收

### `wecom.smart_robot`

- [ ] 可创建多个 `wecom.smart_robot`
- [ ] 每个 capability 可独立配置：
  - [ ] `botId`
  - [ ] `secret`
  - [ ] `replyMode`
  - [ ] `knowledgeBaseId`
- [ ] 每个 capability 可独立启动 / 停止
- [ ] 每个 capability 可独立查看状态

### `wecom.webhook_robot`

- [ ] 可创建多个 `wecom.webhook_robot`
- [ ] 每个 capability 可独立配置：
  - [ ] `webhookUrl`
  - [ ] `webhookSecret`
- [ ] 每个 capability 可独立发测试消息

## Phase 9：飞书接入准备

目标：

- 虽然本轮不实现飞书，但核心模型必须保证飞书能接进来

Checklist：

- [ ] 核心表结构不依赖企微专属字段名
- [ ] runtime manager 不假设只有企微
- [ ] capability type 支持平台前缀
- [ ] 前端信息架构支持 provider 维度
- [ ] 后端 domain model 支持新增 `provider = lark`

## 不要做的事

- [ ] 不要继续扩全局 `wecom_settings` 当主模型
- [ ] 不要把核心表结构直接命名成企微专属长期真相
- [ ] 不要把 `sales_agent` 硬塞成普通机器人字段集合
- [ ] 不要把前端继续做成企微单例表单
- [ ] 不要让多实例支持只停留在企微局部逻辑里

## 分阶段验收

### M1：通用核心模型完成

- [ ] 新通用表存在
- [ ] provider 字段存在
- [ ] 迁移可跑
- [ ] 默认企微 instance 与 capability 生成成功

### M2：企微多实例基础可用

- [ ] 可创建多个企微 instance
- [ ] 可在 instance 间切换
- [ ] instance 配置独立保存

### M3：企微多 capability 基础可用

- [ ] 某个企微 instance 下可创建多个 capability
- [ ] `wecom.smart_robot` 与 `wecom.webhook_robot` 可共存
- [ ] 各 capability 配置互不覆盖

### M4：企微运行时独立可用

- [ ] 多个 `wecom.smart_robot` 可独立启动
- [ ] 单个 capability 出错不影响其他 capability
- [ ] 状态查询准确

### M5：前端闭环可用

- [ ] 设置页可以完整管理 provider / instance / capability
- [ ] 测试消息和状态查看都已迁入新模型

## Recommendation

这次升级最稳的推进方式是：

1. 先把平台无关的 `Provider -> Instance -> Capability` 模型和迁移跑通
2. 再让企业微信作为首个 provider 落进来
3. 然后把企微智能机器人运行时从单例改成 capability 级
4. 再升级设置页和 API
5. 最后再考虑飞书 provider、销售智能体、Chat 深度投影等后续能力

也就是说，当前最重要的不是“多做几个企微机器人”，而是把第三方接入从第一期的企微单例实现，正式升级成一个能承载多平台、多实例、多能力的稳定核心模型。
