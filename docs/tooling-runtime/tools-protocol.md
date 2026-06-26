# 工具协议（Tools Protocol）

Status: Current
Owner: runtime
Last verified: 2026-06-26
Layer: raw-source
Module: tooling-runtime
Doc Type: current-contract

## 这份文档现在定义什么

这页现在定义的是本项目当前有效的工具协议总览。

它服务于：

- 内置 capability 如何通过 harness 暴露
- 外部 MCP tool 如何被投影进本地工具面
- invocation / SSE / approval / artifact 的统一协议

它不再描述旧的“文件夹 + `manifest.json` 扫描加载工具”的方案。

那个旧方案已经不是当前真相，不应继续作为实现依据。

## 当前结论

本项目当前的工具体系采用两层结构：

- 内部运行时：`Harness Runtime`
- 外部协议语义：MCP / OpenAI-friendly tool contract

也就是：

- 内置工具不是 `server/tools/*` 下的静态清单
- 内置工具由 `server/src/mcp/harness/runtime.ts` 统一注册
- 外部工具通过 MCP server 接入，再被投影成统一的工具面

## 单点真相

当前与工具协议直接相关的有效文档是：

- `harness-runtime-design.md`
- `read-skill-design.md`
- `terminal-capability-checklist.md`
- `tools-ecosystem-research.md`

这页负责把它们串成一份总协议说明。

## 核心模型

### 1. 工具来源

当前工具分成两类：

- 内置 capability
- 外部 MCP projected tools

内置 capability 由本项目 runtime 自己实现。

当前已落地或已纳入范围的内置域包括：

- `read`
- `edit`
- `web_search`
- `terminal`
- `preview_action` 预留

外部工具来自用户接入的 MCP server。

它们不直接替代内置 capability，而是作为外部扩展能力接入同一调试与调用面。

### 2. 命名规则

命名规则现在必须固定。

内置 capability：

- 保持短且稳定
- 示例：
  - `read_open`
  - `read_locate`
  - `edit_file`
  - `web_search`
  - `terminal_session`

外部 MCP projected tool：

- 统一命名为 `external:<serverId>:<toolName>`

示例：

- `external:figma:mcp_search`
- `external:github:create_issue`

这样做的目的只有一个：

- 避免外部 MCP tool 与内置工具重名

## Harness 是什么

`Harness` 是工具调用的运行时总阀门，不是某个具体工具。

它统一负责：

- roots / sandbox / scope 边界
- capability registry
- invocation 生命周期
- approval gate
- trace / artifact / replay
- validation / regression harness

这意味着：

- 具体 tool 不应各自维护一套状态机
- 权限升级不应散落在单个 tool 内
- UI 也不应拥有运行时真相

## 工具注册协议

当前内置工具通过 runtime registry 注册，而不是靠目录扫描发现。

抽象上至少需要这些字段：

```ts
type CapabilityRegistration = {
  id: string;
  domain: "read" | "edit" | "web_search" | "terminal" | "preview_action";
  title: string;
  description?: string;
  inputSchema: Record<string, unknown>;
  outputSchema?: Record<string, unknown>;
  risk: {
    sideEffect: "none" | "local-write" | "process" | "network";
    requiresApproval: boolean;
    rootBound?: boolean;
    longRunning?: boolean;
  };
  approvalPolicy?: {
    requireUserApprovalOutsideSandbox: boolean;
  };
  execute: (context: HarnessExecutionContext) => Promise<unknown>;
};
```

最重要的点不是字段长什么样，而是注册入口必须统一。

## Roots 与边界协议

所有本地能力都必须运行在 roots / sandbox 模型之上。

推荐 root 结构：

```ts
type RootSpec = {
  id: string;
  uri: string;
  name: string;
  scopes: {
    read: boolean;
    write: boolean;
    debug: boolean;
  };
  source: "user-selected" | "configured";
};
```

硬规则：

- 在 active sandbox 与 authorized roots 内的动作，可以继续执行
- 超出 sandbox 或 roots 的动作，必须显式用户批准

这条规则归 harness。

不是某个 tool 自己决定。

## Invocation 协议

所有工具调用都走统一 invocation 生命周期。

最低事件集：

- `invocation:start`
- `invocation:progress`
- `invocation:artifact`
- `invocation:result`
- `invocation:error`
- `invocation:finish`

当前 terminal 相关补充事件状态已经进入同一主链：

- `awaiting_approval`
- `invocation:approval_required`

建议 invocation 结构：

```ts
type HarnessInvocation = {
  id: string;
  capabilityId: string;
  rootId?: string;
  args: Record<string, unknown>;
  status:
    | "queued"
    | "running"
    | "awaiting_approval"
    | "completed"
    | "failed"
    | "cancelled";
  startedAt: string;
  finishedAt?: string;
  result?: unknown;
  error?: { message: string };
};
```

## SSE 事件协议

前端 workbench 当前依赖 SSE / 流式事件观察工具执行。

所以协议上要坚持两点：

- tool-specific 输出可以丰富
- transport 层事件名必须 capability-agnostic

例如：

- `terminal_session` 可以发 stdout / stderr 片段
- `read_*` 可以发 parser / locate / extract 进度

但这些都应该被包进统一 invocation 观察链，而不是前端为每个工具重新发明一套状态。

## Approval 协议

approval 必须由 harness 兜底。

尤其是：

- root 外访问
- sandbox 外访问
- 本地写入
- 进程执行
- 网络访问

建议 approval grant 至少预留这些维度：

```ts
type HarnessApprovalGrant = {
  id: string;
  capabilityId: string;
  rootId?: string;
  scope: "read" | "write" | "debug";
  threadId?: string;
  sessionId?: string;
  persistence: "once" | "session" | "thread" | "root";
  grantedAt: string;
  expiresAt?: string;
};
```

当前阶段还没有完整产品化审批持久化，但协议必须先留出来。

## Artifact 协议

工具执行结果不应该只返回一坨文本。

协议层应允许产出结构化 artifact。

当前已出现的 artifact 方向包括：

- `search-results`
- `code`
- `terminal-log`
- read 结果相关结构化内容

artifact 的作用是：

- 给 UI 更稳定的展示面
- 给 trace / replay / regression 更稳定的落点

## 当前内置工具面

截至 `2026-06-25`，当前内置工具面至少包含这些方向：

### Read

已落地注册：

- `read_list`
- `read_locate`
- `read_open`
- `read_extract`
- `read_slice`
- `read`

当前判断：

- 第一阶段主链已完成
- 仍在持续产品化

### Search

当前第一阶段收口为：

- `web_search`

当前约束：

- 不拆多个内置 search tool
- provider 由 capability 根据可用配置自动选择
- 当前已接入：
  - `Tavily`
  - `SearXNG`
- 不做多 provider UI
- 不在 tool 壳里散落 provider 分支

### Edit

当前第一阶段收口为：

- `edit_file`

当前支持：

- `write_file`
- `replace_block`

### Terminal

当前第一阶段能力为：

- `terminal_session`

并已进入：

- runtime
- invocation
- approval wait state
- timeout / abort / attach session 语义

## 与外部 MCP 的关系

我们现在不是“另起一套完全不同的协议”。

而是：

- 内部 runtime 以 harness 为中心
- 外部对齐 MCP / tool calling 语义

这能带来三件事：

1. 内部边界、审批、trace 有统一主线
2. 后续接 chat / agent tool-calling 时不需要再推翻 runtime
3. 接外部 MCP server 时不会和内置系统打架

## 明确废弃的旧口径

以下口径不再是当前事实：

- “工具是 `server/tools/` 下的文件夹”
- “工具通过 `manifest.json` 声明并在启动时扫描”
- “`extendTools/` 同名覆盖内置工具”
- “tool runtime type 通过 `search/prompt/filesystem` 三种静态类型定义”

如果后续代码里还有这些残留，应视为历史遗留，而不是当前设计目标。

## 当前实施约束

后续任何真实 capability 变更，都应满足：

- 实现与自动化测试同一变更交付
- 成功路径、失败路径、边界拒绝都要覆盖
- dry-run / 只读预演路径存在时，也必须覆盖

这条约束适用于：

- `read`
- `edit`
- `web_search`
- `terminal`
- 后续任何新增 capability

## 当前结论

现在这套工具协议可以总结成一句话：

- 内置能力由 harness runtime 统一注册与执行
- 外部扩展通过 MCP 接入并投影成统一工具面
- 命名、边界、审批、事件流、artifact、测试约束都必须收口到同一协议

所以这页今后应被看作：

- 当前工具体系的总协议页

而不是：

- 历史工具加载方案的备忘录
