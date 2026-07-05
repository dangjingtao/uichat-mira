# UIChat Mira V1.6 本地总测试评审摘要

## 基线信息

- 当前 commit hash: `e6f905c09c1e8ea054ad01410dd9014d275ddd18`
- 取证日期: `2026-07-06`
- 起跑前 `git status --short`: 干净
- 本次只更新以下报告文件:
  - `server/test-report/v16-total-review-summary.md`
  - `server/test-report/v16-total-review-typecheck.txt`
  - `server/test-report/v16-total-review-tests.txt`

## 指定命令结果

| 命令 | 结果 | 备注 |
| --- | --- | --- |
| `pnpm --filter @ui-chat-mira/server typecheck` | 失败 | 命令链异常退出，`ERR_PNPM_RECURSIVE_RUN_FIRST_FAIL`，exit `3221225477` |
| `pnpm --filter @ui-chat-mira/server test` | 失败 | 全量 `vitest` 仍有失败 |
| `Tool Exposure` 专项 | 通过 | `6` 个文件、`97` 个测试通过 |
| `ToolCall Loop` 专项 | 通过 | `7` 个文件、`97` 个测试通过 |
| `Sandbox` 专项 | 通过 | `3` 个文件、`36` 个测试通过 |
| `Context / Evidence / Diagnostics` 专项 | 通过 | 当前真实 request context 主链相关的 `8` 个文件、`49` 个测试通过；废弃 web-search resolver 不再纳入该链路 |
| `pnpm --filter @ui-chat-mira/server bench:sandbox:direct` | 通过 | V1.6 gate `command` profile 通过，另有 `3` 个 future profile |
| `pnpm --filter @ui-chat-mira/server bench:context:read` | 通过 | `11/11` 通过 |

## 已通过项

- `Tool Exposure` 专项通过。
  - `src/harness/exposure.test.ts`
  - `src/harness/tool-candidates.test.ts`
  - `src/harness/capability-diagnostics.test.ts`
  - `src/mcp/tools/web-search.tool.test.ts`
  - `src/mcp/tools/terminal-session.tool.test.ts`
  - `src/routes/proxy-provider/chat-tool-surface.test.ts`
- `ToolCall Loop` 专项通过。
  - `src/agent/__tests__/toolcall-loop-regression.test.ts`
  - `src/agent/__tests__/tool-call-normalize.test.ts`
  - `src/agent/__tests__/tool-node.test.ts`
  - `src/agent/__tests__/policy.test.ts`
  - `src/agent/__tests__/graph.test.ts`
  - `src/agent/__tests__/routes.test.ts`
  - `src/routes/proxy-provider/chat-tool-loop.test.ts`
- `Sandbox` 专项通过。
  - `src/sandbox/executor.test.ts`
  - `src/harness/sandbox.test.ts`
  - `src/harness/sandbox/index.test.ts`
- `bench:sandbox:direct` 通过了 V1.6 gate 内的 `command` profile。
  - unicode 输出、非零退出、cwd 越界阻断、timeout、输出截断、artifact 注册都有直接证据
- `bench:context:read` 全量通过。
  - `11/11` 通过
  - 覆盖 `read_list`、`read_open`、`read_slice`、`locate->open`、`list->open`、`inspect`
  - 覆盖 UTF-8 BOM、GBK uncertain decode、binaryDetected、budget clipping

## 失败项

- 指定的 `pnpm --filter @ui-chat-mira/server typecheck` 没有通过。
  - 这是命令链异常退出，不是这次证据里直接观察到的 TypeScript 诊断列表
  - 诊断复跑 `D:\workspace\rag-demo\server` 下的 `pnpm typecheck` 通过
- 全量 `pnpm --filter @ui-chat-mira/server test` 没有通过。
  - 缺少依赖 `xlsx`
    - `src/mcp/document-readers.test.ts`
    - `src/mcp/resources/workspace-resource.test.ts`
    - `src/mcp/tools/read-extract.tool.test.ts`
  - 断言不匹配
    - `src/bootstrap-env.test.ts`
    - `src/services/thread.service.test.ts`
    - `src/services/rag-nodes/generate.service.test.ts`
  - 全量场景下的超时失败
    - `src/agent/__tests__/routes.test.ts` 3 个测试超时
    - `src/routes/role/roles.routes.test.ts` 1 个测试超时

## 当前 request context 覆盖说明

- 废弃链路已移除。
  - `thread-request-context-web-search.resolver` 不再属于当前 request context 设计，也不应再作为覆盖缺口统计。
- 当前真实主链只包含 4 个 resolver。
  - `role`
  - `summary`
  - `memory`
  - `agent`
- 当前已覆盖的真实链路文件：
  - `src/services/shared-nodes/thread-request-context-role.resolver.ts`
  - `src/services/shared-nodes/thread-request-context-summary.resolver.ts`
  - `src/services/shared-nodes/thread-request-context-memory.resolver.ts`
  - `src/services/shared-nodes/thread-request-context-agent.resolver.ts`
  - `src/services/shared-nodes/thread-request-context.node.ts`
  - 消费链路：`src/routes/proxy-provider/chat.routes.ts`
  - 消费链路：`src/services/rag-graph.ts`
  - 消费链路：`src/services/rag-nodes/generate.service.ts`
- 不再属于当前设计的 web_search request-context 能力：
  - 不再通过线程 request context resolver 预注入 web_search 提示
  - 不再把 web_search 当成 `requestContextMessages` 的一部分
  - web_search 现在属于独立工具能力，不属于 `role -> summary -> memory -> agent` 主链
- `Sandbox` 非 V1.6 gate 的 3 个 profile 没有进入本次通过面。
  - `read_only`
  - `workspace_write`
  - `networked_command`

## `not_implemented` 现状

- 仍然存在 `not_implemented`。
  - 仓库源码里仍有该状态字面量:
    - `server/src/harness/sandbox/index.ts`
    - `server/src/harness/sandbox/index.test.ts`
    - `server/src/harness/sandbox/contract.ts`
- 但这次 `bench:sandbox:direct` 的实际输出不再把 3 个非 gate profile 报成 `not_implemented`。
  - 本次 bench 输出把它们报成 `future_profile`
  - 所以不能沿用旧报告里“bench 仍输出 not_implemented”的结论

## 是否全量 test 通过

- 没有。
- `pnpm --filter @ui-chat-mira/server test` 失败，不能写成“全量 test 通过”。

## 结论

这次总测试不能给出“全量通过”结论。

- 已通过:
  - Tool Exposure 专项
  - ToolCall Loop 专项
  - Sandbox 专项
  - `bench:sandbox:direct`
  - `bench:context:read`
- request context:
  - 废弃的 `thread-request-context-web-search.resolver` 已移除，不再记作 coverage gap
  - 当前真实主链覆盖已落在 `role / summary / memory / agent` 及其 chat、RAG、agent 消费链路
- 失败:
  - 指定 `typecheck` 命令失败
  - 全量 `test` 失败
- `not_implemented`:
  - 源码中仍然存在
  - 但本次 sandbox bench 输出层面已切到 `future_profile`
