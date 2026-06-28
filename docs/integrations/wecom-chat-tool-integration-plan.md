# 企业微信 Chat Tool 接入计划

Status: Planned
Owner: chat
Last verified: 2026-06-27
Layer: raw-source
Module: Chat
Feature: ToolIntegration
Doc Type: plan

## 单点真相范围

这页只回答一件事：

企业微信能力如果要按现有 `SearchTool` 路线接入 chat，具体应该怎么做。

它覆盖：

- 当前 chat 已经具备的工具接入基础
- 企业微信 tool 应如何定义
- 需要新增哪些文件
- 需要修改哪些现有接点
- `uchat` 侧哪些可直接复用

它不覆盖：

- 企业微信 provider 的完整业务实现细节
- 飞书同构接入细节
- external MCP server 接入 chat 的完整路线

相关文档：

- `integrations/wecom-mcp-wrapper-design.md`
- `integrations/enterprise-wecom-implementation-checklist.md`
- `chat/chat-tool-integration-poc.md`

## Goal

这篇计划文档的目标是把一句“照着 `SearchTool` 这条线接”落成具体工程动作。

核心判断是：

- 现阶段无需等待 external MCP 接入 chat
- 也无需额外新造一套企业微信聊天动作系统
- 企业微信能力可以直接按内置 Harness tool 的方式进入 chat

## 当前事实

当前项目虽然 external MCP 还没有接入 chat，但内部 Harness tool 已经接入 chat。

这条链已经存在：

```text
McpToolImplementation
  -> Harness registry
  -> chat tool surface allowlist
  -> chat tool loop
  -> executeHarnessInvocation
  -> uchat execution trace
```

`web_search` 就是当前参考实现。

## 现有接入链路

## 1. Tool 定义

参考文件：

- `server/src/mcp/tools/web-search.tool.ts`

这里定义了：

- `definition.id`
- `description`
- `inputSchema`
- `capabilities`
- `execute(context)`

这说明工具的最小封装单元已经存在。

## 2. Tool 注册

参考文件：

- `server/src/mcp/harness/runtime.ts`

这里通过：

- `registerCapability(webSearchTool)`

把工具注册到 Harness registry。

## 3. Chat 可见工具面

参考文件：

- `server/src/routes/proxy-provider/chat-tool-surface.ts`

这里通过：

- `listCapabilityDefinitions()`
- allowlist

把 Harness registry 里的工具投影成模型可见工具面。

当前默认 allowlist 只有：

- `web_search`

## 4. Chat tool loop 执行

参考文件：

- `server/src/routes/proxy-provider/chat-tool-loop.ts`

这里已经具备：

- 给模型暴露 tools
- 模型发起 tool call
- `executeHarnessInvocation()` 执行工具
- 结果回注模型
- `onToolEvent` / `onExecutionNode` 推给 `uchat`

所以企业微信 tool 不需要另造执行链。

## 为什么企业微信可以直接照这条线接

因为从 chat 的角度看，企业微信能力和 `web_search` 没有本质区别。

chat 真正关心的是：

- 有一个 tool id
- 有一个 input schema
- 可以执行
- 能返回结果
- 能发 trace

chat 不需要知道这个 tool 背后是：

- 网络搜索
- 企业微信消息发送
- 企业微信组织查询

## 第一阶段建议接入的 tool

建议只做两个 tool：

### `wecom_notify_send`

用途：

- 给当前绑定企业微信身份的用户发送消息

适合 chat 用法：

- “把这段总结发到企业微信”
- “通知我导入完成”

第一阶段约束：

- 默认仅允许发给自己
- 不开放任意目标

### `wecom_org_lookup`

用途：

- 查询当前用户或单个目标用户的组织摘要

适合 chat 用法：

- “我属于哪个部门”
- “这个同事属于哪个部门”

第一阶段约束：

- 仅返回摘要
- 不支持批量组织遍历

### 为什么首期不把“网页授权绑定”做成 chat tool

因为当前项目是本地桌面应用，而企业微信网页授权依赖可访问回调域名和中转服务。

这意味着：

- 绑定前置条件不稳定时，不应该把 OAuth 绑定耦合进 chat 主执行链
- chat 主界面更适合消费“已经完成绑定后的能力”
- 绑定本身仍应主要放在设置页 / 集成页完成

所以 chat 第一阶段只消费：

- `wecom_notify_send`
- `wecom_org_lookup`

不直接消费：

- `wecom_bind_start`
- `wecom_bind_finish`

## 文件新增建议

## 1. 企业微信 provider 层

建议新增：

- `server/src/integrations/wecom/config.ts`
- `server/src/integrations/wecom/client.ts`
- `server/src/integrations/wecom/auth.ts`
- `server/src/integrations/wecom/notifier.ts`
- `server/src/integrations/wecom/org.ts`
- `server/src/integrations/wecom/types.ts`

这些文件负责：

- token / secret
- 身份
- 发消息
- 组织查询

## 2. chat tool 定义层

建议新增：

- `server/src/mcp/tools/wecom-notify-send.tool.ts`
- `server/src/mcp/tools/wecom-org-lookup.tool.ts`

这两个文件应直接对照：

- `server/src/mcp/tools/web-search.tool.ts`

来写。

## 3. 可选聚合文件

如果你们后面企业微信 tool 会继续增多，可增加：

- `server/src/integrations/wecom/plugin-tools.ts`

用于集中导出企业微信插件能力定义。

## tool 定义草图

## `wecom_notify_send`

```ts
export const wecomNotifySendTool: McpToolImplementation = {
  definition: {
    id: "wecom_notify_send",
    title: "WeCom Notify Send",
    description: "Send a WeCom notification to the bound current user.",
    domain: "browser_action",
    mode: "sync",
    inputSchema: {
      type: "object",
      required: ["content"],
      properties: {
        content: { type: "string" },
        title: { type: "string" },
      },
      additionalProperties: false,
    },
    tags: ["wecom", "notify"],
    capabilities: {
      sideEffect: "network",
      requiresApproval: false,
      networkAccess: true,
    },
  },
  execute: async (context) => {
    ...
  },
};
```

## `wecom_org_lookup`

```ts
export const wecomOrgLookupTool: McpToolImplementation = {
  definition: {
    id: "wecom_org_lookup",
    title: "WeCom Org Lookup",
    description: "Look up the organization summary for the current user or one target user.",
    domain: "browser_action",
    mode: "sync",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        mode: { type: "string", enum: ["self", "user"] },
      },
      additionalProperties: false,
    },
    tags: ["wecom", "org"],
    capabilities: {
      sideEffect: "network",
      requiresApproval: false,
      networkAccess: true,
    },
  },
  execute: async (context) => {
    ...
  },
};
```

## 现有代码修改点

## 1. Harness runtime 注册

文件：

- `server/src/mcp/harness/runtime.ts`

需要新增：

- `registerCapability(wecomNotifySendTool)`
- `registerCapability(wecomOrgLookupTool)`

这是让工具进入 Harness registry 的必要步骤。

## 2. Chat tool surface allowlist

文件：

- `server/src/routes/proxy-provider/chat-tool-surface.ts`

当前默认：

```ts
const DEFAULT_CHAT_TOOL_ALLOWLIST = ["web_search"] as const;
```

建议改为类似：

```ts
const DEFAULT_CHAT_TOOL_ALLOWLIST = [
  "web_search",
  "wecom_notify_send",
  "wecom_org_lookup",
] as const;
```

更好的第二步做法是：

- 改成可配置 allowlist
- 后续按 role / route / provider 启用

但第一阶段不用为了这个阻塞接入。

## 3. 可选：McpToolDomain 语义

文件：

- `server/src/mcp/core/definitions.ts`

当前 domain 只有：

- `read`
- `edit`
- `web_search`
- `terminal`
- `browser_action`

企业微信 tool 严格说不完全属于这些域。

建议：

- 第一阶段先临时挂在 `browser_action`
- 第二阶段再视情况新增：
  - `integration_action`
  - `enterprise_action`

不要一开始为了 domain 语义设计拖慢主线接入。

## `execute(context)` 应如何写

`execute(context)` 的实现逻辑建议和 `web_search` 类似，也要具备：

- 参数校验
- 环境校验
- provider 选择或 provider 可用性判断
- `pushEvent` 进度事件
- `trace` span
- 结构化结果返回

### `wecom_notify_send`

建议流程：

1. 校验 `content`
2. 校验当前线程 / 用户上下文是否可用
3. 查当前用户是否已绑定企业微信
4. 调用 `notifier.ts`
5. 推送：
   - `invocation:progress`
6. 返回：
   - `success`
   - `target`
   - `summary`

### `wecom_org_lookup`

建议流程：

1. 解析 `mode` / `query`
2. 校验当前用户权限
3. 查询本地组织投影或 provider 摘要接口
4. 推送：
   - `invocation:progress`
5. 返回：
   - `departments`
   - `summary`

第一阶段建议优先查本地投影，而不是每次都实时请求远端。

## `uchat` 侧是否要改

结论是：

- 大概率不需要新增企业微信专属 UI
- 只要当前 tool execution UI 已经稳定，`uchat` 可以基本复用

原因：

- `chat-tool-loop.ts` 已经会发 `onToolEvent`
- 已经会发 `onExecutionNode`
- `uchat` 已经能展示工具执行态和 trace 摘要

也就是说：

- 企业微信 tool 对 `uchat` 来说只是另一个 tool

如果后面要优化，也应优先做：

- tool summary 文案
- trace 展示细节

而不是做企业微信专属聊天浮层。

## 测试建议

## 后端

建议新增：

- `server/src/mcp/tools/wecom-notify-send.tool.test.ts`
- `server/src/mcp/tools/wecom-org-lookup.tool.test.ts`
- `server/src/routes/proxy-provider/chat-tool-surface.test.ts`
- `server/src/routes/proxy-provider/chat-tool-loop.test.ts`

至少覆盖：

1. tool 定义可注册
2. allowlist 能暴露企业微信 tool
3. tool call 能走 `executeHarnessInvocation`
4. tool 执行成功时返回结构化结果
5. tool 执行失败时 trace 和 error 正常

## 前端

现有 `uchat` 工具执行态测试可继续复用。

只需要确保：

1. 企业微信 tool 的 `toolName` 正常显示
2. 成功和失败摘要能落到现有 execution trace UI

## 第一阶段验收项

- [ ] `wecom_notify_send` 定义完成
- [ ] `wecom_org_lookup` 定义完成
- [ ] Harness runtime 成功注册两个 tool
- [ ] chat tool surface 能暴露两个 tool
- [ ] chat tool loop 能触发执行
- [ ] tool result 能回注模型
- [ ] `uchat` 能看到执行态
- [ ] tool 失败时不会破坏整体 chat 线程状态

## Recommendation

企业微信 chat 接入的最短正路就是直接复用 `SearchTool` 这条现有链路：

- 先把企业微信能力做成内部 `McpToolImplementation`
- 再注册到 Harness runtime
- 再放进 `chat-tool-surface` allowlist
- 然后继续复用 `chat-tool-loop`、`executeHarnessInvocation` 和 `uchat` execution trace

这样不需要等待 external MCP 接入 chat，也不需要另外再造一套企业微信聊天动作系统。
