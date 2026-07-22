# 问策：外部专家桥接架构设计

Status: Current
Owner: microapp / runtime / desktop
Last verified: 2026-07-22
Layer: raw-source
Module: MicroAPP
Feature: ExternalExpertBridge
Doc Type: design
Canonical: false
Related:
  - README.md
  - jianxing-webbridge-debug-status.md
  - ../architecture/README.md
  - ../architecture/ipc-and-preload.md

## 单点真相范围

这篇文档定义 Mira 调用用户自己已登录的 ChatGPT、Kimi、DeepSeek 网页账号作为“外部专家”的 MVP 架构。

它只覆盖：

- 专家模块边界
- Provider 抽象接口
- 基于触界的浏览器桥接
- 专家与外部线程的绑定
- 第一阶段功能范围

它不覆盖：

- ToolCall 或外部 AI 调用 Mira 工具
- 新的权限系统
- 多专家编排
- 外部聊天记录同步
- 外部账号凭据托管
- Agent Runtime 重构

## 目标

用户-facing 模块名称：**问策**。

内部 Feature 标识仍为 `ExternalExpertBridge`，用于描述实现边界，不作为界面名称。

Mira 作为 Agent Host，向用户配置的外部专家发送咨询消息，并接收专家回复。

外部专家只提供建议。Mira 决定是否采纳建议，以及是否由自己的 Agent 或工具继续执行。

外部网页账号继续持有自己的聊天上下文。Mira 不把外部线程改造成 Mira thread，也不要求外部 Provider 暴露 ToolCall。

## 结论先说

MVP 只需要四个动作：

```text
创建专家
  -> 建立一个新的已登录网页会话
  -> 发送咨询消息
  -> 获取回复
```

推荐复用触界已有的 WebBridge 连接，不新增一套桌面到扩展的通信通道。

```text
Mira
  -> ExpertService
  -> WebBridge UI Client
  -> 触界扩展
  -> Provider Adapter
  -> 用户已登录的网页账号
```

Mira 保存专家配置和外部线程标识；浏览器保存登录态和真实聊天上下文。

## 1. 核心模块划分

### Mira 侧

`ExpertService` 负责：

- 创建和读取专家定义
- 建立或断开网页运行时连接
- 调用 Provider
- 将回复返回给当前 Mira 调用方
- 保存外部线程标识和最近状态

`ExpertProviderRegistry` 负责按 Provider ID 找到适配器。

`ExpertSessionStore` 负责保存本地专家配置，不保存 Cookie 或网页账号密码。

### 触界扩展侧

`ExpertBridge` 负责：

- 检查目标 Tab 是否属于目标 Provider
- 调用对应的网页适配器
- 读取用户当前登录态
- 发送消息并等待回复
- 将 Provider 结果转换成桥接协议结果

### Provider 侧

每个 Provider 只处理自己的网页差异：

- ChatGPT 页面能力
- Kimi 页面
- DeepSeek 页面

Mira 不直接依赖这些网站的 DOM、URL 细节或页面内部接口。

## 2. Expert Provider 抽象接口

```ts
type ExpertProviderId = "chatgpt" | "kimi" | "deepseek";

type ExternalSessionRef = {
  kind: "conversation_id" | "url" | "provider_state";
  value: string;
};

type ExpertProvider = {
  id: ExpertProviderId;

  detect(input: {
    tabId: number;
  }): Promise<{
    loggedIn: boolean;
    accountLabel?: string;
  }>;

  connect(): Promise<{
    accountLabel?: string;
  }>;

  sendMessage(input: {
    tabId: number;
    sessionRef?: ExternalSessionRef;
    message: string;
  }): Promise<{
    reply: string;
    sessionRef?: ExternalSessionRef;
  }>;
};
```

`ExternalSessionRef` 由 Provider 解释。ChatGPT 可以使用会话 ID，Kimi 或 DeepSeek 可以使用 URL 或 Provider 自己维护的状态引用。Mira 不假设它一定是正规 API ID。

`connect` 表示打开一个新的 Provider 网页会话并建立运行时连接，不复用用户已有的外部线程。首次发送消息后，Provider 再返回真实的 `ExternalSessionRef`。

Provider 接口不包含：

- `executeTool`
- `approve`
- `streamToolCall`
- Mira Agent 的上下文对象

## 3. 浏览器桥接层

当前触界已有两类 WebBridge 客户端：Mira 页面和浏览器扩展。外部专家桥接复用这条链路。

建议新增专用工具名：

```text
expert.connect
expert.send_message
```

请求示例：

```json
{
  "type": "request",
  "tool": "expert.send_message",
  "params": {
    "provider": "chatgpt",
    "message": "请从产品设计角度评估这个方案"
  }
}
```

返回示例：

```json
{
  "ok": true,
  "result": {
    "provider": "chatgpt",
    "sessionRef": {
      "kind": "conversation_id",
      "value": "conversation-id"
    },
    "reply": "..."
  }
}
```

扩展使用用户当前已经登录的网页环境。Mira 不读取、不存储、不转发外部网站的 Cookie、密码或登录令牌。

桥接层只返回专家建议，不把专家回复解释成 Mira 工具调用。

## 4. 专家与线程管理

Mira 保存一条轻量专家记录：

```ts
type Expert = {
  id: string;
  name: string;
  provider: ExpertProviderId;
  externalSessionRef?: ExternalSessionRef;
  accountLabel?: string;
  status: "unbound" | "ready" | "expired" | "error";
};
```

`Expert` 和浏览器 Tab 分开：

```ts
type ExpertRuntimeBinding = {
  expertId: string;
  tabId: number;
};
```

`tabId` 只存在于运行时连接中，不是专家的持久身份。连接时扩展总是新开 ChatGPT Tab；浏览器重启、Tab 关闭或 Tab 恢复后，Mira 专家仍然保留，但需要重新建立连接。

持久关系是一对一的 MVP 约束：

- 一个 Mira 专家绑定一个 Provider
- 一个 Mira 专家最多保留一个自动创建的 `ExternalSessionRef`

连接时不复用用户已有 ChatGPT Tab 或外部线程。ChatGPT Adapter 调用 ChatGPT.js 的新建对话能力；首次咨询发送后，才持久化真实 `conversation_id`。

外部线程上下文由 ChatGPT/Kimi/DeepSeek 自己维护。Mira 只保存 `ExternalSessionRef`，不保存完整外部消息历史。

运行时 Tab 失效时，只清除 `ExpertRuntimeBinding`，不删除专家或外部线程引用。用户退出登录、外部线程不可用或引用失效时，专家状态变为 `expired` 或 `error`，需要用户重新绑定或重新确认会话。

## 5. Provider Adapter 扩展

建议目录：

```text
mira-clipper-ext/extension/experts/
  provider-contract.js
  chatgpt-adapter.js
  kimi-adapter.js
  deepseek-adapter.js
```

ChatGPT Adapter 可以选择使用 `chatGPT.js`，但它不是 Provider Contract 的必需依赖：

```text
ExpertBridge
  -> ChatGPTAdapter
    -> DOM / 页面能力实现
       （可选择使用 chatGPT.js）
```

新增 Kimi 或 DeepSeek 时，只增加对应 Adapter 并注册 Provider ID，不修改 `ExpertService` 的业务流程。

第一阶段不要求三个 Provider 同时实现。建议先实现 ChatGPT，验证抽象接口后再增加其他 Provider。

## 6. MVP 第一阶段

### 必须支持

1. 创建专家：名称、Provider。
2. 建立网页连接：扩展新开 ChatGPT Tab，检查网络和登录状态，并创建空白对话。
3. 发送咨询消息：发送一条普通文本消息。
4. 获取回复：返回本次消息对应的、已经完成的 assistant 回复。

建议的 Mira API：

```text
POST /experts
POST /experts/:id/connect
POST /experts/:id/consult
```

咨询请求：

```json
{
  "message": "请分析这个方案的主要风险"
}
```

咨询响应：

```json
{
  "expertId": "expert_123",
  "provider": "chatgpt",
  "sessionRef": {
    "kind": "conversation_id",
    "value": "conversation_456"
  },
  "reply": "..."
}
```

`sendMessage` 必须关联本次发送产生的回复，并仅在 Provider 判断该 assistant 回复已经完成后返回。超时、会话状态变化或无法确认回复归属时，返回明确错误，不得返回不确定的部分回复。

### 明确不做

- 不做 ToolCall。
- 不让外部 AI 直接执行 Mira 工具。
- 不做多专家路由和自动选择。
- 不做外部线程历史导入。
- 不做 Mira 与外部线程的双向同步。
- 不做后台静默发送。
- 不新增权限、审批或授权系统。

## Code Anchors

当前可复用的实现锚点：

- `desktop/src/shared/api/webbridge.ts`
- `desktop/src/features/Settings/pages/MicroApps/JianXing/index.tsx`
- `server/src/routes/webbridge.ts`
- `mira-clipper-ext/extension/background.js`
- `mira-clipper-ext/extension/content/content.js`
- `mira-clipper-ext/native-host/host.mjs`

## 当前状态

当前实现状态：

- ChatGPT Provider Adapter 已实现，使用用户当前 ChatGPT 网页线程的页面能力。
- 专家创建、Tab 运行时绑定、ChatGPT 线程绑定、单条咨询和完整回复返回已接入。
- Kimi、DeepSeek 仅保留 Provider 类型，尚未实现 Adapter。
- `chatGPT.js` 仍是可选实现细节，当前 Adapter 使用页面 DOM 能力。
