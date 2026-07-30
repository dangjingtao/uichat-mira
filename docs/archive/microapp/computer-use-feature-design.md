# Computer Use 调试工作台设计

Status: Proposed
Owner: microapp / desktop / runtime
Last verified: 2026-07-14
Layer: raw-source
Module: MicroAPP
Feature: ComputerUse
Doc Type: design
Canonical: true
Related:
  - README.md
  - computer-use-microapp-poc.md
  - ../architecture/README.md
  - ../architecture/ipc-and-preload.md
  - ../harness/README.md

## 单点真相范围

这页定义 `computer_use` 第一阶段的产品和技术形态：

- 页面是浏览器工具调试工作台，不是聊天窗口
- 用户配置结构化参数，手动调用并观察浏览器工具
- backend 持有浏览器会话、调用、审批、trace 和 artifact 真相
- Agent 后续通过少量高层 MCP 工具使用浏览器
- 只有真正接入模型后，页面才显示模型规划和模型运行状态

这页不把以下内容当作已经存在的能力：

- 自然语言目标理解
- 大模型自动规划
- 页面语义推理
- 自动读取页面内容并完成任意目标
- 宿主桌面控制

## 结论先说

第一阶段页面定位为：

> `Computer Use Debugger`：浏览器工具、参数和执行反馈调试台。

它不是：

- 自然语言 Computer Use Agent
- 聊天式浏览器代理
- 宿主桌面遥控器
- Playwright API 的完整可视化包装

第一阶段的基本闭环是：

```text
配置运行参数
  -> 创建受控浏览器会话
  -> inspect 当前页面
  -> act 执行一个结构化动作
  -> inspect / verify 获取真实反馈
  -> 保存 invocation、trace 和 artifact
```

只有模型模式才增加：

```text
结构化任务参数
  -> 模型选择 browser_inspect / browser_act / browser_verify
  -> 执行工具
  -> 返回真实工具结果给模型
  -> 模型继续或结束
```

## 设计原则

### 1. 页面能力必须和后端真实能力一致

如果后端没有调用模型，页面不能出现：

- `Create Plan`
- `Planning`
- `AI is thinking`
- `任务计划已生成`

规则代码生成的固定动作只能叫：

- `Action Sequence`
- `Manual Invocation`
- `Rule-based Debug Run`

### 2. 观察先于操作

Agent 或用户不能依赖猜测 selector。浏览器工具必须先返回结构化页面观察结果，再使用其中的 `ref` 执行动作。

```text
inspect -> 读取 ref -> act -> inspect -> verify
```

### 3. Playwright 是执行器，不是产品协议

页面和 Agent 不直接接触 `Page`、`BrowserContext`、CSS selector 或任意 Playwright 代码。

产品协议使用：

- session
- snapshot
- ref
- action
- assertion
- observation
- artifact

### 4. 风险必须绑定真实调用参数

审批不能只绑定“这是 browser 工具”，而要绑定：

- tool id
- session id
- action 参数
- 当前 URL
- 当前 snapshot hash
- 目标 ref

### 5. 失败是正常反馈

页面必须完整展示：

- 运行时不可用
- 浏览器启动失败
- 页面导航失败
- ref 失效
- 等待超时
- 审批被拒绝
- 验证不匹配
- 模型未接入

不允许用固定成功文案覆盖失败原因。

## 用户模式

### Manual Debug Mode

第一阶段默认模式。用户通过表单选择参数和动作，系统只执行用户明确提交的工具调用。

页面显示：

```text
Mode: Manual Debug
Model: Not used
```

该模式不需要自然语言 Goal，不生成计划。

### Model Run Mode

后续模式。只有实际接入模型 provider 后才启用。

页面必须显示：

- provider
- model
- model call count
- exposed tools
- 当前模型请求
- 当前模型返回
- 模型选择的工具和参数

模型模式的输入是结构化任务规格，不是聊天式 Goal：

```json
{
  "initialUrl": "https://example.com",
  "allowedDomains": ["example.com"],
  "assertions": [
    {
      "kind": "text",
      "expected": "Example Domain"
    }
  ],
  "maxSteps": 8
}
```

如果没有真实模型调用，Model Run Mode 不得显示为可用。

## 页面信息架构

### 设计基线声明

本页面必须从空白信息架构开始设计。

当前仓库中的 `Computer Use Studio` 页面不是设计参考，不得复用或延续：

- 页面布局
- 信息层级
- 文案
- 状态表达
- 按钮命名
- 浏览器画布表现
- `Goal / Create Plan / Start Task` 交互模型

实现时只允许复用项目级纯 UI 组件、颜色 token、间距 token 和无业务语义的基础交互组件。具体页面结构必须根据本设计中的 session、tool call、observation、approval、evidence 和 result 重新设计。

页面名称：

```text
Computer Use Debugger
```

页面分为三列：

```text
左侧：Run Config
中间：Browser State
右侧：Execution Feedback
```

### 顶部状态栏

顶部只显示运行上下文：

- `Runtime: Ready / Not Installed / Broken`
- `Session: None / session id`
- `Mode: Manual Debug / Model Run`
- `Model: Not connected / provider + model`
- `Invocation: Idle / Running / Awaiting Approval / Completed / Failed`

顶部不显示“计划已生成”这类没有真实依据的状态。

### 左侧 Run Config

#### Browser Runtime

- browser channel
- executable source
- headless
- viewport width / height
- locale
- timezone

#### Session

- session id
- reuse session
- create new session
- clear session

#### Navigation Boundary

- initial URL
- allowed domains
- allowed URL schemes
- maximum redirects

#### Execution Limits

- action timeout
- session timeout
- maximum action count
- maximum model calls
- screenshot policy

#### Approval Policy

- manual approval required
- approval scope: current invocation only
- blocked action kinds

敏感内容不要直接展示在页面中。登录态、cookie、storage state 和密码字段只能显示摘要或哈希。

### 中间 Browser State

中间区域展示浏览器事实，不模拟浏览器应用本身。

#### Current Page

- current URL
- page title
- HTTP status，如可得
- last navigation time

#### Accessibility Snapshot

显示带 `ref` 的结构化快照，例如：

```text
heading "Example Domain" [level=1] ref=e1
link "More information..." ref=e2
```

用户可以点击 `ref`，将其带入动作编辑器。

#### Visible Text

只展示经过大小限制的可见文本摘要。必须显示：

- 是否截断
- 原始长度
- 当前 URL
- snapshot hash

#### Screenshot

截图是观察和证据，不是唯一状态来源。截图必须关联：

- session id
- invocation id
- page URL
- createdAt

### 右侧 Execution Feedback

#### Tool Calls

按时间顺序显示真实调用：

```json
{
  "invocationId": "inv_001",
  "toolId": "browser_act",
  "status": "completed",
  "args": {
    "action": {
      "kind": "click",
      "ref": "e2"
    }
  }
}
```

#### Evidence

显示：

- snapshot
- visible text
- screenshot
- action log
- console error
- download artifact
- trace artifact

#### Result

只显示最终事实：

- status
- final URL
- final title
- verified facts
- unresolved gaps
- error

#### Raw JSON

显示完整的请求、响应、事件和 trace id，服务于开发调试。

### 底部操作栏

第一阶段按钮：

- `New Session`
- `Inspect`
- `Execute Action`
- `Verify`
- `Stop`
- `Reset`

删除：

- `Create Plan`
- `Start Task`
- `Retry Goal`

如果需要重试，重试的是明确的 invocation 或动作参数，不是模糊的自然语言目标。

## 结构化参数设计

### Session 参数

```ts
type BrowserSessionConfig = {
  channel: "chromium" | "chrome" | "edge";
  executablePath?: string;
  headless: boolean;
  viewport?: {
    width: number;
    height: number;
  };
  allowedDomains: string[];
  initialUrl?: string;
  actionTimeoutMs: number;
  sessionTimeoutMs: number;
};
```

### Inspect 参数

```ts
type BrowserInspectInput = {
  sessionId: string;
  includeScreenshot?: boolean;
  includeVisibleText?: boolean;
  maxSnapshotChars?: number;
};
```

### Action 参数

```ts
type BrowserAction =
  | { kind: "navigate"; url: string }
  | { kind: "click"; ref: string }
  | { kind: "type"; ref: string; text: string }
  | { kind: "select"; ref: string; value: string }
  | { kind: "press"; ref: string; key: string }
  | { kind: "scroll"; x?: number; y?: number }
  | { kind: "wait"; ref?: string; text?: string; timeoutMs?: number };

type BrowserActInput = {
  sessionId: string;
  pageUrl: string;
  snapshotHash: string;
  action: BrowserAction;
};
```

第一阶段不把 `selector` 作为 Agent 或页面主参数。Playwright selector 可以在执行器内部由 `ref` 解析。

### Verify 参数

```ts
type BrowserAssertion =
  | { kind: "title"; expected: string }
  | { kind: "url"; expected: string }
  | { kind: "text"; expected: string }
  | { kind: "visible"; ref: string }
  | { kind: "value"; ref: string; expected: string };

type BrowserVerifyInput = {
  sessionId: string;
  assertion: BrowserAssertion;
};
```

### 统一工具结果

```ts
type BrowserToolResult = {
  ok: boolean;
  sessionId: string;
  invocationId: string;
  page: {
    url: string;
    title?: string;
    snapshotHash?: string;
  };
  observation?: {
    snapshot?: string;
    visibleText?: string;
    facts?: string[];
    truncated?: boolean;
  };
  artifacts: Array<{
    id: string;
    kind: "screenshot" | "download" | "trace" | "video" | "json";
    title: string;
    uri?: string;
  }>;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
};
```

## MCP 工具面

对 Agent 只暴露三个高层工具，不暴露完整 Playwright API：

```text
browser_inspect
browser_act
browser_verify
```

### `browser_inspect`

职责：读取当前页面事实。

能力元数据：

```ts
{
  domain: "browser_action",
  sideEffect: "none",
  requiresApproval: false,
  networkAccess: true,
  longRunning: false
}
```

### `browser_act`

职责：执行一个结构化浏览器动作。

第一阶段安全策略：整个工具调用默认需要审批。后续如果建立了按 action、URL 和目标 ref 的动态风险策略，再细分自动放行范围。

### `browser_verify`

职责：执行结构化验证并返回事实，不替模型决定任务是否完成。

`browser_verify` 的结果进入 Agent observation 和 evidence，模型或上层编排器负责决定继续、结束或询问用户。

### MCP 工具边界

默认不暴露：

- 任意 `evaluate`
- 任意 Playwright 代码执行
- 任意 CSS selector 注入
- 直接读取 cookie、密码、localStorage 的通用接口
- 宿主桌面键盘和鼠标注入

## Backend API

调试工作台使用 session + invocation 模型，不把浏览器执行伪装成一个同步任务计划。

建议接口：

```text
GET  /microapps/computer-use/runtime
POST /microapps/computer-use/sessions
GET  /microapps/computer-use/sessions/:id
POST /microapps/computer-use/sessions/:id/inspect
POST /microapps/computer-use/sessions/:id/actions
POST /microapps/computer-use/sessions/:id/verifications
POST /microapps/computer-use/sessions/:id/stop
POST /microapps/computer-use/runs
GET  /microapps/computer-use/invocations/:id
GET  /microapps/computer-use/invocations/:id/events
POST /microapps/computer-use/invocations/:id/approval
```

### 手动调试调用

```text
创建 session
  -> inspect
  -> actions / verifications
  -> 读取 invocation events
```

### 模型运行调用

```text
创建 session
  -> 创建结构化 run
  -> 模型调用 browser_inspect
  -> 模型调用 browser_act
  -> 模型调用 browser_verify
  -> 循环直到完成、失败、阻塞或达到预算
```

所有调用都必须进入统一 MCP invocation 链，复用：

- schema validation
- approval
- input hash
- trace
- stream events
- artifact
- retention

## 浏览器会话服务

新增浏览器会话服务作为 Playwright 与 MCP 之间的边界：

```ts
interface BrowserSessionManager {
  create(config: BrowserSessionConfig): Promise<BrowserSession>;
  get(sessionId: string): Promise<BrowserSession | null>;
  inspect(
    sessionId: string,
    input: BrowserInspectInput,
  ): Promise<BrowserToolResult>;
  act(
    sessionId: string,
    input: BrowserActInput,
  ): Promise<BrowserToolResult>;
  verify(
    sessionId: string,
    input: BrowserVerifyInput,
  ): Promise<BrowserToolResult>;
  stop(sessionId: string): Promise<void>;
}
```

服务职责：

- 持有 BrowserContext 和 Page
- 生成 snapshot 和 snapshot hash
- 把 `ref` 解析为内部 locator
- 校验 allowed domains
- 校验 action timeout 和 session timeout
- 统一收集截图、日志、下载和 trace
- 在 session 结束时关闭浏览器资源

MCP 工具实现不直接创建 Playwright page。页面和 Agent 也不接触 Playwright 类型。

## 审批设计

### 高风险动作

默认需要审批：

- 提交表单
- 发送消息
- 登录
- 购买
- 删除
- 文件上传
- 文件下载
- 可能改变外部数据的点击
- 任何超出 allowed domains 的导航

### 审批冻结对象

审批请求至少包含：

```ts
type BrowserApprovalSnapshot = {
  invocationId: string;
  toolId: "browser_act";
  sessionId: string;
  action: BrowserAction;
  pageUrl: string;
  snapshotHash: string;
  risk: "low" | "medium" | "high";
  reason: string;
  preview?: string;
};
```

审批通过后，如果当前 URL 或 snapshot hash 已变化，必须重新审批，不能直接复用旧批准。

## 状态模型

### Runtime

```text
not_installed
ready
broken
```

下载过程由 backend 管理，页面只展示真实进度和结果。

### Session

```text
creating
ready
busy
stopped
failed
```

### Invocation

```text
queued
running
awaiting_approval
completed
failed
cancelled
```

### Model Run

```text
idle
running
waiting_approval
completed
failed
blocked
cancelled
```

`planning` 不作为默认状态。只有实际存在模型调用并正在执行模型规划时，才允许使用 `planning`。

## Artifact 和证据

每次 invocation 都应记录：

- invocation id
- tool id
- 参数摘要
- 当前 URL
- 页面标题
- snapshot hash
- 执行耗时
- 结果或错误

可选 artifact：

- accessibility snapshot
- screenshot
- visible text JSON
- action log
- console log
- download
- Playwright trace
- video

截图和日志必须归属于 invocation，不能只写到一个没有任务关联的公共目录。

## 运行时边界

### Renderer

负责：

- 展示参数
- 发起 backend HTTP 请求
- 展示状态、事件和 artifact

不负责：

- 创建 Playwright
- 判断审批
- 读取 Node API
- 解析浏览器 session 真相

### Preload / Shell

只提供最小 runtime 信息：

- platform
- isPackaged
- backendUrl

不承载浏览器业务接口。

### Backend

负责：

- 浏览器 session
- Playwright 执行
- MCP invocation
- 审批
- trace
- artifact
- 任务和调用恢复

## 持久化要求

第一版调试可以允许 session 在进程内存中运行，但 invocation 和 artifact 索引不能只存在内存中。

至少应持久化：

- invocation record
- action args 摘要
- status
- approval record
- result summary
- artifact metadata
- trace id

浏览器进程重启后的 session 恢复属于后续范围，但必须返回明确的 `session_lost`，不能伪装成任务成功。

## 与现有实现的关系

本节不是视觉迁移方案，也不是对当前页面的改造指南。当前实现只作为待替换对象记录，不能作为新页面的设计输入。

当前旧页面中的字段和按钮全部不属于新设计：

| 旧设计 | 新设计 |
| --- | --- |
| `Goal` | `Initial URL`、`Allowed domains`、结构化 assertions |
| `Create Plan` | `Inspect`、`Execute Action` |
| `Start Task` | `Run Invocation` 或 `Run Model Loop` |
| `Plan` | `Tool Calls` / `Action Sequence` |
| 固定浏览器画布 | `Browser State` 和真实 screenshot |
| 固定成功文案 | `Result`、`Evidence`、真实错误 |
| `Retry Goal` | 重放指定 invocation 或重新创建 session |

现有固定规则执行器如需保留，只能作为隔离的测试适配器，并且必须明确标记：

```text
Rule-based adapter
Model planner: unavailable
```

它不能继续作为真实 Agent 能力对外宣传。

## 实现分期

### Phase 0: 文档和协议

- 确认调试台信息架构
- 确认 session / invocation / artifact 模型
- 注册 `browser_inspect`、`browser_act`、`browser_verify` 的 schema
- 明确审批冻结对象

### Phase 1: 手动浏览器调试

- 创建 Chromium session
- inspect accessibility snapshot
- 使用 ref 执行基础 action
- verify title / URL / text / visible
- 展示真实 invocation events 和 screenshot
- 不接大模型

### Phase 2: MCP Agent 接入

- 通过现有 MCP registry 注册三个工具
- 接入现有 approval、trace、artifact 链
- 让 Agent 只能消费结构化工具结果
- 增加 tool result size guard 和 summary contract

### Phase 3: 真实模型模式

- 接入 provider 和模型选择
- 使用结构化 run spec
- 模型只能从三个浏览器工具中选择
- 展示每次模型请求、响应和 tool call
- 验证模型完成条件来自 `browser_verify`，不是固定字符串

### Phase 4: 历史和恢复

- invocation 历史
- artifact 历史
- 失败回放
- session lost 处理
- 必要时增加浏览器上下文恢复

### T4 页面实现约束

页面实现必须先完成独立的空白线框和状态清单，再进入组件编码。不得从当前 `Computer Use Studio` 页面复制、删改或局部重排。

以下内容不属于当前阶段：

- 宿主桌面自动化
- 浏览器插件接管用户现有标签页
- 任意 JavaScript 执行
- 凭据托管
- 多浏览器并发池
- 自动绕过 CAPTCHA

## 验收标准

### 页面

1. 页面没有自然语言 Goal 输入框。
2. 页面明确显示当前模式是否使用模型。
3. 页面能够创建 session、inspect、执行动作和 verify。
4. 页面展示真实 URL、标题、snapshot、tool call、artifact 和结果。
5. 没有模型连接时，不显示 planning 或 AI thinking 状态。
6. 失败状态必须显示具体错误和对应 invocation。

### MCP

1. 三个工具都有严格 input schema 和 output schema。
2. `browser_act` 使用结构化 action，不接受任意 Playwright 代码。
3. 工具调用进入现有 approval、trace、artifact 和事件链。
4. approval 绑定 session、URL、snapshot hash 和 action 参数。
5. 工具结果能够进入 Agent observation 和 evidence。

### 安全

1. 所有导航遵守 allowed domains。
2. 高风险动作不能通过修改页面参数绕过审批。
3. snapshot 变化后不能复用旧 ref 的审批结果。
4. 浏览器 session 不通过 renderer 或 preload 暴露原生对象。
5. 页面和工具默认不提供任意 evaluate。

### 能力真实性

1. 手动模式只报告真实 Playwright 执行结果。
2. 模型模式只有在真实 provider 调用后才显示可用。
3. 固定规则适配器必须标识为 rule-based，不得标识为 AI planner。
4. “读取标题”“验证文本”等结果必须来自页面观察或 verify，不得由固定字符串生成。

## 当前结论

`computer_use` 第一阶段应该先成为一个诚实的浏览器工具调试工作台：

```text
参数
  -> session
  -> inspect
  -> act
  -> verify
  -> evidence / result
```

这条链路稳定后，再接真实模型循环。页面、MCP 工具和 backend 状态都必须以真实执行结果为准，不能再用“创建计划”“任务成功”等产品词汇掩盖固定规则实现。
