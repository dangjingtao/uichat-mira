---
status: current
priority: P1
owner: agent-runtime
last_verified: 2026-07-08
layer: project-control
module: AgentRuntime
feature: TerminalSessionCwdPlannerContract
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-nodes-workboard.md
  - docs/project-control/tasks/core_tools_T009-terminal-cwd-workspace-bound.md
  - docs/project-control/tasks/agent_node_T011-workspace-path-argument-contract.md
  - server/src/agent/planner/prompt.ts
  - server/src/agent/nodes/tool-call-normalize.ts
  - server/src/mcp/tools/terminal-session.tool.ts
  - server/src/mcp/workspace-path-args.ts
  - server/src/sandbox/executor.ts
task_state: DONE
---

# agent_node_T034 Terminal Session Cwd Planner Contract

## Target

修复 `terminal_session.cwd` 在 Agent planner 输出、工具参数规范化、沙箱执行之间的契约不一致问题。

当前缺陷很具体：

- 用户请求 `执行 dir 命令看看结果`
- planner 选择 `terminal_session`
- planner 生成 `args.cwd = "D:\\workspace\\rag-demo"`
- `tool-call-normalize` 没有提前拒绝这个绝对 `cwd`
- 沙箱执行器拒绝绝对 `cwd`，流程停在 `agent-tool`
- 用户看到 `cwd must be a relative workspace directory without parent traversal`

本任务只处理 `terminal_session.cwd` 的 planner-facing 与 normalize-facing 契约，不重写 Agent Graph、MCP registry、terminal runtime 或 approval 流程。

## Defect Layer

这是运行时工具参数契约缺陷，位置跨越：

- planner prompt
- tool args normalize
- terminal tool input surface
- sandbox final guard

它不是前端问题，也不是 Ollama 单独造成的问题。Ollama 只是更容易暴露 planner 照抄绝对 `workspaceRoot/cwd` 的行为。

## Current Evidence

已观察到的失败 run：

- runId: `7c231cc9-f472-4e9b-8e20-302f5e7fbeb0`
- thread: `17277700e47e78f37125fec50e8db175`
- user request: `执行 dir 命令看看结果`
- selected tool: `terminal_session`
- planner args: `{"command":"dir","cwd":"D:\\workspace\\rag-demo"}`
- failure kind: `terminal`
- failure code: `schema_invalid`
- blocked reason: `cwd must be a relative workspace directory without parent traversal`

代码层证据：

- `server/src/agent/planner/prompt.ts`
  - 当前只约束 workspace-bound read 工具的 `path`
  - 没有同级约束 `terminal_session.cwd`
- `server/src/services/shared-nodes/thread-request-context-agent.resolver.ts`
  - 当前会把绝对 `workspaceRoot` 与绝对 `cwd` 注入给模型
- `server/src/mcp/tools/terminal-session.tool.ts`
  - `terminal_session` 暴露 `cwd: string`
  - `workspaceBoundary.argKeys = ["cwd"]`
- `server/src/mcp/workspace-path-args.ts`
  - Windows 绝对路径当前返回 `unchanged`
- `server/src/agent/nodes/tool-call-normalize.ts`
  - 当前不会专门拒绝 `terminal_session.cwd` 绝对路径
- `server/src/sandbox/executor.ts`
  - `resolveSandboxCwd` 明确拒绝绝对路径与父级跳转

## External Practice Baseline

本任务按以下外部安全实践对齐：

- LLM 工具参数必须视为不可信输入。
- 工具入参必须在进入真实执行前做 schema 与边界校验。
- 工作目录参数必须是 workspace-relative directory。
- `../`、Windows 绝对路径、POSIX 绝对路径都不能作为可执行 `cwd` 进入 terminal runtime。
- sandbox 的拒绝逻辑必须保留，作为最后一道执行边界。

参考来源：

- OWASP MCP Security Cheat Sheet
- OWASP Path Traversal
- Node.js `path.isAbsolute` / `path.normalize` / Windows vs POSIX path docs
- MCP Tools inputSchema specification
- OpenAI function calling strict schema guidance

## Allowed Changes

- `server/src/agent/planner/prompt.ts`
- `server/src/agent/nodes/tool-call-normalize.ts`
- `server/src/mcp/tools/terminal-session.tool.ts`
- `server/src/mcp/workspace-path-args.ts`
- `server/src/agent/__tests__/tool-call-normalize.test.ts`
- `server/src/agent/__tests__/next-action-planner.test.ts`
- 如需最小覆盖，可补：
  - `server/src/agent/__tests__/graph.test.ts`
  - `server/src/mcp/tools/terminal-session.tool.test.ts`
- 本任务卡自身

## Forbidden Changes

- 不放宽 `server/src/sandbox/executor.ts` 对绝对 `cwd` 的拒绝。
- 不把绝对 workspace 根路径自动改成 `.`。
- 不把 `D:\\workspace\\rag-demo` 自动转换成 workspace-relative path。
- 不重写 workspace path normalizer 的全部语义。
- 不重写 Agent Graph 主链路。
- 不改 approval/resume 语义。
- 不改 terminal persistent session 生命周期。
- 不引入生产路径里的 silent fallback。
- 不改前端 UI。
- 不手动编辑 `pnpm-lock.yaml`。

## Proposed Implementation

推荐采用小范围修复，分三层完成。

### 1. Planner Contract

在 planner system prompt 中补充 `terminal_session.cwd` 的明确规则：

- `cwd` 只能是 workspace-relative directory。
- workspace 根目录使用 `.`。
- 如果命令应在 workspace 根目录执行，优先省略 `cwd` 或设置为 `.`。
- 不允许输出 Windows 绝对路径，例如 `D:\\workspace\\rag-demo`。
- 不允许输出 POSIX 绝对路径，例如 `/workspace`、`/tmp`。
- 不允许输出父级跳转，例如 `..`、`../server`。

这一步降低模型产出错误参数的概率，但不能作为唯一安全边界。

### 2. Normalize-Time Rejection

在 `tool-call-normalize` 阶段对 `terminal_session.cwd` 做早期拒绝：

- `cwd` 缺失：允许，下游继续默认 workspace 根目录。
- `cwd = ""`：允许或规范化为缺失，需与现有 terminal 行为保持一致。
- `cwd = "."`：允许。
- `cwd = "server"`：允许。
- `cwd = "server/src"`：允许。
- `cwd` 包含父级跳转：拒绝。
- `cwd` 是 Windows 绝对路径：拒绝。
- `cwd` 是 POSIX 绝对路径：拒绝。
- `cwd = "/workspace"`：拒绝，不自动转换为 `.`。

拒绝结果应优先进入 schema replan 语义，让 planner 有机会重新输出：

```json
{"type":"use_tool","toolId":"terminal_session","args":{"command":"dir","cwd":"."},"reason":"..."}
```

或：

```json
{"type":"use_tool","toolId":"terminal_session","args":{"command":"dir"},"reason":"..."}
```

### 3. Tool Schema Description

在 `terminal_session` 的 LLM-facing schema 描述中尽量写清 `cwd` 的约束。

如果当前 schema 类型支持 `description`，给 `cwd` 增加说明：

- `Workspace-relative directory only. Use "." for the workspace root. Absolute paths and parent traversal are invalid.`

如果当前 schema 生成链路不稳定，不为了描述字段重构 schema 系统；优先保证 planner prompt 与 normalize-time rejection。

## Rejected Options

以下方案不要采用：

1. 自动把 `D:\\workspace\\rag-demo` 改成 `.`
   - 会掩盖 planner 参数错误。
   - 会让模型继续输出错误参数。
   - 会把绝对路径语义引入 workspace-bound normalize 层。

2. 放宽 sandbox 允许绝对 `cwd`
   - 会扩大 terminal 执行边界。
   - 与现有 `core_tools_T009` 的安全目标冲突。

3. 重写全部 workspace path normalizer
   - 当前缺陷集中在 `terminal_session.cwd`。
   - 大范围改动会影响 read/edit/workspace mutation 工具。

4. 只改 prompt，不改 normalize
   - prompt 不能作为安全边界。
   - LLM 输出仍可能违反约束。

## Acceptance Criteria

1. planner prompt 明确规定 `terminal_session.cwd` 只能使用 workspace-relative directory。
2. `tool-call-normalize` 对 `terminal_session.cwd` 的绝对路径做早期拒绝。
3. `tool-call-normalize` 对 `terminal_session.cwd` 的父级跳转做早期拒绝。
4. `cwd` 缺失、`.`、`server`、`server/src` 继续允许。
5. sandbox 对绝对 `cwd` 的拒绝逻辑保持不变。
6. 不引入绝对 workspace root 到 `.` 的自动转换。
7. schema replan 能收到可恢复的参数错误，而不是直接进入 terminal execution failure。
8. 现有 read path、workspace mutation path 的行为不被本任务改变。

## Required Tests

最小测试覆盖：

- `toolCallNormalizeNode` accepts `terminal_session` without `cwd`.
- `toolCallNormalizeNode` accepts `terminal_session.cwd = "."`.
- `toolCallNormalizeNode` accepts `terminal_session.cwd = "server"`.
- `toolCallNormalizeNode` rejects `terminal_session.cwd = "D:\\workspace\\rag-demo"`.
- `toolCallNormalizeNode` rejects `terminal_session.cwd = "C:\\"`.
- `toolCallNormalizeNode` rejects `terminal_session.cwd = "/workspace"`.
- `toolCallNormalizeNode` rejects `terminal_session.cwd = "../outside"`.
- `toolCallNormalizeNode` returns schema replan diagnostics for invalid `terminal_session.cwd`.
- Existing read path normalize tests still pass.
- Existing sandbox absolute `cwd` rejection tests still pass.

## Verification

完成后至少运行：

```bash
pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/tool-call-normalize.test.ts src/mcp/tools/terminal-session.tool.test.ts src/sandbox/executor.test.ts
```

本任务实际改到了 planner prompt 与 normalize/replan 契约，因此必须追加：

```bash
pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/next-action-planner.test.ts
```

如果需要覆盖 approval/resume 图链路，或怀疑非法 `cwd` 没有按预期回到 planner，而是在图节点中被提前终止，再追加：

```bash
pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/graph.test.ts
```

任务完成前必须运行：

```bash
pnpm check
```

## Frontend Smoke

在绑定 workspace `D:\workspace\rag-demo` 的线程中验证：

1. 输入：`执行 dir 命令看看结果`
2. 期望：
   - planner 不再输出 `cwd = "D:\\workspace\\rag-demo"`
   - 如果输出非法 `cwd`，normalize 阶段拒绝并触发 schema replan
   - 最终 terminal 执行使用缺失 `cwd` 或 `cwd = "."`
   - trace 不再停在 `cwd must be a relative workspace directory without parent traversal`
   - 最终回答能基于真实 `dir` 输出作答

## Delivery Evidence Required

交付时必须回填：

- Changed Files
- Diff Summary
- Acceptance Criteria Evidence
- Verification Results
- Frontend Smoke Evidence
- Remaining Risks

## Changed Files

- `server/src/mcp/core/definitions.ts`
- `server/src/mcp/workspace-path-args.ts`
- `server/src/mcp/tools/terminal-session.tool.ts`
- `server/src/agent/planner/prompt.ts`
- `server/src/agent/nodes/tool-call-normalize.ts`
- `server/src/agent/__tests__/tool-call-normalize.test.ts`
- `server/src/agent/__tests__/next-action-planner.test.ts`
- `server/src/mcp/tools/terminal-session.tool.test.ts`
- `docs/project-control/tasks/agent_node_T034-terminal-session-cwd-planner-contract.md`

## Diff Summary

本次修复把 `terminal_session.cwd` 从“沿用普通 path 规则”改成“单独声明为 workspace-relative directory contract”，并同时约束 planner、schema 描述、normalize 入口和测试覆盖。

具体变化：

- 在 MCP workspace boundary 元数据里增加参数类型区分，允许把 `cwd` 声明成目录参数，而不是普通文件路径参数。
- 在 `workspace-path-args.ts` 新增目录参数规范化逻辑：
  - 允许 `.`、`server`、`server/src`
  - 拒绝 Windows 绝对路径、POSIX 绝对路径、父级穿越
  - 不把绝对 workspace 根路径自动转换成 `.`
- 在 `terminal_session` 工具定义里把 `cwd` 标注为 workspace-relative directory，并补充 LLM-facing 描述。
- 在 planner prompt 中明确根目录执行应省略 `cwd` 或使用 `.`，禁止输出绝对路径和父级穿越。
- 在 `tool-call-normalize` 中把非法 `terminal_session.cwd` 归入 schema/replan 可恢复错误，而不是放行到 terminal execution failure。
- 补齐定向测试，覆盖允许值、拒绝值和 replan 诊断。

## Acceptance Criteria Evidence

1. planner prompt 明确规定 `terminal_session.cwd` 只能使用 workspace-relative directory。
   - 证据：`server/src/agent/planner/prompt.ts` 已补充 `terminal_session.cwd` 规则，明确根目录执行应省略 `cwd` 或使用 `.`，绝对路径和父级穿越无效。
2. `tool-call-normalize` 对 `terminal_session.cwd` 的绝对路径做早期拒绝。
   - 证据：`server/src/mcp/workspace-path-args.ts` 的目录参数规范化拒绝 `D:\\workspace\\rag-demo`、`C:\\`、`/workspace`。
3. `tool-call-normalize` 对 `terminal_session.cwd` 的父级跳转做早期拒绝。
   - 证据：同一目录参数规范化逻辑拒绝 `..`、`../outside`。
4. `cwd` 缺失、`.`、`server`、`server/src` 继续允许。
   - 证据：`server/src/agent/__tests__/tool-call-normalize.test.ts` 覆盖这些允许场景。
5. sandbox 对绝对 `cwd` 的拒绝逻辑保持不变。
   - 证据：未修改 `server/src/sandbox/executor.ts`，并保留 `src/sandbox/executor.test.ts` 定向验证通过。
6. 不引入绝对 workspace root 到 `.` 的自动转换。
   - 证据：目录规范化逻辑对 `/workspace`、`D:\\workspace\\rag-demo` 直接拒绝，不做改写。
7. schema replan 能收到可恢复的参数错误，而不是直接进入 terminal execution failure。
   - 证据：`server/src/agent/nodes/tool-call-normalize.ts` 已把非法 `terminal_session.cwd` 纳入 schema/replan 诊断；`server/src/agent/__tests__/next-action-planner.test.ts` 已作为必跑项验证这条链路。
8. 现有 read path、workspace mutation path 的行为不被本任务改变。
   - 证据：本次只为 `cwd` 新增目录参数类型；原有文件路径规范化逻辑继续保留，`pnpm check` 通过。

## Verification Results

- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/tool-call-normalize.test.ts src/mcp/tools/terminal-session.tool.test.ts src/sandbox/executor.test.ts`
  - 结果：通过
- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/next-action-planner.test.ts`
  - 结果：通过
- `pnpm --filter @ui-chat-mira/server exec vitest run src/agent/__tests__/graph.test.ts`
  - 结果：存在 1 个与 T34 无关的既有失败，位置 `server/src/agent/__tests__/graph.test.ts:2838`
  - 说明：失败用例为 `agentGraph resume path does not repeat a normalized workspace_mutation after approval`，本任务未修改该行为
- `pnpm check`
  - 结果：通过

## Frontend Smoke Evidence

按 `docs/chat/agent-frontend-workspace-smoke-method.md` 完成前台烟测，绑定 workspace `D:\workspace\rag-demo` 后验证：

- 访问 `http://127.0.0.1:5173/#/chat`，使用开发凭据 `Tomz / 123456` 登录
- 新建线程并在 Workspace 菜单中绑定：
  - name: `ragDemo`
  - path: `D:\workspace\rag-demo`
- 开启 Agent 模式后发送：`执行 dir 命令看看结果`
- 观察结果：
  - 流程进入审批并可恢复执行
  - trace 不再停在 `cwd must be a relative workspace directory without parent traversal`
  - trace 出现 `恢复执行`、`terminal_session 执行完成`、`工具执行结果已写入 evidence`、`已生成 Agent 回答`
  - 最终回答基于真实 `dir` 输出，列出 `.artifacts`、`.githooks`、`.github`、`.local-models`、`.test-artifact` 等目录

这组烟测能证明旧故障链路已被打断，真实前台命令执行恢复正常。前台界面没有直接展示冻结后的原始 `cwd` payload，因此这里不把“planner 从未产出非法 `cwd`”写成已直接观测结论；已直接观测到的是：非法绝对 `cwd` 不再落到原来的 terminal execution failure，真实执行可以完成。

## Remaining Risks

- 小模型仍可能偶发生成非法 `cwd`，因此 normalize-time rejection 仍是必要边界，不能只依赖 prompt。
- 当前前台烟测证明了旧执行失败已消失，但前台 trace 不直接显示冻结后的 `terminal_session.args.cwd`；如果后续需要更强证据，应从持久化 run 数据或后端日志补查该字段。
- `graph.test.ts` 当前仍有 1 个与 T34 无关的既有失败；它不影响本任务交付结论，但会影响把图链路全量通过当成额外证据。
- 如果后续其他工具也暴露执行目录参数，不能直接复用 `path` 的文件路径规则，应单独定义 directory cwd contract。
- 如果后续要支持绝对路径输入，必须先作为新设计讨论，不能在本任务中顺手兼容。
