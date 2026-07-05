# UIChat Mira V1.6 本地总测试评审摘要

## 基线信息

- 当前 commit hash: `3b79d1dbcfc7ee076fbb925a2636cb18ba54c17d`
- 当前分支状态: 非干净工作区
- `git status --short --branch` 结果:
  - `## main...origin/main`
  - `M docs/project-control/project-control-ledger.md`
  - `M docs/project-control/tasks/harness_context_T002-context-read-bench.md`
- 取证时间: `2026-07-05`
- 证据文件:
  - `server/test-report/v16-total-review-typecheck.txt`
  - `server/test-report/v16-total-review-tests.txt`

## 执行过的命令与结果

| 命令 | 结果 |
| --- | --- |
| `git rev-parse HEAD` | 通过 |
| `git status --short --branch` | 通过 |
| `git log --oneline -n 10` | 通过 |
| `pnpm --filter @ui-chat-mira/server typecheck` | 通过 |
| `pnpm --filter @ui-chat-mira/server test` | 失败 |
| `pnpm --filter @ui-chat-mira/server exec vitest run src/harness/exposure.test.ts src/harness/tool-candidates.test.ts src/harness/capability-diagnostics.test.ts src/mcp/tools/web-search.tool.test.ts src/mcp/tools/terminal-session.tool.test.ts src/routes/proxy-provider/chat-tool-surface.test.ts` | 失败 |
| `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/toolcall-loop-regression.test.ts src/agent/__tests__/tool-call-normalize.test.ts src/agent/__tests__/tool-node.test.ts src/agent/__tests__/policy.test.ts src/agent/__tests__/graph.test.ts src/agent/__tests__/routes.test.ts src/routes/proxy-provider/chat-tool-loop.test.ts` | 通过 |
| `pnpm --filter @ui-chat-mira/server exec vitest run src/sandbox/executor.test.ts src/harness/sandbox.test.ts src/harness/sandbox/index.test.ts` | 通过 |
| `pnpm --filter @ui-chat-mira/server exec vitest run src/harness/context/planner.test.ts src/harness/context/bench/cases.test.ts src/mcp/tools/read-list.tool.test.ts src/mcp/tools/read-open.tool.test.ts src/mcp/tools/read-locate.tool.test.ts src/services/shared-nodes/thread-request-context-web-search.resolver.test.ts src/agent/__tests__/trace.test.ts` | 失败 |
| `pnpm --filter @ui-chat-mira/server bench:sandbox:direct` | 通过，存在未实现合同项 |
| `pnpm --filter @ui-chat-mira/server bench:context:read` | 通过 |

## 全量失败摘要

`pnpm --filter @ui-chat-mira/server test` 没有全绿，失败可分成两类。

第一类是 V1.6 主线外的仓库失败:

- `server/src/mcp/document-readers.test.ts:5` 缺少 `xlsx` 依赖，suite 无法加载。
- `server/src/mcp/resources/workspace-resource.test.ts:5` 缺少 `xlsx` 依赖，suite 无法加载。
- `server/src/mcp/tools/read-extract.tool.test.ts:5` 缺少 `xlsx` 依赖，suite 无法加载。
- `server/src/bootstrap-env.test.ts:42` 根 `.env` 引导断言失败，`LOCAL_MODEL_RAW_ROOT` 实际为 `undefined`。
- `server/src/services/thread.service.test.ts:101` 断言文案不匹配，实际错误为 `Workspace root path is invalid`。
- `server/src/services/thread.service.test.ts:523` fallback read 断言不匹配，预期附件占位文本，实际 `parts=[]`。
- `server/src/services/rag-nodes/generate.service.test.ts:45` 与 `:146` 断言未跟上 prompt 结构变化。

第二类与本次 V1.6 主线直接相关或邻接:

- `server/src/mcp/tools/terminal-session.tool.test.ts:652`
  - 预期 Windows 编码解码后 stdout 包含 `中文`
  - 实际返回 `[binary output omitted]`
- `server/src/services/shared-nodes/thread-request-context-web-search.resolver.test.ts:3`
  - 测试引用的 `thread-request-context-web-search.resolver.js` 不存在，suite 无法加载
- `server/src/mcp/tools/read-locate.tool.test.ts:26`
  - 在全量运行里出现 `5000ms` 超时
  - 但同文件在专项运行中单独通过，说明更像全量运行下的时序/资源问题，不是稳定失败

完整命令与错误摘要见 `server/test-report/v16-total-review-tests.txt`。

## 四条主线判断

### 1. Tool Exposure

判断: **通过**

证据:

- 工具候选不再被 registry 顺序提前截断:
  - `server/src/harness/tool-candidates.test.ts:125`
  - 用例名明确检查 `scores late registry tools before applying the maxTools cutoff`
- workspace local 查询不暴露 `web_search`:
  - `server/src/harness/exposure.test.ts:288`
  - `server/src/harness/exposure.test.ts:300`
  - `server/src/harness/capability-diagnostics.test.ts:375`
- 明确联网查询暴露 `web_search`:
  - `server/src/harness/exposure.test.ts:317`
  - `server/src/harness/tool-candidates.test.ts:257`
  - `server/src/routes/proxy-provider/chat-tool-surface.test.ts:42`
- `terminal_session` 按风险门禁暴露:
  - `server/src/harness/exposure.test.ts:95`
  - `server/src/harness/exposure.test.ts:117`
  - `server/src/harness/exposure.test.ts:137`
  - `server/src/harness/exposure.test.ts:154`
  - `server/src/routes/proxy-provider/chat-tool-surface.test.ts:243`
- `selectedToolIds / preferredToolId` 没有进入执行链:
  - 候选和诊断层只保留为排序或元数据:
    - `server/src/harness/capability-diagnostics.test.ts:139`
    - `server/src/harness/tool-candidates.test.ts:414`
  - 执行链防穿透在 ToolCall Loop 主线中另有专门回归用例:
    - `server/src/agent/__tests__/toolcall-loop-regression.test.ts:327`
    - `server/src/agent/__tests__/graph.test.ts:1523`

补充说明:

- Exposure 专项命令唯一失败是 `terminal-session.tool.test.ts` 的 Windows 编码断言，这属于终端运行时输出解码问题，不是 Exposure 门禁回归。

### 2. ToolCall Loop

判断: **通过**

证据:

- `use_tool -> normalize -> pendingToolCall -> policy -> tool -> evidence -> planner/generate` 闭环:
  - `server/src/agent/__tests__/tool-call-normalize.test.ts:141-149` 等价证据在文件中体现为 `pendingToolCall` 冻结
  - `server/src/agent/__tests__/policy.test.ts:186`
  - `server/src/agent/__tests__/tool-node.test.ts:35`
  - `server/src/agent/__tests__/toolcall-loop-regression.test.ts:552`
- `routeAfterTool / routeAfterRetrieve` 返回值和 graph edges 一致:
  - `server/src/agent/__tests__/graph.test.ts:1767`
  - `server/src/agent/__tests__/graph.test.ts:1797`
- `maxIterations` 稳定进入 generate:
  - `server/src/agent/__tests__/toolcall-loop-regression.test.ts:552`
  - `server/src/agent/__tests__/graph.test.ts:1690`
- invalid args / reject / approval pending 不会执行工具:
  - invalid args:
    - `server/src/agent/__tests__/toolcall-loop-regression.test.ts:368`
    - `server/src/agent/__tests__/graph.test.ts:1593`
  - policy approval pending:
    - `server/src/agent/__tests__/toolcall-loop-regression.test.ts:438`
    - `server/src/agent/__tests__/graph.test.ts:2084`
  - Harness approval pending:
    - `server/src/agent/__tests__/toolcall-loop-regression.test.ts:468`
    - `server/src/agent/__tests__/tool-node.test.ts:310`
  - reject / missing pending call:
    - `server/src/agent/__tests__/tool-node.test.ts:245`
    - `server/src/agent/__tests__/policy.test.ts:156`

专项结果:

- `ToolCall Loop` 分组命令 `7` 个文件、`97` 个测试全部通过。

### 3. Sandbox Runtime

判断: **部分通过**

通过证据:

- Sandbox direct bench 绕过 LLM / Planner / Tool Selection / read_list:
  - bench 命令直接运行 `tsx src/harness/sandbox/bench/runner.ts`
  - `server/src/harness/sandbox/index.test.ts` 全部围绕 direct contract，不依赖 agent graph
- cwd 锁 workspace:
  - `server/src/sandbox/executor.ts:95-101`
  - `server/src/harness/sandbox/index.test.ts:160`
  - `server/src/sandbox/executor.test.ts:70`
- env 白名单:
  - `server/src/harness/sandbox/index.test.ts:190`
  - `server/src/sandbox/executor.test.ts:278`
- timeout / output limit 有效:
  - `server/src/sandbox/executor.ts:147-152`
  - `server/src/sandbox/executor.ts:410-411`
  - `server/src/sandbox/executor.ts:465-468`
  - `server/src/harness/sandbox/index.test.ts:206`
  - `server/src/harness/sandbox/index.test.ts:263`
- result contract 包含 `status / exitCode / stdoutText / stderrText / durationMs / truncated / violations / artifacts`:
  - `server/src/harness/sandbox/index.test.ts:119-129`
  - `server/src/sandbox/executor.ts:541-552`
- `artifact / output / binaryDetected / encoding` 字段存在并可测:
  - `server/src/sandbox/executor.ts:233-255`
  - `server/src/sandbox/executor.ts:549-550`
  - `server/src/sandbox/executor.test.ts:337`
  - `server/src/sandbox/executor.test.ts:365`
  - `bench:sandbox:direct` 的 unicode、artifact、truncated、timed_out 用例已实跑通过

未完全通过的点:

- `bench:sandbox:direct` 明确报告合同覆盖还没补齐:
  - `read_only`: `not_implemented`
  - `workspace_write`: `not_implemented`
  - `networked_command`: `not_implemented`
- 因此 Sandbox Runtime 的 `command` profile 证据完整，但不是“全部 profile 全实现”。

### 4. Context / Evidence / Diagnostics

判断: **部分通过**

通过证据:

- Context Read Plan DSL 有 `list / open / locate / inspect`:
  - `server/src/harness/context/planner.test.ts:10`
  - `server/src/harness/context/planner.test.ts:24`
  - `server/src/harness/context/planner.test.ts:38`
  - `server/src/harness/context/planner.test.ts:55`
- Context bench 独立测试 `read_list / read_open / read_locate / encoding / budget`:
  - `pnpm --filter @ui-chat-mira/server bench:context:read` 总计 `11/11` 通过
  - `server/src/harness/context/bench/cases.test.ts:10-16`
- failed / timed_out / blocked / truncated / binaryDetected 不会被 Evidence / Generate 假装成功:
  - failed:
    - `server/src/agent/__tests__/toolcall-loop-regression.test.ts:584`
    - `server/src/agent/__tests__/toolcall-loop-regression.test.ts:621-622`
  - timed_out:
    - `server/src/agent/__tests__/toolcall-loop-regression.test.ts:662`
  - blocked / truncated / binaryDetected:
    - `server/src/harness/sandbox/index.test.ts:169`
    - `server/src/harness/sandbox/index.test.ts:273`
    - `server/src/harness/context/bench/cases.test.ts:13-16`
- diagnostics 能定位 exposure / planner / normalize / policy / runtime / evidence / generate 层:
  - exposure:
    - `server/src/harness/capability-diagnostics.test.ts:306`
  - planner:
    - `server/src/harness/context/planner.test.ts:86`
  - normalize / policy / runtime / evidence / generate:
    - `server/src/agent/__tests__/graph.test.ts:1523`
    - `server/src/agent/__tests__/graph.test.ts:1593`
    - `server/src/agent/__tests__/graph.test.ts:2084`
    - `server/src/agent/__tests__/trace.test.ts:13-29`

未完全通过的点:

- `server/src/services/shared-nodes/thread-request-context-web-search.resolver.test.ts:3` 无法加载目标模块:
  - 当前 `server/src/services/shared-nodes/` 下只有该测试文件，没有对应实现文件
  - 这意味着“请求上下文里的 web_search 解析器”这条诊断链路，本地仓库当前状态下没有完成可执行验证

## 已通过项

- 后端 TypeScript 类型检查通过:
  - `server/test-report/v16-total-review-typecheck.txt`
- Tool Exposure 主线专项通过，覆盖 registry 排序、workspace local 屏蔽 `web_search`、显式联网暴露 `web_search`、`terminal_session` 风险门禁、`selectedToolIds/preferredToolId` 不进入执行链。
- ToolCall Loop 主线专项通过:
  - `server/src/agent/__tests__/toolcall-loop-regression.test.ts`
  - `server/src/agent/__tests__/graph.test.ts`
  - `server/src/agent/__tests__/tool-call-normalize.test.ts`
  - `server/src/agent/__tests__/policy.test.ts`
  - `server/src/agent/__tests__/tool-node.test.ts`
  - `server/src/routes/proxy-provider/chat-tool-loop.test.ts`
- Sandbox Runtime 的 `command` profile 直跑合同通过，含 cwd 锁定、超时、输出截断、artifact 注册、编码/二进制检测字段。
- Context Read DSL 和 context bench 通过，`list/open/locate/inspect`、编码、budget 行为有直接 bench 结果。

## 失败项

- 全量 `vitest` 未通过:
  - 见 `server/test-report/v16-total-review-tests.txt`
- 与 V1.6 主线直接相关的本地失败:
  - `server/src/mcp/tools/terminal-session.tool.test.ts:652`
    - Windows 终端输出编码断言失败
  - `server/src/services/shared-nodes/thread-request-context-web-search.resolver.test.ts:3`
    - 目标 resolver 模块不存在，suite 无法加载

## 未覆盖项

- Sandbox contract 的非 `command` profile 没有完整实现:
  - `read_only`
  - `workspace_write`
  - `networked_command`
- `thread-request-context-web-search.resolver` 对应实现不在仓库中，无法完成这一支本地单测覆盖。
- 全量运行下 `read_locate` 有一次超时，但单独专项通过，当前只能认定“全量场景稳定性待补证”，不能算已完全覆盖。

## 需要人工线上评审的项

- `web_search` 的真实联网调用链是否在线上评审环境中按预期返回，并且审批提示、provider 行为与本地 mock 一致。
- `terminal_session` 在真实 Windows 线上环境里的编码路径，尤其是中文输出被误判为 binary 的情况。
- 缺失的 `thread-request-context-web-search.resolver` 是文件漏提、命名迁移未同步，还是设计上已经废弃但测试未清理，需要线上评审线程确认影响面。
- Sandbox 非 `command` profile 是否在 V1.6 范围内应当视为明确缺陷，还是后续任务项；本地 bench 已经给出未实现证据，但是否阻塞上线需要评审裁定。

## 结论

本地仓库当前状态下，V1.6 四条主线不是“全部无条件通过”。

- `Tool Exposure`: 通过
- `ToolCall Loop`: 通过
- `Sandbox Runtime`: 部分通过，`command` profile 合同成立，但其他 profile 仍有未实现项
- `Context / Evidence / Diagnostics`: 部分通过，context read bench 通过，但 web-search request-context resolver 无法加载，未形成闭环覆盖

因此，本次本地总测试更适合作为“带缺口的上线前评审包”，不是全绿放行结论。
