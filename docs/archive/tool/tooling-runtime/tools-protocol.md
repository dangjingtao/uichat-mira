# 工具协议（Tools Protocol）

Status: Current
Owner: runtime
Last verified: 2026-06-27
Layer: raw-source
Module: Tool
Feature: ToolsProtocol
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
- 外部工具通过 MCP server 接入，再被投影成 external MCP discovered tools

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

当前代码中已经出现过的内置域包括：

- `read`
- `edit`
- `web_search`
- `terminal`

### Planner Read 公共面

Planner 的 Read 工具面固定为两个互斥合同：

- `read_discover`：通过结构化 `mode: "list" | "locate"` 发现目录对象或定位候选目标，只返回候选、路径、类型和有限 preview，不打开正文。
- `read_open`：打开已知路径，可选结构化 `selection`。当前支持 `kind: "lines"` 和 `kind: "range"`，二者均使用正数闭区间 `start/end`。

`read_list`、`read_locate`、`read_extract`、`read_slice` 和兼容别名 `read` 仍是 Harness/runtime 内部能力，不进入 Planner `agent_intent` exposure。`read_discover` 的 mode 只做机械分派，不根据自然语言猜测分支；不支持的 selection 会明确失败。

外部工具来自用户接入的 MCP server。

它们不直接替代内置 capability。

当前还要明确一条边界：

- 企业微信、飞书这类第三方内部集成能力，不属于 Harness 当前内置工具面
- 它们可以保留在 `integrations/*` 体系中独立演进
- 只有明确决定并入 Harness 的能力，才进入 `server/src/mcp/harness/runtime.ts` 注册面

当前边界下：

- 内置 capability 进入 internal tool workbench surface
- 外部 MCP projected tools 留在 MCP installed server / discovered tools surface

它们共享 Harness 执行主链，但不共享同一个产品展示面。

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

- 当前运行时命名为 `mcp:<serverId>:tool:<toolName>`

示例：

- `mcp:figma:tool:mcp_search`
- `mcp:github:tool:create_issue`

这样做的目的只有一个：

- 避免外部 MCP tool 与内置工具重名

注意：

- 文档里如果仍出现 `external:<serverId>:<toolName>`，应视为旧设计口径，不是当前代码真相

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
  source: "internal" | "external";
  domain: "read" | "edit" | "web_search" | "terminal" | "browser_action";
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

当前还要补一条硬规则：

- 任何新 tool definition 都必须显式声明 `source`

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

#### Web Search 工具治理规则

1. `web_search` 是统一公网搜索能力，不按 provider 拆工具。
   `Tavily` / `SearXNG` 属于 Harness Runtime 的实现细节。

2. LLM-facing tool schema 只应暴露：
   - `query`
   - `maxResults`

3. `apiKey`、`baseUrl`、`provider` 不允许由模型生成。
   它们只能来自受信任的 runtime config：
   - trusted runtime override
   - `web_search_settings`
   - environment variables

4. `baseUrl` 必须来自可信配置或 allowlist，禁止模型任意指定，避免 SSRF / 内网探测风险。

5. `maxResults` 必须限幅。
   当前建议默认 `5`，最大 `10` 或 `20`。

6. 搜索结果必须标准化。
   上层只消费统一结构，不直接依赖 `Tavily` / `SearXNG` 原始格式。

7. provider 失败必须结构化返回。
   不允许静默失败，也不允许上层在无结果时编造答案。

8. `search-results` artifact 可以保留，但不得写入 `apiKey`、header、环境变量等敏感信息。

#### 当前实现差距

当前代码还保留了下面这些过渡口：

- `apiKey`
- `baseUrl`

它们目前仍在 `web_search` 的 tool input schema 里出现，并且 invocation args 可以参与 provider 配置解析。

这不符合长期治理目标。

后续应收敛到：

- LLM-facing schema 只暴露 `query` 与 `maxResults`
- provider 相关配置只由受信任 runtime config 提供

### Edit

当前第一阶段收口为：

- `edit_file`

当前支持：

- `write_file`
- `replace_block`

并支持：

- `dryRun`

当前现状语义：

- `edit_file`
  - 对一个已知路径的工作区文件执行修改
- `write_file`
  - 用给定 `content` 写入目标文件
- `replace_block`
  - 用 `expectedOldText` 匹配旧内容，匹配成功后替换为 `newText`
- `dryRun`
  - 预演模式，只返回准备执行的编辑结果，不实际写入文件

#### 当前评审结论

当前 `edit_file` 作为底层执行工具是够的，不建议因为语义不清就立刻扩出大量真实执行工具。

但它作为 LLM / selector 可识别的语义入口偏粗，当前至少会混住三类高频意图：

- 创建文件
- 覆盖文件
- 局部替换

也就是说，当前问题不是执行能力不够，而是上层语义暴露不够稳定。

#### 语义边界

当前评审建议把这几类边界写死：

- `create_file`
  - 只处理新建
  - 不负责覆盖已有文件
  - 如果目标已存在，不应静默改写
- `write_file`
  - 处理完整内容写入
  - 可以写新文件，也可以写已有文件
  - 它的重点是“全量写入”，不是“仅新建”
- `replace_block`
  - 只处理局部替换
  - 依赖旧内容匹配
  - 不负责新建文件
  - 不负责整文件覆盖
- `edit_file`
  - 当前更适合作为底层统一执行入口，或兼容 / 聚合入口
  - 不适合长期同时承担最清晰的上层用户语义入口

#### 风险边界

无论是当前 `edit_file`，还是后续若拆出更清晰的语义入口，这组能力都属于：

- `local-write`
- `workspaceBound`
- `requiresApproval`

但风险层次仍应区分：

- `create_file`
  - 主要风险是误创建、路径越界
- `write_file`
  - 主要风险是覆盖已有内容、路径越界
- `replace_block`
  - 主要风险是错误替换目标块，但比全量覆盖更可控

### Terminal

当前第一阶段能力为：

- `terminal_session`

并已进入：

- runtime
- invocation
- approval wait state
- timeout / abort / attach session 语义

### Browser Action

`browser_action` 目前不是 Harness 当前主能力域。

如果项目里仍有历史上的 `browser_action` 类型定义或第三方内部集成实现，这不代表它们属于 Harness 当前内置注册面。

当前口径应以这条为准：

- Harness 当前主内置能力域是 `read`、`edit`、`web_search`、`terminal`
- 第三方内部集成能力默认留在 `integrations/*` 产品线
- 是否清理 `browser_action` 历史 contract，后续再单独决策

## 与外部 MCP 的关系

我们现在不是“另起一套完全不同的协议”。

而是：

- 内部 runtime 以 harness 为中心
- 外部对齐 MCP / tool calling 语义

这能带来三件事：

1. 内部边界、审批、trace 有统一主线
2. 后续接 chat / agent tool-calling 时不需要再推翻 runtime
3. 接外部 MCP server 时不会和内置系统打架

但当前还要加一个明确边界：

- `/mcp/tools` 只服务 internal tools
- external MCP projected tools 不进入 `/mcp/tools`
- external discovered tools 通过 MCP installed server surface 查看

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
- 外部扩展通过 MCP 接入并投影到 external discovered tool surface
- 命名、边界、审批、事件流、artifact、测试约束都必须收口到同一协议

所以这页今后应被看作：

- 当前工具体系的总协议页

而不是：

- 历史工具加载方案的备忘录
