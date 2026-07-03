# 企业微信接入 MicroAPP 接口设计

Status: Planned
Owner: integrations / runtime / knowledge-base
Last verified: 2026-07-02
Layer: raw-source
Module: Develoments
Feature: EnterpriseIntegration
Doc Type: design
Related:
  - ../microapp/README.md
  - third-party-integration-architecture.md
  - third-party-integration-consumption-model.md
  - enterprise-wecom-integration-poc.md
  - wecom-instance-capability-design.md

## 单点真相范围

这页只回答一件事：

企业微信作为第三方平台时，它的接入点应该如何绑定 `MicroAPP`，接口边界怎样设计。

它覆盖：

- 企业微信侧 `AccessPoint` 分类
- 企业微信与 `MicroAPP` 的绑定关系
- 标准化输入输出模型
- 企微入口适配到 `knowledge_query` 的接口约束

它不覆盖：

- 企业微信后台参数获取步骤
- 某个 SDK 的完整接入教程
- `MicroAPP` 自身内部工作流实现

## 设计目标

这篇设计不是要重新定义企业微信能力，而是要把企业微信从“平台配置”收口成“平台入口适配”。

企业微信在这里的职责只有两个：

1. 提供接入点
2. 把接入点请求适配成 `MicroAPP` 能消费的统一请求

`MicroAPP` 在这里的职责也只有两个：

1. 承接统一请求
2. 返回统一结果

## 当前企业微信接入点分类

### 1. `wecom.smart_robot`

性质：

- 问答入口
- 长连接消息接收
- 可回复文本消息

适合绑定：

- `knowledge_query`
- `org_directory_lookup`
- 未来的 `sales_copilot`

### 2. `wecom.webhook_robot`

性质：

- 主动通知出口
- 不承担稳定的问答入口能力

适合绑定：

- `notification_push`

不适合直接绑定：

- `knowledge_query`

原因很简单：

- webhook 更像消息投递通道，不像可持续对话入口

## 核心绑定规则

当前企微侧采用下面这条硬规则：

```text
一个企业微信 AccessPoint 绑定一个 MicroAPP
```

实例层只负责持有：

- corp / tenant 级配置
- 基础状态
- 当前有哪些 access point

具体某个企微入口到底跑什么业务，不放在实例层决定，而放在入口绑定层决定。

## 企业微信到 MicroAPP 的适配链路

```mermaid
flowchart LR
  A["WeCom AccessPoint"] --> B["WeCom Adapter"]
  B --> C["Normalized Request"]
  C --> D["MicroAPP Runtime"]
  D --> E["Normalized Response"]
  E --> F["WeCom Reply Adapter"]
```

其中：

- `WeCom Adapter`
  - 负责把企微原始事件转换成统一请求
- `MicroAPP Runtime`
  - 负责业务执行
- `WeCom Reply Adapter`
  - 负责把统一结果回写到企微

## 标准化请求模型

企业微信原始 payload 不应直接进入 `MicroAPP`。

建议统一成下面这类内部结构：

```ts
type IntegrationConversationKind = 'direct' | 'group';

type MicroAppInvokeRequest = {
  provider: 'wecom';
  accessPointType: 'wecom.smart_robot' | 'wecom.webhook_robot';
  instanceId: string;
  accessPointId: string;
  microAppId: string;
  messageId?: string;
  conversation: {
    id: string;
    kind: IntegrationConversationKind;
  };
  sender: {
    externalUserId: string;
    displayName?: string;
  };
  text?: string;
  mentions?: string[];
  attachments?: Array<{
    type: 'image' | 'file' | 'link';
    name?: string;
    url?: string;
  }>;
  context?: {
    receivedAt: string;
    rawProviderEventType?: string;
  };
};
```

这里的关键点是：

- `MicroAPP` 不认识企微原始字段名
- `MicroAPP` 只认识统一请求

## 标准化响应模型

`MicroAPP` 返回值也不应直接依赖企微回复协议。

建议统一成：

```ts
type MicroAppInvokeResponse = {
  mode: 'reply' | 'no_reply' | 'error';
  message?: {
    type: 'text' | 'markdown';
    content: string;
  };
  errorCode?: string;
  errorMessage?: string;
};
```

然后再由企微回复适配层决定：

- 回复普通文本
- 回复 markdown
- 或者记录失败并放弃回复

## `knowledge_query` 的企微接口契约

当 `wecom.smart_robot` 绑定 `knowledge_query` 时，至少要满足下面这组输入约束。

### 输入

- 必须有可提取文本
- 必须有发送人标识
- 必须有会话标识
- 群聊场景下，应只对已投递给机器人的消息触发

### 绑定配置

`knowledge_query` 定义自己要求的绑定字段。

当前第一版真实落地的字段只有：

- `knowledgeBaseId`

也就是说：

- `knowledge_query` 负责声明“需要一个知识库字段”
- `wecom.smart_robot` 在绑定这个微应用时，实际填写 `knowledgeBaseId`
- 这份值保存在接入点绑定记录里，而不是 `smart_robot` 自己的 config 里

### 输出

- 返回一条稳定文本回复
- 如果执行失败，应返回统一错误，由企微适配层决定是否发错误提示

## 企业微信支持矩阵

### `wecom.smart_robot`

建议支持：

- `knowledge_query`
- `org_directory_lookup`
- `sales_copilot`

### `wecom.webhook_robot`

建议支持：

- `notification_push`

不建议支持：

- `knowledge_query`
- `knowledge_ingest`

## 为什么企微要这样拆

这样拆的好处是明确的：

1. 企微接入代码只关心企微协议，不夹带业务参数。
2. `knowledge_query` 不再被绑死在 `smart_robot` 实现内部。
3. 未来飞书 bot 复用 `knowledge_query` 时，不必重写一套知识库问答业务逻辑。
4. 前端也能直接展示“当前入口绑定的是哪个微应用”。

## 对现有企微实现的迁移含义

对于当前已经存在的企微智能机器人链路，这份设计意味着：

1. `smart robot` 继续保留为接入点。
2. `knowledge query` 从接入点内部配置中抽离，成为独立 `MicroAPP`。
3. 企微入口层只负责：
   - 收消息
   - 标准化
   - 调用 `MicroAPP`
   - 回消息

当前实现里，这个关系已经落到两张表：

- `micro_app_definitions`
- `integration_capability_micro_app_bindings`

也就是说，企微智能机器人后端现在应通过“绑定关系”找到自己的 `knowledge_query` 微应用，而不是再直接读取一个内嵌知识库字段后自行跑 RAG。

## 不该在这层做的事

下面这些事情，不应继续塞在企业微信入口适配层：

- 直接管理知识库配置字段
- 写死某个平台专属提示词逻辑
- 把 `MicroAPP` 结果和企微协议对象混在一起
- 把第三方集成问题改写成 MCP / Tool 注册问题

## 和 `MicroAPP` 总纲的关系

`MicroAPP` 总纲负责定义：

- 什么是 `MicroAPP`
- 为什么它独立于接入方式
- 为什么一个入口只绑定一个 `MicroAPP`

这篇文档负责定义：

- 企业微信有哪些入口
- 每种入口能绑定什么 `MicroAPP`
- 它们之间的接口怎么适配

上位定义见：

- `../microapp/README.md`
