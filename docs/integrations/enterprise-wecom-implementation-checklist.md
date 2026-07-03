# 企业微信实施清单

Status: Planned
Owner: runtime / chat / auth / knowledge-base
Last verified: 2026-06-27
Layer: raw-source
Module: Develoments
Feature: EnterpriseIntegration
Doc Type: plan

## 单点真相范围

这页只回答一件事：

企业微信如果作为当前项目的第一阶段第三方接入对象，应该如何实施。

它覆盖：

- 第一阶段实施目标
- 后端接口清单
- 本地表结构建议
- 任务流与消费链路
- chat 主界面插件化接入方案
- 验收项与阶段顺序
- 企微机器人作为主要消费出口的落地方式

它不覆盖：

- 飞书实施细节
- 企业微信所有开放能力的完整穷举
- 最终生产级监控、审计和运维手册

相关文档：

- `integrations/enterprise-wecom-integration-poc.md`
- `integrations/third-party-integration-architecture.md`
- `integrations/third-party-integration-consumption-model.md`
- `chat/chat-tool-integration-poc.md`
- `uchat.md`

## Goal

这篇实施清单的目标不是继续讨论“值不值得接”，而是明确：

企业微信第一阶段具体做什么、不做什么，以及先后顺序是什么。

这里有一个关键决策需要固定：

- 企业微信能力的最终消费入口应回到 chat 主界面
- 但它不应以硬编码业务按钮散落在 chat 中
- 而应以外挂插件能力的形式进入 chat runtime

也就是说：

- 配置和管理入口仍在 `Settings -> Integrations`
- 真正的日常消费入口回到 chat 主界面
- chat 通过插件能力消费企业微信，而不是直接认识企业微信协议

## 实施定位

企业微信第一阶段不是做“完整企业微信平台接入”，而是做一个：

- backend-first 的 provider 接入
- chat 可消费的外挂插件能力
- 同时保留身份、组织、通知的基础能力闭环
- 其中“通知 / 结果触达”优先走企业微信机器人 webhook，而不是优先走网页授权链路
- 网页授权链路保留为延后实现，不删除原设计

第一阶段应同时满足两条线：

### 1. 集成基础线

- provider 配置
- 身份绑定
- 通讯录同步
- 测试通知

### 2. chat 消费线

- 在 chat 主界面暴露企业微信插件能力
- 通过现有 chat tool loop / Harness 路径消费
- `uchat` 可展示插件执行状态

### 3. 机器人消费线

- 知识库导入完成后，通过企业微信机器人推送结果
- 任务失败或告警优先通过企业微信机器人触达
- chat 插件动作可在需要时生成机器人消息，但不把机器人当成 chat 独立 UI

### 4. 延后实现

- 网页授权绑定主链路
- 可信域名与 Worker 回调落地
- 若后续域名条件满足，再把这条线从“延后实现”恢复成可用主链路

## 第一阶段范围

### In scope

- 企业微信 provider 基座
- 配置、连接状态、绑定状态、同步状态
- 最小组织投影
- 最小通知能力
- chat 主界面插件化入口
- 一个到两个只读或低风险插件能力
- 执行 trace 和最小结果展示

这里的“绑定状态”需要拆开理解：

- 首期正式路径：
  - 手工绑定 `userid`
- 可选验证路径：
  - 网页授权绑定 POC
- 首期通知路径：
  - 企业微信机器人 webhook

### Out of scope

- 大规模审批流引擎
- 高敏感聊天存档导入
- 群消息全文检索
- 大量企业微信专属 UI 面板塞进 chat
- 直接在 chat 中暴露复杂管理后台
- 把 Cloudflare 当正式生产授权基础设施

## 第一阶段插件能力建议

第一阶段不要把企业微信全部能力都塞进 chat。

建议只做以下两类插件能力：

### 插件 1：企业微信通知

能力形态：

- 向已绑定企业微信身份的用户发送通知
- 或向预配置目标发送消息
- 优先推荐群机器人 webhook 作为通知出口

适合的 chat 用法：

- “把这段总结发到企业微信”
- “通知我知识库导入完成”

### 插件 2：企业微信组织查询

能力形态：

- 查询当前用户或目标用户的部门 / 组织信息摘要

适合的 chat 用法：

- “这个知识库应该授权给哪个部门”
- “查询某个同事所属部门”

约束：

- 第一阶段只返回摘要，不返回高敏感组织明细

不建议第一阶段就做：

- 任意群发
- 任意联系人操作
- 审批动作创建
- 复杂通讯录遍历

## 消费决策

企业微信能力的消费分成两层。

### 层 1：后台被动消费

由 backend 自动使用：

- 身份绑定
- 通讯录同步
- ACL 权限收敛
- 业务通知
- 业务通知优先投递到企业微信机器人 webhook

### 层 2：chat 插件消费

由 chat 主界面显式消费：

- 企业微信通知插件
- 企业微信组织查询插件

这意味着企业微信不是只停留在设置页，也不是直接嵌成 chat 页面里的大量业务控件，而是：

- 作为外挂插件能力进入 chat runtime

如果只保留一条最稳的消费出口，那么优先级应是：

1. backend 自动生成机器人消息
2. 机器人把消息送达企业微信群
3. chat 主界面保留插件化发送能力作为补充

## chat 插件化实施原则

### 1. 不让 `uchat` 直接认识企业微信

`uchat` 仍然只负责：

- 状态机
- canonical message
- 工具执行态展示

企业微信能力应通过：

- tool surface
- plugin capability
- Harness invocation

接入。

### 2. 企业微信能力不是特判分支

不要在 chat 里写：

- `if provider === 'wecom'`

而要让企业微信能力表现成普通插件能力，例如：

- `wecom_notify_send`
- `wecom_org_lookup`

### 3. 仍走现有 tool loop

企业微信插件能力应复用现有方向：

- chat tool surface resolver
- provider tool-capable generation
- Harness invocation
- trace event
- `uchat` execution block

不要单独绕开现有 chat tool loop 再造一套“企业微信聊天动作系统”。

## 目录结构建议

### Backend

```text
server/src/integrations/
  core/
  wecom/
    config.ts
    client.ts
    auth.ts
    contacts-sync.ts
    notifier.ts
    org.ts
    plugin-tools.ts
    provider.ts
    types.ts
```

### Chat / Tool 接入层

建议新增或扩展：

- `server/src/routes/proxy-provider/chat-tool-surface.ts`
- `server/src/routes/proxy-provider/chat-tool-loop.ts`
- `server/src/mcp/harness/...`

### Frontend

设置侧：

- `desktop/src/features/Settings/pages/Integrations/...`

chat 侧：

- 继续沿用 `uchat` 现有 tool execution UI
- 不新增独立企业微信聊天 UI 系统

## 后端接口清单

### 集成管理接口

- `GET /integrations`
- `GET /integrations/wecom/status`
- `POST /integrations/wecom/connect`
- `POST /integrations/wecom/disable`

用途：

- 设置页展示连接状态
- 启用 / 停用 provider

### 身份绑定接口

- `POST /integrations/wecom/bind/start`
- `POST /integrations/wecom/bind/finish`
- `GET /integrations/wecom/bind/me`
- `DELETE /integrations/wecom/bind/me`

用途：

- 发起绑定
- 完成绑定
- 查询当前用户绑定状态
- 解除绑定

### 组织同步接口

- `POST /integrations/wecom/sync/contacts`
- `GET /integrations/wecom/sync/jobs`
- `GET /integrations/wecom/sync/jobs/:jobId`

用途：

- 手动同步组织
- 查看同步任务状态

### 通知测试接口

- `POST /integrations/wecom/test/send-message`

用途：

- 设置页发测试通知

### chat 插件能力接口

这里不建议额外暴露 provider 专属 chat route。

chat 侧应走现有统一入口：

- `POST /proxy/chat/default`

企业微信能力通过 tool surface 暴露给模型，而不是通过前端单独请求：

- `/chat/wecom/send`
- `/chat/wecom/org`

这种专用 route。

## 表结构建议

### `integration_connections`

字段建议：

- `id`
- `provider`
- `tenant_id`
- `app_id`
- `enabled`
- `config_status`
- `last_health_status`
- `created_at`
- `updated_at`

### `external_identity_bindings`

字段建议：

- `id`
- `user_id`
- `provider`
- `external_user_id`
- `external_union_id`
- `bind_status`
- `created_at`
- `updated_at`

索引建议：

- unique(`provider`, `external_user_id`)
- unique(`provider`, `user_id`)

### `org_departments`

字段建议：

- `id`
- `provider`
- `external_department_id`
- `name`
- `parent_external_department_id`
- `status`
- `raw_snapshot_json` 可选
- `updated_at`

### `org_users`

字段建议：

- `id`
- `provider`
- `external_user_id`
- `display_name`
- `email`
- `mobile`
- `status`
- `raw_snapshot_json` 可选
- `updated_at`

### `org_user_departments`

字段建议：

- `id`
- `provider`
- `external_user_id`
- `external_department_id`
- `updated_at`

### `integration_sync_jobs`

字段建议：

- `id`
- `provider`
- `job_type`
- `status`
- `started_at`
- `finished_at`
- `error_summary`
- `stats_json`

### `integration_events`

字段建议：

- `id`
- `provider`
- `event_type`
- `event_source`
- `target_ref`
- `status`
- `error_summary`
- `retry_count`
- `created_at`

### `knowledge_base_acl`

如果现有表已存在，则建议扩充：

- `source_provider`
- `source_ref`

用于标记该 ACL 是否来自企业微信组织映射。

## 插件能力定义建议

建议在企业微信 provider 内输出两类插件能力定义：

### `wecom_notify_send`

输入草图：

```ts
{
  targetType: 'self' | 'user';
  targetUserId?: string;
  title?: string;
  content: string;
}
```

输出草图：

```ts
{
  success: boolean;
  target: string;
  summary: string;
}
```

规则：

- 第一阶段默认仅允许 `self`
- `user` 需要后续权限设计确认

### `wecom_org_lookup`

输入草图：

```ts
{
  query: string;
  mode?: 'self' | 'user';
}
```

输出草图：

```ts
{
  success: boolean;
  departments: Array<{
    id: string;
    name: string;
  }>;
  summary: string;
}
```

规则：

- 第一阶段只返回必要摘要
- 不返回大批量组织明细

## 任务流

## 任务流 A：provider 配置

1. 在设置页录入企业微信配置
2. backend 校验并保存连接配置
3. 更新 `integration_connections`
4. 设置页显示 `connected` / `error`

## 任务流 B：身份绑定

1. 用户在设置页或账户页发起绑定
2. backend 启动企业微信身份校验
3. 校验完成写入 `external_identity_bindings`
4. 设置页和账户页显示已绑定

## 任务流 C：通讯录同步

1. 用户在设置页点击同步
2. backend 创建 `integration_sync_jobs`
3. 拉取部门和用户
4. 更新 `org_departments` / `org_users` / `org_user_departments`
5. 更新 job 状态

## 任务流 D：chat 插件调用

1. 用户在 chat 主界面发消息
2. backend 解析当前线程上下文
3. tool surface 判断企业微信插件能力是否可见
4. 模型发起插件调用
5. backend 通过 Harness 执行企业微信插件能力
6. 返回 tool result
7. 模型继续生成最终回答
8. `uchat` 展示执行状态和结果摘要

## 任务流 E：业务事件通知

1. 知识库导入完成或任务完成
2. 业务模块发领域事件
3. integrations 层判断是否启用企业微信通知
4. 调用 `wecom_notify_send` 或 notifier provider
5. 记录 `integration_events`

## 与 chat 主界面的关系

这里要明确一个产品决定：

- 企业微信能力最终应回到 chat 主界面

但实现方式不是：

- 在 chat 页加一个企业微信专属大面板

而是：

- 以外挂插件形式进入 chat runtime

这样做的好处是：

- 符合 `uchat` 的分层边界
- 复用现有 tool loop 和 trace UI
- 后续飞书、钉钉也能按同一模式进入 chat
- 避免把 chat 页面改成第三方平台操作后台

## 验收项

### Phase 1 基础集成验收

- [ ] 设置页可见企业微信 provider
- [ ] 企业微信配置可保存
- [ ] 连接状态可见
- [ ] 测试通知可发送
- [ ] 当前用户可完成绑定
- [ ] 当前用户可看到绑定状态
- [ ] 手动同步通讯录可执行
- [ ] 同步结果和错误状态可见

### Phase 2 chat 插件验收

- [ ] chat tool surface 可暴露企业微信插件能力
- [ ] 模型可触发 `wecom_notify_send`
- [ ] 模型可触发 `wecom_org_lookup`
- [ ] Harness 执行 trace 可观测
- [ ] `uchat` 能展示插件执行态
- [ ] 最终回答仍正常到达线程

### Phase 3 业务联动验收

- [ ] 企业微信组织映射可影响知识库 ACL
- [ ] 知识库导入完成可触发企业微信通知
- [ ] 通知失败不会破坏主业务事务
- [ ] 失败会记录到 `integration_events`

## 不要做的事

- 不要让 chat 直接调用企业微信 SDK
- 不要让 `uchat` 直接持有企业微信协议字段
- 不要在前端保存企业微信 secret
- 不要第一阶段就开放任意人或任意群的消息操作
- 不要绕开现有 chat tool loop 单独搞一套企业微信聊天动作系统

## 推荐实施顺序

### Step 1

- `server/src/integrations/wecom/*`
- 设置页 provider 状态和配置

### Step 2

- 身份绑定
- 通讯录同步
- 测试通知

### Step 3

- `wecom_notify_send`
- `wecom_org_lookup`
- chat tool surface 接入

### Step 4

- `uchat` 执行态展示确认
- trace 验证

### Step 5

- 知识库 ACL 联动
- 导入完成通知联动

## Recommendation

企业微信第一阶段最稳的实施路线应是：

- 先做 provider 基础接入
- 再做身份、组织、通知基础能力
- 然后把消费入口拉回 chat 主界面
- 但通过外挂插件形式接入，而不是把 chat 改成企业微信专属业务页

这个方案既保留了企业微信的企业集成价值，也符合当前项目 `uchat + chat tool loop + backend-first` 的运行时边界。
