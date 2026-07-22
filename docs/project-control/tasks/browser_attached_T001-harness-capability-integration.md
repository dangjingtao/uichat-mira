---
status: current
priority: P0
owner: harness / runtime
last_verified: 2026-07-22
layer: project-control
module: Harness
feature: BrowserAttached
doc_type: task-card
canonical: true
task_state: READY_FOR_REVIEW
related:
  - docs/project-control/governance-principles.md
  - docs/architecture/README.md
  - server/src/routes/webbridge.ts
  - server/src/mcp/tools/webbridge.tool.ts
  - server/src/harness/runtime.ts
  - server/src/harness/profiles/resolver.ts
---

# browser_attached_T001 Harness Capability Integration

## Source And Current Baseline

本任务来自项目 owner 提供的 `browser_attached — 触界已连接浏览器能力设计`，设计状态为 `Proposed / Ready for implementation`。

2026-07-22 本地代码核验结果：

- `server/src/mcp/tools/webbridge.tool.ts` 已存在 `webbridge_look / browse / act / transfer` 四个适配器，但没有在 `server/src/harness/runtime.ts` 注册。
- 现有适配器已经从 `McpInvocationContext.userId` 读取可信用户身份，并调用 `invokeWebBridge()`；模型参数中没有 `userId`。
- 现有适配器仍暴露 `look.screenshot`，工具 ID、标题、描述和 tags 尚未遵守本任务的 `browser_attached` 命名合同。
- `server/src/routes/webbridge.ts` 的 `invokeWebBridge()` 在扩展失败、断连、超时和取消时只抛出普通 `Error(message)`，扩展提供的 `code / retryable / suggestedAction` 会丢失。
- `server/src/harness/profiles/resolver.ts` 当前只注册 `browser_computer_use`，尚无 `browser_attached` 独立 Capability Profile。
- 现有 Playwright Computer Use 工具面为 `browser_observe / browser_act / browser_assert`，必须保持不变。

本任务是在上述现有代码上做最小迁移和正式接入，不重新实现 WebBridge、Chrome API、Native Messaging、WebSocket 或浏览器自动化逻辑。

## Target

把触界连接的用户真实浏览器作为独立 Harness Capability `browser_attached` 正式接入 Mira Agent，使 Agent 能通过四个命名明确的工具观察和操作用户已有 Chrome 标签页、登录态和页面交互，并让结构化结果与错误进入现有 Harness invocation、Evidence 和 Planner / Generate 主链。

固定运行链路：

```text
Agent
→ Capability / Exposure
→ Harness
→ browser_attached_*
→ invokeWebBridge()
→ 触界 Chrome Extension
→ 用户真实 Chrome
→ structured result / error
→ Evidence
→ Planner / Generate
```

`browser_attached` 与 `browser_computer_use` 是并列能力：前者操作用户已有浏览器，后者操作 Mira 管理的 Playwright 浏览器。

## Problem Layer

- architecture / runtime / Harness tool exposure
- 高风险点：浏览器动作、文件上传与下载、外部页面交互、可信用户身份传递
- 本任务不得改变 AgentGraph 主链、审批对象、执行对象或恢复语义

## Risk Gate

本任务包含浏览器动作和文件传输能力，施工前必须由项目 owner 明确确认开始实现。确认只授权本任务卡范围，不授权新增审批系统、自动降级、任意宿主路径上传或其它旁路。

## Naming Contract

Capability Profile 固定为：

```ts
{
  id: "browser_attached",
  title: "Attached Browser",
  domain: "browser_action",
  source: "internal"
}
```

中文产品文案：`已连接浏览器`。

Agent-facing Tool ID 固定为：

```text
browser_attached_look
browser_attached_browse
browser_attached_act
browser_attached_transfer
```

Provider / Runtime 名称固定为 `chujie`。不得使用 `chujie_browser`、`jianxing`、`browser_extension`、`chrome_browser` 作为 Capability ID，也不得把扩展内部裸工具名 `look / browse / act / transfer` 直接注册给 Agent。

## Tool Mapping

```text
browser_attached_look     → invokeWebBridge(tool: "look")
browser_attached_browse   → invokeWebBridge(tool: "browse")
browser_attached_act      → invokeWebBridge(tool: "act")
browser_attached_transfer → invokeWebBridge(tool: "transfer")
```

适配器只负责 Agent-facing schema、调用现有 `invokeWebBridge()`、保留结构化结果与错误，并进入现有 Harness invocation / Evidence / trace 主链。

## Agent-Facing Contract

### `browser_attached_look`

- `mode`: `page | snapshot | element | tabs`
- 可选字段：`ref`、`include`
- MVP 不向 Agent 暴露 `screenshot`；不得删除触界内部截图能力
- 结果应保留 `url / title / text / version / elements / tabId`，元素应保留可用的 `ref / role / name / text / disabled / tag / type / href / value`

### `browser_attached_browse`

- `mode`: `open | new | switch | close | back | forward | reload | scroll | scrollTo | paginate | wait`
- 可选字段：`url / ref / tabId / amount / after`
- 不增加自然语言 URL 猜测或 selector 猜测

### `browser_attached_act`

- `mode`: `click | hover | drag | fill | select | press | dialog`
- 可选字段：`ref / fromRef / toRef / value / fields / key / submit / doubleClick / after`
- Agent 不允许直接传 CSS selector
- 正常交互循环为 `look → ref → act(ref) → look`

### `browser_attached_transfer`

- `mode`: `upload | download`
- 可选字段：`ref / url / filename / saveAs / file / after`
- MVP 不允许扩展直接读取任意宿主路径；未来 workspace 文件上传必须先经过 Harness 已有文件或附件合同显式转换

以下可信运行时字段不得出现在 LLM-facing schema：

```text
userId
accessToken
backendUrl
transport
extensionClientId
```

## Structured Error Contract

`invokeWebBridge()` 必须保留扩展错误字段：

```ts
type WebBridgeInvocationErrorDetail = {
  code: string;
  message: string;
  retryable: boolean;
  suggestedAction?: string | null;
};
```

至少覆盖并可观察：

```text
STALE_ELEMENT_REF
USER_ACTIVATION_REQUIRED
MIRA_NOT_READY
AUTH_REQUIRED
ACTION_TIMEOUT
BRIDGE_DISCONNECTED
```

不得在适配器中递归重试、自动调用 `look`、静默切换 Playwright 或启动 Managed Browser。恢复必须依赖现有结构化 Evidence / Planner 循环。

## Capability Profile Contract

新增独立 Blueprint：

```ts
{
  id: "browser_attached",
  title: "Attached Browser",
  description:
    "Observe and operate the user's already-connected browser, including existing tabs and authenticated web sessions.",
  domain: "browser_action",
  tags: [
    "browser",
    "attached-browser",
    "current-browser",
    "existing-tab",
    "authenticated-session",
    "chrome",
    "webpage",
    "网页",
    "当前页面",
    "当前浏览器",
    "已登录"
  ],
  preferredToolId: "browser_attached_look",
  supportingToolIds: [
    "browser_attached_look",
    "browser_attached_browse",
    "browser_attached_act",
    "browser_attached_transfer"
  ]
}
```

保留 `browser_computer_use`，并让其 description / tags 清楚强调 managed browser、isolated session、Playwright 和 Mira-managed browser。不得用关键词或 Provider 分支硬编码路由。

## Allowed Changes

优先允许修改：

- `server/src/routes/webbridge.ts`，仅限保留结构化 invocation error 与断连、超时、取消语义
- `server/src/mcp/tools/webbridge.tool.ts`，仅限迁移、替换或删除现有未注册的 `webbridge_*` 适配器
- `server/src/mcp/tools/browser-attached.tool.ts`
- `server/src/mcp/tools/browser-attached.tool.test.ts`
- `server/src/harness/runtime.ts`
- `server/src/harness/profiles/resolver.ts`
- `server/src/harness/capability-profiles.test.ts`
- `server/src/harness/candidates-core/browser-intent-exposure.test.ts`
- 本任务卡和 `docs/project-control/project-control-ledger.md`

只有现有合同确实无法满足且有测试证据时，才允许最小修改：

- `server/src/mcp/core/definitions.ts`
- `server/src/harness/registry.ts`
- `server/src/harness/invocations.ts`
- `server/src/agent/nodes/harness-tool-result.ts`
- `server/src/agent/evidence.ts`

触碰上述条件文件前，施工报告必须记录当前合同为何丢失字段，以及最小修改位置。不得借机重构。

## Forbidden Changes

- `server/src/agent/graph/**`、`server/src/agent/graph.ts` 及 Planner → Normalize → Policy → ToolNode → Evidence → Planner 主链拓扑
- 新增 Browser、Chujie、Extension 专用 AgentGraph Node 或 Planner
- 替换、重命名或重构 `browser_computer_use`、`browser_observe`、`browser_act`、`browser_assert`
- 把触界实现成 `browser_computer_use` 的 Provider，或把两套 Browser Runtime 合并成同一个 Session 模型
- 重写 WebBridge 协议、Chrome Extension、Native Messaging、WebSocket 或 DOM 操作
- 新增关键词或 regex 路由、`provider === "chujie"` 分支、`toolId === "browser_attached_*"` 的 Graph 特判
- 新增审批节点、审批状态机、blanket approval 或独立 Browser 权限系统
- 在适配器内自动重试、递归 `look`、自动 fallback 到 Playwright 或静默启动 Managed Browser
- 允许模型传可信运行时字段或允许扩展直接读取任意本地路径
- 新建 Trace UI、Browser UI，或为 screenshot 大改 artifact 系统
- 引入无关依赖、hardcoded local path/env、mock 默认值、静默 fallback 或兼容旁路
- 手工修改 `pnpm-lock.yaml`

## Non-Goals

- Attached Browser Run Target / Tab 锁定
- snapshot generation guard / `STALE_SNAPSHOT`
- 动态 Capability availability / readiness
- screenshot artifact 或视觉模型接入
- Browser Provider 自动编排
- 多 Provider 抽象
- 新的 Trace UI 或浏览器管理 UI

## Acceptance Criteria

1. Harness Registry 注册四个固定 `browser_attached_*` Tool ID，旧 `webbridge_*` 不作为 Agent-facing 工具暴露。
2. 四个工具按固定映射调用现有 `invokeWebBridge()`，原始 params 不被不必要改写，`AbortSignal` 正确透传。
3. `userId` 仅来自可信 `McpInvocationContext`，模型 schema 不含任何可信运行时字段；Evidence 不向模型暴露原始用户身份或令牌。
4. `browser_attached_look` 的 Agent-facing schema 不包含 `screenshot`，其它四个工具 schema 符合本卡合同，不允许 CSS selector 或任意宿主路径上传。
5. WebBridge 失败保留 `code / message / retryable / suggestedAction`；扩展未连接、stale ref、timeout 和 auth failure 都进入统一失败合同。
6. 新增独立 `browser_attached` Capability Profile，preferred/supporting tools 完全符合命名合同。
7. `browser_computer_use` 保持存在，两套 Capability 的工具面不混合，Playwright Computer Use 运行行为不变。
8. “看看我现在 Chrome 打开的这个页面”可召回 `browser_attached`；读取已登录后台并写入工作区的复合任务不会排斥 Edit 工具。
9. 四个工具进入现有 Harness invocation、Evidence 和 trace 主链，至少保留 `toolId / provider / args / status / timing / result或error` 以及浏览器结果关键字段。
10. 连接不可用时返回结构化失败，不自动切换 Playwright、不静默降级、不创建另一套业务流程。
11. 定向 unit / contract 测试、server typecheck 和 `pnpm check` 通过。
12. 使用真实登录用户、真实触界扩展和真实 Chrome 完成观察、动作、再次观察的黑盒 smoke，并保存可核验证据。
13. 真实或受控集成验证覆盖 `BRIDGE_DISCONNECTED / STALE_ELEMENT_REF / ACTION_TIMEOUT / AUTH_REQUIRED`，不伪造扩展结果。
14. 实现未修改 AgentGraph 主链，且有现有 Playwright Computer Use 回归证据。

## Required Verification

### Unit

至少覆盖：

1. 四个 Agent-facing Tool ID 到扩展裸工具名的映射
2. trusted `userId` 来源与模型 schema 排除
3. params 原样透传与 `AbortSignal` 透传
4. structured error 字段保留
5. extension disconnected 明确失败
6. `look.screenshot` 不进入 Agent-facing schema

建议命令，施工时按实际 Vitest 路径校正但不得减少覆盖：

```bash
pnpm --filter @ui-chat-mira/server test -- server/src/mcp/tools/browser-attached.tool.test.ts
pnpm --filter @ui-chat-mira/server test -- server/src/harness/capability-profiles.test.ts server/src/harness/candidates-core/browser-intent-exposure.test.ts
```

### Contract / Regression

至少验证：

- Harness Registry 和 Capability Profile 的四工具接入
- structured result / error 进入 invocation 与 Evidence
- `browser_computer_use` 与 `browser_observe / browser_act / browser_assert` 保持存在且工具面不混合
- Browser intent 与 Edit 复合 exposure 不退化

执行：

```bash
pnpm --filter @ui-chat-mira/server typecheck
pnpm check
```

### Black-Box Smoke

必须使用真实运行时：

1. 正常启动 UIChat Mira backend 与桌面入口。
2. 使用真实登录用户连接触界 Chrome 扩展。
3. 从 Agent 用户入口发起“观察当前页面”请求。
4. `browser_attached_look` 返回当前真实页面的 URL、title 和 snapshot。
5. Agent 使用 snapshot 中的真实 ref 调用 `browser_attached_act`，页面发生可见变化。
6. Agent 再次调用 `browser_attached_look`，Evidence 和最终回答反映变化后的真实状态。
7. 分别验证 extension disconnected、stale ref、timeout 和 auth failure 的结构化错误。
8. 记录 invocation / Evidence / trace，不得只用 `invokeWebBridge()` 单元测试替代黑盒主链。

## Environment Contract

- backend host / port 继续来自 `runtime.config.cjs`，不新增或复制数字端口。
- 使用当前认证用户的真实运行时上下文，不写死 `userId`、token、workspace、backend URL、Provider 或模型。
- 真实 smoke 依赖已安装并连接的触界 Chrome 扩展、有效 Mira 登录态和可安全交互的测试页面。
- 本任务默认不新增 env；如验证确需 DEBUG 开关，必须显式命名、默认关闭并记录。
- 所有测试临时文件、日志和数据库放在仓库根目录 `.test-artifact/`，不得进入业务数据目录或提交版本控制。

## Mock / Fixture Policy

- Unit 测试可以 mock `invokeWebBridge()` 和受控扩展响应，但 mock 只能证明局部映射与错误合同。
- Contract 测试应尽量使用真实 Harness Registry / invocation / Evidence 路径。
- Black-box smoke 禁止使用 mock 扩展结果、假用户身份、硬编码本地路径或生产默认 fallback。
- 如果某类真实错误无法安全触发，必须记录未验证项、原因和风险，不得伪造通过。

## Evidence Requirements

提交评审时必须附上：

1. 修改文件清单与完整 diff 摘要
2. 四个 Tool ID、Agent-facing schema 和 Capability Profile
3. `invokeWebBridge()` structured error 合同变化
4. Harness Registry、Capability exposure、invocation、Evidence 和 trace 证据位置
5. Unit / Contract / Black-box smoke 三层验证命令、原始结果与结论
6. 真实 Chrome smoke 的用户输入、页面、关键 invocation、动作前后观察与最终回答
7. 四类结构化错误的验证证据或明确未验证原因
8. Playwright Computer Use 回归证据
9. 环境、env、workspace root、mock、fixture 和 hardcoded path 使用说明
10. 是否修改 AgentGraph：必须为“否”
11. 未完成项、已知限制与风险
12. 独立提交 SHA

## Implementation Evidence (2026-07-22)

### Changed Files

- `server/src/mcp/tools/browser-attached.tool.ts`（新增）
- `server/src/mcp/tools/browser-attached.tool.test.ts`（新增）
- `server/src/mcp/tools/webbridge.tool.ts`（删除旧未注册适配器）
- `server/src/routes/webbridge.ts`
- `server/src/harness/runtime.ts`
- `server/src/harness/profiles/resolver.ts`
- `server/src/harness/capability-profiles.test.ts`
- `server/src/harness/candidates-core/browser-intent-exposure.test.ts`
- `server/src/mcp/core/definitions.ts`（条件允许：通用 structured error 字段）
- `server/src/mcp/core/invocations.ts`（条件允许：通用错误透传与 Computer Use 固定工具集合）
- `server/src/agent/nodes/harness-tool-result.ts`（条件允许：现有 execution 附加 structured error）
- `server/src/agent/evidence.ts`（条件允许：现有失败 Evidence 消费 structured error）

### Diff Summary

- 新增并注册 `browser_attached_look / browse / act / transfer`，分别原样映射到现有 WebBridge `look / browse / act / transfer`。
- 删除旧的、未注册的 `webbridge_*` 适配器；Agent-facing schema 排除 screenshot、CSS selector、任意宿主路径和全部可信运行时字段。
- `userId` 继续只来自 `McpInvocationContext`，Evidence 不再记录原始用户身份；provider metadata 为 `chujie`。
- 新增 `WebBridgeInvocationError`，保留 `code / message / retryable / suggestedAction`；断连、超时和取消使用明确结构化 code，未增加内部重试或自动降级。
- structured error 进入现有 invocation record、trace metadata、Agent execution 和 Evidence，不改变 AgentGraph 拓扑、节点决策、审批或恢复语义。
- 新增独立 `browser_attached` Profile，并强化 `browser_computer_use` 的 managed / isolated / Playwright 语义。
- Computer Use invocation 判定由 `browser_*` 前缀收紧为 `browser_observe / browser_act / browser_assert` 固定集合，避免 attached invocation 进入 Playwright Computer Use repository。

### Verification Results

| Layer | Command / Check | Result |
| --- | --- | --- |
| Unit + Contract | `pnpm --filter @ui-chat-mira/server exec vitest run src/mcp/tools/browser-attached.tool.test.ts src/harness/capability-profiles.test.ts src/harness/candidates-core/browser-intent-exposure.test.ts src/mcp/core/invocations.test.ts src/agent/__tests__/harness-llm-content.test.ts src/agent/__tests__/generic-tool-evidence.test.ts` | passed：6 files / 41 tests |
| Unit final rerun | `browser-attached.tool.test.ts` | passed：1 file / 8 tests |
| Server typecheck | `pnpm --filter @ui-chat-mira/server typecheck` | passed |
| Workspace typecheck | `pnpm check` | passed：desktop / core / deepagents-spike / docs-site / server |
| Playwright Computer Use regression | browser tools、browser acceptance Evidence、approval resolution、model loop | passed：4 files / 11 tests |
| Diff hygiene | `git diff --check` | passed：无 whitespace error |
| Backend runtime | `GET http://127.0.0.1:8787/health`，端口来源为 `runtime.config.cjs` | passed：`success: true` |
| Electron UI registration | Settings → Tools → Browser Action | passed：可见 4 个 Attached Browser 工具与 3 个原 Playwright 工具 |
| Real Chrome smoke | TouchRealm 状态检查 | not run：页面显示 `Native 已安装 / 等待扩展`，没有可核验的已连接触界扩展 |

完整运行旧 `server/src/harness/__tests__/computer-use-exposure.test.ts` 时有两个未修改的既有断言失败：旧断言要求隐藏 browser / terminal，但当前未修改 resolver 在 public tools 不超过 20 时明确全部暴露。施工未修改该文件或对应 exposure 实现，本记录不把它计为本任务通过证据。

### Acceptance Evidence Status

1. 四工具注册与旧 ID 排除：已验证。
2. 固定映射、params 与 `AbortSignal` 透传：已验证。
3. trusted `userId` 与 Evidence 脱敏：已验证。
4. Agent-facing schema 与上传边界：已验证。
5. structured error：代码、Unit 和 Contract 已验证；真实扩展错误未完整验证。
6. 独立 Capability Profile：已验证。
7. Computer Use 工具面与 repository 隔离：已验证。
8. 当前 Chrome 意图与 Edit 复合 exposure：受控测试已验证。
9. invocation / Evidence / trace 结构化字段：已验证。
10. 断连结构化失败且无自动降级：已验证。
11. 定向测试、server typecheck 与 `pnpm check`：已验证。
12. 真实登录用户、真实扩展、真实 Chrome 的 look → act → look：未验证。
13. `BRIDGE_DISCONNECTED` 已用真实未连接状态验证；stale / timeout / auth 只有 Unit / Contract 证据，真实扩展集成未验证。
14. AgentGraph 主链未修改；Playwright 核心回归已验证。

### Environment / Mock / Hardcode

- 未新增或修改生产 env；backend host / port 继续来自 `runtime.config.cjs`。
- Unit 使用 `invokeWebBridge` mock、受控 embedding mock 和 Computer Use repository spy；这些 mock 不作为真实 Chrome 证据。
- 测试临时设置并恢复 `DATABASE_URL`，只用于证明 attached invocation 不进入 Computer Use repository。
- 未新增生产 hardcoded path、用户 ID、token、端口、workspace、Provider 分支、mock 默认值、fallback 或兼容旁路。
- 未修改 AgentGraph 主链、Playwright 实现、扩展协议、审批、UI 或 `pnpm-lock.yaml`。

### Remaining Work And Risks

- 必须在触界扩展真实连接后，从 Agent 用户入口完成 look → ref act → look → Evidence → 最终回答 smoke。
- 必须补真实 `STALE_ELEMENT_REF / ACTION_TIMEOUT / AUTH_REQUIRED` 集成证据；当前只有结构化合同测试。
- 未完成独立提交、push 或 PR；任务在 owner 明确“请评审”前保持 `READY_FOR_REVIEW`，不得标记 `DONE`。

## Review Prompt

你正在评审 `browser_attached_T001 Harness Capability Integration`。

从真实 Agent 用户入口审查 `browser_attached` 是否经过现有 Capability / Exposure → Harness → invocation → Evidence → Planner / Generate 主链，不能只接受适配器单元测试或直接调用 `invokeWebBridge()`。

重点核验：

1. 四个 Agent-facing Tool ID 与 `look / browse / act / transfer` 映射是否准确
2. 是否复用了现有 WebBridge，而不是重写扩展协议或浏览器执行逻辑
3. `userId` 是否只来自可信 execution context，模型是否能注入任何 runtime 字段
4. structured error 是否完整保留且没有适配器内重试或自动 `look`
5. `browser_attached` 与 `browser_computer_use` 是否保持独立语义、独立工具面和独立 Runtime
6. 是否存在关键词、regex、Provider 或 Tool ID 的 AgentGraph 特判
7. Browser intent 是否能召回 attached browser，复合任务是否仍能暴露 Edit 等必要能力
8. 上传是否存在任意本地路径旁路，截图 Base64 是否进入 LLM 文本上下文
9. 浏览器动作是否复用现有 Harness invocation / approval / Evidence / trace 合同
10. 真实 Chrome smoke 是否包含观察、ref 动作、再次观察和最终回答
11. 四类错误验证是否可核验，未验证项是否诚实记录
12. Playwright Computer Use 是否有回归证据且运行行为未改变
13. 是否存在 hardcoded path/env、mock 默认值、静默 fallback、兼容旁路或无关重构
14. 是否修改 AgentGraph 主链；如有，直接判定 BLOCKED

输出格式：

- 结论：PASS / BLOCKED
- 阻断项
- 非阻断问题
- Scope / Forbidden Area 核验
- Tool / Runtime / Trusted Context 合同核验
- Structured Error / Recovery 合同核验
- Capability Exposure / Computer Use 隔离核验
- Unit / Contract / Black-box Smoke 证据核验
- Environment / Mock / Hardcode 核验
- 建议的最小修复
