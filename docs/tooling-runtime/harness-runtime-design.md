# Harness Runtime 设计

Status: Current
Owner: runtime
Last verified: 2026-06-26
Layer: raw-source
Module: Tool
Feature: HarnessRuntime
Doc Type: design

## 当前落地状态

截至 `2026-06-25`，harness 下第一批 `Read` capability 已经不是纯设计状态。

当前已经落地并注册到 harness runtime 的 `Read` 工具包括：

- `read_list`
- `read_locate`
- `read_open`
- `read_extract`
- `read_slice`
- `read`

这些能力已经走通：

- harness registry
- invocation lifecycle
- SSE 事件流
- route 暴露
- 后端类型检查与自动化测试

但这还不等于 harness 整体完成。

当前更准确的判断是：

- harness + `Read` 第一阶段主链：已完成
- 多 roots、审批持久化、chat 自动工具调用、完整 trace UI：未完成

下一阶段约束也需要提前固定：

- `Search` 第一阶段只做内置 `web_search`
- `web_search` 保持统一 capability 面，不拆多个搜索工具入口
- provider 选择来自 harness environment 与当前可用配置，不从 UI 分叉
- 不做多 provider UI

当前落地状态：

- `web_search` 已收口为自动 provider 选择
- 当前已接入：
  - `Tavily`
  - `SearXNG`
- 对应测试已更新
- 前端参数草稿已对齐统一工具面：
  - `apiKey`
  - `baseUrl`
- `web_search` 配置当前已持久化到后端 SQLite：
  - 表：`web_search_settings`
  - 配置接口：`GET /mcp/web-search/config`
  - 配置接口：`PUT /mcp/web-search/config`
- `edit_file` 已收口到 harness 驱动的 edit runtime
- `edit_file` 当前阶段支持：
  - `write_file`
  - `replace_block`
- `edit_file` 已补齐当前阶段成功/失败/dry-run/越界的单元测试
- `terminal_session` 下一步按独立 checklist 推进：
  - 见 `terminal-capability-checklist.md`

## 单点真相范围

这页定义内置 agent capability 的运行时控制平面。

它讨论的是：

- 谁拥有 roots、权限边界和审批
- capability 怎样统一注册
- invocation 生命周期怎样被观察
- trace、validation、回归夹具该挂在哪一层

它不把 `Read` 当成中心。
`Read` 只是第一批接入 harness 的 capability。

相关概念：

- [[CONCEPT_RUNTIME]]
- [[CONCEPT_MCP]]
- [[AREA_MAP_RUNTIME]]

## 适合什么时候读

你在这些场景里应该先看这页：

- 想把 `read`、`edit`、`terminal` 之类能力做成统一 runtime
- 想判断权限、审批和 sandbox 到底应该挂在哪一层
- 准备接入第三方 MCP tool，但不想把执行状态散落到各处
- 想给工具链补 trace、replay、validation

## 核心定位

`Harness` 是运行时中心，不是某个具体工具。

它应该负责：

- roots 与 scope 边界
- capability 注册
- invocation 状态机
- trace / artifact / replay
- validation / regression

它不应该退化成：

- 单个 read function
- 一个 UI 页面
- 只给 chat 用的 helper

### `web_search` 的实际执行链路

`web_search` 不是通过第三方搜索 SDK 运行的，而是：

- harness environment 提供可用 provider 视图
- tool runtime 根据可用配置选择 provider
- provider 选择完成后直接执行 HTTP 请求
- Tavily 走 `https://api.tavily.com/search`
- SearXNG 走 `${baseUrl}/search`

前端只负责配置：

- `Tavily API key`
- `SearXNG baseUrl`

但配置真相不再在前端本地存储，而是：

- 前端通过 `/mcp/web-search/config` 读取和保存
- 后端持久化到 SQLite 表 `web_search_settings`
- `web_search` 运行时按优先级读取：
  - invocation args
  - `web_search_settings`
  - 环境变量

这样做的目的，是把“可用环境”与“执行实现”分开，避免 UI 侧再引入 provider 分叉。

当前治理补充：

- `web_search` 对模型应保持统一工具面，不按 provider 拆工具
- `Tavily` / `SearXNG` 是 runtime provider，不是 LLM-facing tool
- 长期目标下，LLM-facing schema 只应暴露：
  - `query`
  - `maxResults`
- `apiKey`、`baseUrl`、`provider` 不应由模型生成
- `baseUrl` 必须来自可信配置或 allowlist，避免 SSRF / 内网探测风险
- provider 失败必须结构化返回，不能静默吞掉
- `search-results` artifact 可以保留，但不得写入敏感配置

当前代码仍保留 `apiKey` / `baseUrl` 作为 invocation args 参与解析，这属于过渡实现，不是最终治理目标。

## 设计目标

运行时架构采用 harness 思维，但 capability contract 尽量保持 MCP / OpenAI tool calling 兼容。

也就是：

- 内部 operating model 以 harness 为中心
- 对外能力定义尽量接近 MCP / tool schema 语义

## 当前建议

项目不应该在 “OpenAI style” 和 “Harness style” 之间二选一。

更稳的做法是：

- harness 做 runtime control plane
- capability 定义继续保持 MCP / OpenAI-friendly

## 五个核心职责

### 1. 边界控制

harness 持有：

- roots
- scopes
- approval policy
- sandbox 边界

这层必须高于任何单独 capability。

例如：

- `Read` 不该自己决定能读哪些路径
- 它应当从 harness 收到已经授权过的 root context

### 硬规则

harness 必须执行这条规则：

- 在 active sandbox 和 authorized roots 内的动作，可以按 capability policy 继续
- 超出 active sandbox 或 authorized roots 的动作，必须显式用户批准

这条规则归 harness，不归单独 capability。
capability 不能自行绕过、静默降级或自授权。

### 2. Capability Registry

harness 统一注册所有内置 capability。

当前第一批范围：

- `read`

后续能力域：

- `edit`
- `web_search`
- `terminal`
- `preview_action`

当前明确不纳入 Harness 内置注册面的内容：

- 企业微信这类第三方内部集成工具
- 正在接入的飞书 / Lark 集成工具

这些能力可以继续存在于 `integrations/*` 产品线和独立 route / provider 体系里，但默认不进入 Harness 内置 capability registry，也不进入 Harness capability profile 暴露治理主线。

每个 capability 至少要注册：

- definition
- input schema
- output schema
- risk metadata
- execution handler
- validator hooks
- approval behavior

当前内置命名约束：

- 内置 capability id 保持短且稳定，例如 `read_open`、`edit_file`、`web_search`
- 外部 MCP 投影 capability 一律使用 `mcp:<serverId>:tool:<toolName>`

tool id 也要分清：

- 内置 capability 保留稳定 id，例如 `read_open`
- 第三方投影 tool 使用 `mcp:<serverId>:tool:<toolName>`

### 2.1 Capability Profile 层

`Harness` 不应把“暴露给 Agent 的识别对象”和“真正执行的 tool id”混成同一层。

建议在 registry 之上再加一层 `Capability Profile`：

- `tool` 是底层可执行单元
- `capability profile` 是上层被识别、被暴露、被治理的能力单元

一个 capability profile 可以对应：

- 一个 primary tool
- 多个 supporting tools

例如：

- `workspace_lookup`
  - primary: `read_locate`
  - supporting: `read_list` / `read_open` / `read_extract` / `read_slice`

这样做的意义是：

- Agent 不再直接面对原始 tool 洪水
- 暴露治理、embedding 召回、rerank、风控评分都能以 capability 为单位进行
- 真正进入执行阶段时，再落到具体 `preferredToolId`

建议结构：

```ts
type HarnessCapabilityProfile = {
  id: string;
  title: string;
  description: string;
  domain: string;
  source: "internal" | "external";
  tags: string[];
  preferredToolId: string;
  supportingToolIds: string[];
};
```

### 3. Invocation 生命周期

harness 拥有完整执行生命周期。

最低事件：

- `invocation:start`
- `invocation:progress`
- `invocation:artifact`
- `invocation:result`
- `invocation:error`
- `invocation:finish`

这套生命周期必须 capability-agnostic。

同时 harness 应继续当“长生命周期执行观察者”，统一跟踪：

- progress
- status transition
- retry / fallback
- final outcome

对 `terminal` 额外要求：

- cwd / env 解析结果要进入统一观察链
- stdout / stderr 流事件要保持 capability-agnostic 输出格式
- abort / timeout / cleanup 不能散落在 UI 或 tool 壳里
- approval 不能只在 capability 内部“口头存在”，要进入统一 invocation 状态；当前只做到 `awaiting_approval` / `invocation:approval_required` 的事件承接，真正的 thread / session 级 approval grant 还未落地

当前 terminal phase 2 已落地的部分：

- `timeoutMs` 已进入 runtime
- `attachSessionId` 已进入 runtime，支持显式复用已有 session
- `terminal_session` 的审批还没有完整的持久化 grant 编排，当前只是通过 invocation 状态承接审批分支
- `awaiting_approval` 与 `invocation:approval_required` 已接进 core invocation 执行器
- invocation trace recorder 已落地
- `terminal_session` 已作为第一批 capability 接入 trace spans

### 4. 可观测性

harness 拥有：

- traces
- spans
- execution events
- replay records

目的不只是给 UI 打 log，而是让 capability 行为可检查、可测试、可回放。

当前已落地的最小实现：

- per-invocation trace record
- span list buffering
- `GET /mcp/invocations/:id/trace`

当前还没有落地：

- replay 执行
- 跨 invocation trace 检索
- span UI 结构化展示

### 5. 验证

harness 拥有：

- fixture execution
- golden assertion
- fuzzy assertion
- regression suite
- capability-specific validator

没有 validation 的 tool surface，不算稳定 capability。

补充落地约束：

- 每完成一个真实 capability 点，实现与对应自动化测试必须同一变更交付
- 成功路径、失败路径、边界拒绝、dry-run 或只读预演路径都要覆盖
- UI-only 页面骨架只有在项目 owner 明确批准时才可以暂时不补测试

## 与 MCP / OpenAI Tooling 的关系

harness 不应该替代 MCP 风格建模，而应该承载它。

推荐关系：

- `roots` 对应 MCP root boundary
- capability definition 对应 tool definition
- 可读内容面对应 resource
- invocation lifecycle 对应 tracing / event system

所以结论是：

- 架构中心：harness
- 外部契约：MCP / OpenAI-friendly

## Runtime 模型

建议的顶层结构：

```ts
type HarnessRuntime = {
  roots: RootRegistry;
  capabilities: CapabilityRegistry;
  approvals: ApprovalPolicy;
  invocations: InvocationRuntime;
  tracing: TraceRuntime;
  validation: ValidationRuntime;
};
```

## Root 模型

roots 是 harness 真正拥有的能力，不只是 read 的附属字段。

建议结构：

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

要求：

- 支持 multiple roots
- 用户显式拥有与选择
- id 稳定
- per-scope permission
- root list change events
- 访问逃出声明 root set 时触发 approval escalation

## Capability Registration 模型

每个 capability 通过统一接口注册进 harness。

建议结构：

```ts
type CapabilityRegistration = {
  id: string;
  domain: "read" | "edit" | "web_search" | "terminal" | "preview_action";
  title: string;
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
  validators?: CapabilityValidator[];
};
```

推荐默认值：

```ts
approvalPolicy: {
  requireUserApprovalOutsideSandbox: true
}
```

## Invocation 模型

只有 harness 可以创建并追踪 invocation state。

建议结构：

```ts
type HarnessInvocation = {
  id: string;
  capabilityId: string;
  rootId?: string;
  args: Record<string, unknown>;
  status: "running" | "completed" | "failed" | "cancelled";
  startedAt: string;
  finishedAt?: string;
  result?: unknown;
  error?: { message: string };
};
```

## Approval 持久化模型

approval 不该只做 thread 级状态。

thread 绑定有用，但不够。

因为未来会同时出现：

- 单次 invocation 批准
- session 内重复读取批准
- conversation / thread 级批准
- root 范围批准
- capability 范围批准

建议维度：

- `capabilityId`
- `rootId`
- `scope`
- `threadId` 可选
- `sessionId` 可选
- `persistence`

建议结构：

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

### 推荐解释

- `once`
  - 只对一次 invocation 生效
- `session`
  - 对当前 harness runtime session 生效
- `thread`
  - 对当前 conversation / task thread 生效
- `root`
  - 对选中 root 与 capability scope 生效

### 当前建议

在 chat integration 前，先预留：

- `once`
- `session`
- `thread`

等 permission model 稳定后，再补 durable `root` approval。

## Trace 模型

harness 应该跨所有 capability domain 发 trace。

建议结构：

```ts
type HarnessTrace = {
  traceId: string;
  invocationId: string;
  capabilityId: string;
  startedAt: string;
  finishedAt?: string;
  spans: HarnessSpan[];
};

type HarnessSpan = {
  spanId: string;
  parentSpanId?: string;
  name: string;
  kind:
    | "permission_check"
    | "root_resolution"
    | "resource_detection"
    | "adapter_execution"
    | "fallback"
    | "normalization"
    | "validation";
  startedAt: string;
  finishedAt?: string;
  metadata?: Record<string, unknown>;
};
```

## 执行观察模型

harness 始终应该维护一条统一 execution observation path。

不一定意味着字面上的 OS thread，而是必须有一个 runtime-owned 监视者负责：

- current invocation status
- active strategy id
- fallback transition
- timeout / cancel state
- approval wait state
- final completion state

建议结构：

```ts
type HarnessExecutionState = {
  invocationId: string;
  capabilityId: string;
  strategyId?: string;
  status:
    | "queued"
    | "running"
    | "awaiting_approval"
    | "falling_back"
    | "completed"
    | "failed"
    | "cancelled";
  updatedAt: string;
  message?: string;
};
```

UI、chat integration、validator 都应消费这条 harness-owned state，而不是各自拼一套状态判断。

## Validation 模型

validator 跑在 capability core logic 之外，但针对同一 contract。

建议类型：

```ts
type CapabilityValidator =
  | { kind: "schema" }
  | { kind: "golden"; fixtureSet: string }
  | { kind: "fuzzy"; rules: string[] };
```

验证至少应覆盖：

- 精确 schema 检查
- deterministic golden 输出
- 对文本轻微波动更宽容的 semantic 检查

## `Read` 作为第一能力

`Read` 应该是“第一个注册进 harness 的 capability”，而不是“特殊运行时本身”。

这意味着：

- roots 来自 harness
- invocation id 来自 harness
- traces 来自 harness
- validation 通过 harness 跑
- adapter 只属于 read capability 内部

`Read` 具体设计见：

- `read-skill-design.md`

## 与 UI 的关系

tooling UI 不是 runtime owner。

UI 负责：

- 配 roots
- 触发 invocation
- 展示结果
- 查看 trace

UI 不负责：

- 维护 permission 真相
- 发明 capability 语义
- 绕过 harness 生命周期

推荐首版页面结构：

- `Workbench`
  - 手动 invocation console
  - 按五大内置域分组
- `Installed`
  - 已连接 external server 与 projected tools
- `Marketplace`
  - 候选 external server 与 transport metadata

## Harness Context System

Harness 不只要“知道工具怎么跑”，还要“知道该给模型喂哪一小段系统上下文”。

这层能力的目标不是全量理解，而是按任务动态构建最小但充分的上下文。

### 三个索引面

- `Module-centric Index`
  - 负责模块地图
  - 回答“这件事属于哪个模块、相关代码和文档在哪”
- `Symbol-centric Navigation`
  - 负责符号跳转、调用链扩展和局部理解
  - 回答“应该看哪一个函数、类、配置项”
- `Task-centric Context`
  - 负责最终喂给模型的上下文装配
  - 回答“这次任务应该带哪些代码、文档、历史和日志”

### 必须维护的索引

- 文档索引
  - 架构、API、UI、MCP、数据模型、模块说明
- 代码索引
  - file summary
  - symbol index
  - call graph
  - git history
- 任务记忆
  - bug
  - 决策
  - TODO
  - 评审结论

### 实施顺序

推荐按下面三步推进，不能反过来：

#### Step 1: Project Map 自动生成器

必须先做。

没有 Project Map，后面的检索都会变成瞎检索。

它至少要产出：

- modules
- paths
- docs
- keywords

#### Step 2: Context Builder 最小版

只做：

- module
- doc
- code chunk

推荐链路：

```text
classify -> modules -> docs -> code -> compress
```

#### Step 3: embedding + rerank

最后再加。

它的作用是：

- 提升召回质量
- 调整当前任务的相关性排序

但它不能替代 Project Map。

### 上下文预算

预算不要写死成绝对常量，但要有默认分配策略：

- 代码
- 文档
- 规范
- 历史
- 任务
- 日志

任务类型不同，预算应可偏移：

- 重构偏代码和符号
- 设计偏文档和规范
- bug 定位偏日志和历史

### 两个补充维度

- freshness
  - 新代码、新文档、新决策优先于旧知识
- confidence
  - 每段上下文都要能解释“为什么被选中”

### 三大风险

- 只用 embedding 会错召回
- 只读代码会缺意图
- 只读文档会过时

### MVP

最小可行系统至少包含：

- project map generator
- module map
- doc index
- code index
- context builder
- confidence / freshness 输出

### 不要提前做的事

- 不要先上 embedding 再补项目地图
- 不要先做复杂 symbol graph 再没有 module map
- 不要把 rerank 当成基础设施起点

## 分阶段计划

### Phase 1

- harness runtime skeleton
- root registry
- capability registry
- invocation lifecycle
- trace event model
- `read` 作为第一能力注册

### Phase 2

- multiple roots
- approval surface
- validation runtime
- replay records

### Phase 3

- 更多 capability registration
- chat / RAG adapter integration
- 更丰富的 trace inspection UI

## 当前结论

本项目后续如果继续做工具链，不应该让每个能力各长一套状态机。

更稳的主线是：

- harness 统一持有 roots、审批、trace、validation
- capability 只负责自己的执行语义
- chat、tools workbench、external MCP 都复用同一条 invocation 主链

额外硬要求：

- harness 必须是最终安全闸门
- 任何越出 sandbox 或 authorized roots 的权限请求，都要显式用户批准
