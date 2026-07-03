---
status: current
priority: P1
owner: agent-remediation
last_verified: 2026-07-02
layer: project-control
module: ProjectControl
feature: HarnessSchemaBoundary
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-workboard.md
  - docs/chat/agent-phase-1-global-review.md
  - docs/chat/agent-phase-1-code-review.md
task_state: DONE
---

# T-006 Harness Schema And Boundary

## Target

补强 Harness 输入契约与 workspace boundary 校验，使高风险工具不再仅依赖局部约定。

问题本体：

- 当前 Harness 更像对象形状检查 + 工具执行转发
- 不是严格的参数契约层
- 对 `workspaceBound` 工具的边界判断仍偏弱，尤其对高风险路径不够强

## Allowed Changes

- Harness invocation、permission、definition contract 相关实现
- 高风险工具输入 schema 与 boundary key 相关测试
- 与该任务直接相关的当前文档更新

## Forbidden Changes

- 未经确认扩大到全量工具重写
- 用静默兼容逻辑替代明确 schema / boundary 约束
- 把该任务扩大成终端能力整体重做

## Acceptance Criteria

1. 高风险工具具备明确 schema 校验或等价参数契约
2. `workspaceBound` 工具的 boundary key 明确建模
3. 不能继续只依赖零散 `args.path / args.cwd` 约定支撑整体边界
4. 台账回填：
   - 对应 `GR-P1-2`
   - 对应原始评审点 `R16` `R17` `R18` `R19`

## Verification

- 由具体执行任务补充命令和结果

## Implementation Notes

- 在 `server/src/mcp/core/invocations.ts` 增加统一 `inputSchema` 执行前校验，拒绝不满足 definition contract 的调用参数
- 在 `server/src/mcp/core/definitions.ts` 为 `workspaceBound` 工具补充 `workspaceBoundary.argKeys` definition contract
- 在 `server/src/mcp/core/permissions.ts` 改为基于 tool definition 的 boundary key 做 workspace 越界判断，不再依赖散落的 `args.path / args.cwd` 猜测逻辑
- 为以下工具显式建模 boundary key：
  - `terminal_session` -> `cwd`
  - `edit_file` -> `path`
  - `workspace_mutation` -> `targetPath`, `destinationPath`
  - `read_open` / `read` / `read_list` / `read_locate` / `read_extract` -> `path`
- 清理错误的 workspace 标记：`read_slice` 不再标记为 `workspaceBound`

## Changed Files

- `server/src/mcp/core/definitions.ts`
- `server/src/mcp/core/invocations.ts`
- `server/src/mcp/core/permissions.ts`
- `server/src/mcp/core/schema.ts`
- `server/src/mcp/core/schema.test.ts`
- `server/src/mcp/core/invocations.test.ts`
- `server/src/mcp/tools/terminal-session.tool.ts`
- `server/src/mcp/tools/terminal-session.tool.test.ts`
- `server/src/mcp/tools/edit-file.tool.ts`
- `server/src/mcp/tools/workspace-mutation.tool.ts`
- `server/src/mcp/tools/workspace-mutation.tool.test.ts`
- `server/src/mcp/tools/read-open.tool.ts`
- `server/src/mcp/tools/read-list.tool.ts`
- `server/src/mcp/tools/read-locate.tool.ts`
- `server/src/mcp/tools/read-extract.tool.ts`
- `server/src/mcp/tools/read-slice.tool.ts`
- `server/src/mcp/tools/read.tool.ts`

## Evidence

### Acceptance Criteria 1

- 高风险工具已具备统一 schema 校验入口：
  - `server/src/mcp/core/invocations.ts`
  - `server/src/mcp/core/schema.ts`
- 高风险 `terminal_session` 和写工具 `edit_file` 继续声明明确 `inputSchema`
- 新增测试覆盖 schema contract：
  - `server/src/mcp/core/schema.test.ts`
  - `server/src/mcp/core/invocations.test.ts`

### Acceptance Criteria 2

- `workspaceBound` 工具已显式声明 boundary key：
- `terminal_session` -> `cwd`
- `edit_file` -> `path`
- `workspace_mutation` -> `targetPath`, `destinationPath`
- `read_open` / `read` / `read_list` / `read_locate` / `read_extract` -> `path`

### Acceptance Criteria 3

- `server/src/mcp/core/permissions.ts` 已删除基于 `args.path / args.cwd` 的通用猜测入口
- workspace boundary 改为读取 `definition.capabilities.workspaceBoundary.argKeys`
- `read_slice` 已去掉错误的 `workspaceBound` 标记，避免伪边界继续混淆

### Acceptance Criteria 4

- 本任务直接对应：
  - `GR-P1-2`
  - `R16`
  - `R17`
  - `R18`
  - `R19`

## Verification Results

### Directly Affected Scope

- `pnpm --filter @ui-chat-mira/server test -- src/mcp/core/invocations.test.ts src/mcp/core/schema.test.ts src/mcp/tools/terminal-session.tool.test.ts src/mcp/tools/read-open.tool.test.ts src/mcp/tools/read-list.tool.test.ts src/mcp/tools/read.tool.test.ts src/mcp/tools/read-locate.tool.test.ts src/mcp/tools/edit-file.tool.test.ts`
- Result: pass (`8` files, `43` tests)
- `pnpm --filter @ui-chat-mira/server test -- src/mcp/tools/workspace-mutation.tool.test.ts src/mcp/core/invocations.test.ts src/mcp/core/schema.test.ts`
- Result: pass (`3` files, `18` tests)

### Workspace Typecheck

- `pnpm check`
- Result: pass

### Direct Manual Verification

- `2026-07-02` 通过真实 MCP 路由 `POST /mcp/invocations` 手测：
  - `workspace_mutation` 缺少 `targetPath`
    - 结果：`400 VALIDATION_ERROR`
    - 证据：返回 `args.targetPath is required`
  - `workspace_mutation` 目标路径越出当前 workspace
    - 结果：进入 `awaiting_approval`
    - 证据：approval reason 明确为 `outside the current workspace root`
  - `workspace_mutation` 工作区内合法目标
    - 结果：进入正常审批
    - 证据：approval reason 为 `requires explicit approval before execution`
- 结论：schema 校验与 workspace boundary 校验均已在真实接口层生效

### Packaging

- `pnpm package:electron:win`
- Result: pass
- Release output verified at `release/v0.7.1_20260630_042436`

### Packaged Build Health Check

- `curl http://127.0.0.1:8787/health`
- Result: pass
- Response evidence: returned healthy JSON payload from backend health endpoint

## Additional Verification Context

- `pnpm --filter @ui-chat-mira/server test`
- Result: fail, but observed failures are not introduced by T-006 and include:
  - missing local test dependency/module resolution for `xlsx`
  - missing `server/src/mcp/harness/sandbox.ts` target for existing test import
  - pre-existing agent / thread / rag / workspace related test failures outside T-006 scope

## Risks / Unfinished Items

- 未扩展到全量工具 schema 深校验，只覆盖当前任务直接相关的 Harness 通用 contract 和已标记 `workspaceBound` 的核心工具
- `inputSchema` 当前实现的是项目内已使用 schema 子集的统一校验，不是完整 JSON Schema 引擎
- 仓库仍存在与 T-006 无关的全量 `server` 测试失败，已单独记录，不能算作本任务回归
