# 问策：外部专家桥接架构设计

Status: Current
Owner: microapp / runtime / desktop
Last verified: 2026-07-23
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
初始化所选 Provider 的唯一专家实例
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

当前必须区分两件事：

- **触界 WebBridge 握手**：已有的扩展与 Mira 后端连接握手，负责建立桌面到扩展的通信链路。
- **外部专家握手**：Provider 网页与 Mira 之间的 Provider 级握手，当前**尚未实现**。

当前 `expert.connect` 只打开新的 Provider 页面、注入适配器，并确认登录态和空白输入框可用。它不交换 Provider session token，不建立独立双向心跳，也不返回可长期复用的外部连接句柄。因此这里的“建立连接”表示页面运行时就绪，不表示 Provider 握手完成。

## 1. 核心模块划分

### Mira 侧

`ExpertService` 负责：

- 读取每个 Provider 的唯一专家定义
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

  connect(input: {
    tabId: number;
  }): Promise<{
    accountLabel?: string;
    sessionRef?: ExternalSessionRef;
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

`connect` 表示打开一个新的 Provider 网页会话并确认页面就绪，不复用用户已有的外部线程。它不是 Provider 握手。首次发送消息后，Provider 再返回真实的 `ExternalSessionRef`。

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

`expert.connect` 请求：

```json
{
  "type": "request",
  "tool": "expert.connect",
  "params": {
    "provider": "chatgpt"
  }
}
```

扩展成功打开新 Tab、完成页面适配器注入并确认空白输入框可用后，返回：

```json
{
  "ok": true,
  "result": {
    "accountLabel": "ChatGPT",
    "sessionRef": {
      "kind": "provider_state",
      "value": "https://chatgpt.com/"
    },
    "tabId": 123
  }
}
```

这里的 `tabId` 只用于本次运行时绑定，不进入专家持久身份。`provider_state` 只表示新空白页面状态，不代表外部 conversation 已创建。

`expert.send_message` 请求：

```json
{
  "type": "request",
  "tool": "expert.send_message",
  "params": {
    "provider": "chatgpt",
    "tabId": 123,
    "sessionRef": {
      "kind": "provider_state",
      "value": "https://chatgpt.com/"
    },
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

`tabId` 只存在于运行时连接中，不是专家的持久身份。连接时扩展总是新开 ChatGPT Tab；浏览器重启、Tab 关闭或 Tab 恢复后，Mira 专家仍然保留，但需要重新建立页面运行时连接。当前没有 Provider 级握手来自动恢复连接，也不会复用旧 Tab 或旧线程。

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

当前 ChatGPT Adapter 使用扩展内置的 `lib/chatgpt.min.js`（ChatGPT.js）：

```text
ExpertBridge
  -> ChatGPTAdapter
    -> chatGPT.js 页面状态能力
    -> background.js CDP transport
       -> Runtime / Input / Page
       -> 当前 ChatGPT 页面
```

当前 Adapter 的行为：

- 使用 `isLoaded()` 检查页面是否就绪。
- 使用 `startNewChat()` 打开新的空白对话，不复用已有线程。
- 发送路径使用 `chrome.debugger` 连接目标 Tab，通过 CDP `Runtime`、`Input` 和 `Page` 完成后台输入与提交。
- CDP 发送不调用 `chrome.tabs.update(active: true)`、`chrome.windows.update(focused: true)` 或页面激活逻辑；目标 Tab 可以保持后台状态。
- DOM Adapter 只保留页面连接检测和状态读取，不再承担发送 fallback。
- 使用 `isIdle()` 等待本轮生成结束，再使用 `getChatData()` 读取完整回复。
- 只从当前 URL 的 `/c/<conversation_id>` 读取会话 ID，避免把历史列表第一条误判成当前线程。
- 不使用当前 ChatGPT.js 仍依赖旧 `<p>` 输入结构的 `askAndGetReply()` 发送路径；ChatGPT.js 继续用于页面加载、新建对话、生成状态和回复读取。
- 发送必须得到明确 ACK。`SEND_NOT_CONFIRMED`、响应超时、会话不匹配等错误直接返回，不因状态不确定自动重发。

新增 Kimi 或 DeepSeek 时，只增加对应 Adapter 并注册 Provider ID，不修改 `ExpertService` 的业务流程。

第一阶段不要求三个 Provider 同时实现。建议先实现 ChatGPT，验证抽象接口后再增加其他 Provider。

## 6. MVP 第一阶段

### 必须支持

1. 初始化所选 Provider 的唯一专家：不提供同一 Provider 的重复实例。
2. 建立网页连接：扩展新开 ChatGPT Tab，检查网络和登录状态，并创建空白对话。
3. 发送咨询消息：发送一条普通文本消息。
4. 获取回复：返回本次消息对应的、已经完成的 assistant 回复。

建议的 Mira API：

```text
POST /microapps/external-experts
POST /microapps/external-experts/:id/connect
POST /microapps/external-experts/:id/consult
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
- 不做通用浏览器后台 Agent；问策只通过已验证的 ChatGPT CDP 链路发送专家咨询。
- 不新增权限、审批或授权系统；Agent 调用继续沿用现有 Harness/Policy 行为，当前网络副作用可能进入既有审批流程。

## 7. Agent 接入契约

External Expert 作为 Mira 的一个高层 Harness 工具注册，工具 ID 为：

```text
ask_external_expert
```

Planner 只看到 Provider、业务动作、问题和会话引用，不看到 Tab、CDP、DOM、焦点或发送按钮。

输入契约：

```ts
type AskExternalExpertInput = {
  action: "ask" | "continue" | "new_conversation";
  provider: "chatgpt" | "kimi" | "deepseek";
  question?: string;
  conversation?:
    | "new"
    | {
        conversationId: string;
      };
};
```

业务动作语义：

- `ask`：使用当前运行中的专家会话；没有运行时连接时建立新的网页连接。传入 `conversation: "new"` 时强制新建会话。
- `continue`：继续指定的 `conversationId`。该会话必须与当前专家持久引用一致，且当前进程中仍有运行时连接；不会恢复旧 Tab 或旧线程。
- `new_conversation`：每次都新建 Provider 网页 Tab 和空白会话。可以只建立连接，也可以同时发送 `question`。

当 `new_conversation` 不带 `question` 时，返回 `status: "ready"`，此时外部 conversation 尚未产生真实 ID；首次发送成功后才会返回 `conversationId`。

工具结果契约：

```ts
type AskExternalExpertResult = {
  answer: string;
  provider: "chatgpt" | "kimi" | "deepseek";
  conversationId: string | null;
  status: "completed" | "ready";
  latencyMs: number;
};
```

调用链保持现有 Agent Graph：

```text
Planner
  -> Normalize
  -> Policy
  -> ToolNode
  -> ask_external_expert
  -> ExternalExpertService.ask
  -> expert.connect / expert.send_message
  -> 现有 WebBridge
  -> 触界扩展 CDP Adapter
  -> 外部专家网页
  -> Tool Result / Evidence
  -> Planner
  -> Generate 或继续调用其他能力
```

External Expert 回复只作为 Tool Result 和 Evidence 返回，不能直接绕过 Planner 成为 Mira 最终回答。Evidence 的 `data` 保留上述结果，`facts` 至少记录 Provider、状态、conversationId 和耗时。

错误沿用 Harness 的失败封装，并保留 WebBridge 的结构化字段：

```ts
{
  code: string;
  message: string;
  retryable: boolean;
  suggestedAction?: string | null;
}
```

例如 `SEND_NOT_CONFIRMED`、`BRIDGE_DISCONNECTED`、响应超时和 `CONVERSATION_MISMATCH` 不会被吞掉。发送状态不确定时，External Expert service 不自动重复调用 `expert.send_message`。

## Code Anchors

当前可复用的实现锚点：

- `desktop/src/shared/api/webbridge.ts`
- `desktop/src/features/Settings/pages/MicroApps/JianXing/index.tsx`
- `server/src/routes/webbridge.ts`
- `mira-clipper-ext/extension/background.js`
- `mira-clipper-ext/extension/content/content.js`
- `mira-clipper-ext/native-host/host.mjs`
- `server/src/harness/runtime.ts`
- `server/src/harness/profiles/resolver.ts`
- `server/src/mcp/tools/ask-external-expert.tool.ts`
- `server/src/microapps/external-expert/index.ts`

## 当前状态

当前实现状态：

- ChatGPT Provider Adapter 已实现，使用扩展内置 ChatGPT.js 和当前 ChatGPT 页面能力。
- 专家创建、Provider 单例约束、Tab 运行时绑定、创建新空白对话、单条咨询和完整回复返回已接入。
- `ask_external_expert` 已注册到 Harness，并通过共享的 `externalExpertService` 复用现有 Provider 单例和运行时绑定。
- Agent 工具结果已接入现有 ToolNode/Evidence 流程，外部回复不会直接替代 Mira 的 Planner/Generate。
- `expert.connect` 已实现页面运行时就绪检查，但 **Provider 级握手尚未实现**：没有握手 token、独立连接 ID、双向心跳或自动恢复协议。
- `expert.connect` 成功不代表外部 conversation 已创建；首次成功发送后才持久化 `conversation_id`。
- 当前发送动作不走 ChatGPT.js 的 `askAndGetReply()`，因为该版本对当前 textarea DOM 不兼容；发送由 `background.js` 的 CDP 路径完成，页面状态及回复读取仍由 ChatGPT.js 提供。
- Kimi、DeepSeek 仅保留 Provider 类型，尚未实现 Adapter。

### Agent 接入验证状态

- External Expert service 单元测试：通过。
- `ask_external_expert` Harness/Evidence 集成测试：通过。
- `SEND_NOT_CONFIRMED` 单次发送错误路径测试：通过，未自动重发。
- Harness runtime、能力检索和现有 Policy 回归测试：通过。
- `pnpm typecheck`：被既有 Office Suite 类型错误阻断，本次未修改这些无关错误。
- 真实 Agent 冒烟已确认 Planner 能识别并冻结 `ask_external_expert`；执行阶段因触界扩展未连接到当前后端返回 `BRIDGE_DISCONNECTED`，因此不能宣称真实 ChatGPT 闭环已在本次 Agent 接入中完成。

### 握手未实现的边界

当前不能宣称已经完成以下能力：

- Mira 与 Provider 页面之间的独立握手协议。
- Provider 身份或账号会话的稳定校验句柄。
- 关闭 Tab 后自动恢复到同一个外部页面连接。
- 跨浏览器重启的连接恢复。
- 基于握手状态的主动断线检测和恢复。

当前 MVP 实际流程：

```text
创建唯一专家实例
  -> expert.connect
  -> 新开 ChatGPT Tab + 页面就绪检查
  -> expert.send_message
  -> ChatGPT 创建 conversation
  -> 返回回复和 conversation_id
```
