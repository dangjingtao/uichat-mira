# Task 02 Harness Invocation Boundary Blackbox Review

## Review Scope

- Current HEAD: `99095bc4032c239e876b6ce6af4d98e26538a643`
- Task target: Harness / MCP invocation public-entry blackbox regression
- Runtime modified: `No`

## Change File List

- `server/src/mcp/core/invocations.blackbox.test.ts`
- `server/test-report/harness-blackbox-summary.md`
- `server/test-report/harness-blackbox-vitest.txt`
- `server/test-report/harness-blackbox-typecheck.txt`

## Test File Paths

- Blackbox test: `server/src/mcp/core/invocations.blackbox.test.ts`
- Test result log: `server/test-report/harness-blackbox-vitest.txt`
- Typecheck result log: `server/test-report/harness-blackbox-typecheck.txt`

## Harness / MCP Invocation Public Entry Test Explanation

This blackbox suite only exercises public-facing invocation entry and observable outputs:

- Entry: `executeHarnessInvocation(...)`
- Observable events: `listHarnessInvocationEvents(invocationId)`
- Observable trace: `getHarnessInvocationTrace(invocationId)`
- Observable result record: returned `McpInvocationRecord`

The suite does not call internal approval helpers or workspace-boundary helpers directly. It verifies the end-to-end public chain required by Task 02:

`tool registry -> executeHarnessInvocation -> policy / approval -> execution -> event / trace / result`

## H1-H8 Coverage Matrix

| Case | Test name | What is asserted |
| --- | --- | --- |
| H1 | `H1 blocks unapproved high-risk tools before execute` | `requiresApproval=true` and high-risk `local-write` tool returns `awaiting_approval`; `execute` is not called; approval reason is explicit |
| H2 | `H2 executes only after exact toolId + inputHash approval` | `approvedInvocations` carries exact `toolId + inputHash`; result is `completed`; `execute` called once |
| H3 | `H3 does not reuse approval when the args hash changes` | same `toolId`, changed args, old hash supplied; result is `awaiting_approval`; `execute` not called |
| H4 | `H4 uses workspaceBoundary.argKeys as the only workspace boundary source` | `workspaceBoundary.argKeys=["targetPath"]`; `targetPath="../outside.txt"` triggers approval; reason names `targetPath`; `cwd` is not treated as an implicit boundary key |
| H5 | `H5 allows Windows root-relative slash paths inside the workspace root` | workspace root is `D:\CODEX_TEST_FOLDER_ALT`; `targetPath="/ONLY_ALT_WORKSPACE.txt"` is not misclassified outside workspace; invocation completes |
| H6 | `H6 blocks external path %s` | external targets `D:\outside.txt`, `C:\outside.txt`, `\\server\share\file.txt`, `../outside.txt`, `..\outside.txt` all return `awaiting_approval`; `execute` not called |
| H7 | `H7 exposes invocation events, artifacts, result and trace records` | record contains result/artifact; events include observable invocation lifecycle; trace is readable |
| H8 | `H8 rejects capabilityId-style invocation when no concrete tool is registered under that id` | `executeHarnessInvocation({ toolId: "workspace_lookup" })` throws `Tool not found`; no execution occurs |

## exact inputHash Approval Test

- Test: `H2 executes only after exact toolId + inputHash approval`
- Tool shape: high-risk `process` tool with `requiresApproval=true`
- Approved input:
  - `toolId: "blackbox_approved_process"`
  - `args: { command: "git status" }`
  - `approvedInvocations: [{ toolId: "blackbox_approved_process", inputHash: createInvocationInputHash(args) }]`
- Assertions:
  - status is `completed`
  - `execute` called exactly `1` time

## same toolId different args Re-approval Test

- Test: `H3 does not reuse approval when the args hash changes`
- Approved args:
  - `{ command: "pwd", attachSessionId: "session-1" }`
- Current args:
  - `{ command: "git status", attachSessionId: "session-1" }`
- Assertions:
  - status is `awaiting_approval`
  - approval reason is `blackbox_hash_guard requires explicit approval before execution.`
  - `execute` not called

## workspaceBoundary.argKeys Test

- Test: `H4 uses workspaceBoundary.argKeys as the only workspace boundary source`
- Tool capability metadata:
  - `workspaceBound: true`
  - `workspaceBoundary.argKeys: ["targetPath"]`
- Input args:
  - `targetPath: "../outside.txt"`
  - `cwd: "."`
- Assertions:
  - approval reason is `blackbox_boundary_keys requests targetPath outside the current workspace root.`
  - approval reason does not contain `cwd`
  - `execute` not called

## Windows /ONLY_ALT_WORKSPACE.txt Non-escape Test

- Test: `H5 allows Windows root-relative slash paths inside the workspace root`
- Workspace root:
  - `D:\CODEX_TEST_FOLDER_ALT`
- Input args:
  - `targetPath: "/ONLY_ALT_WORKSPACE.txt"`
- Assertions:
  - status is `completed`
  - no outside-workspace approval record exists
  - `execute` called once

## External Path Blocking Test

- Test: `H6 blocks external path %s`
- Covered paths:
  - `D:\outside.txt`
  - `C:\outside.txt`
  - `\\server\share\file.txt`
  - `../outside.txt`
  - `..\outside.txt`
- Assertions for every path:
  - status is `awaiting_approval`
  - approval reason is `blackbox_external_path_guard requests targetPath outside the current workspace root.`
  - `execute` not called, so no write side effect happens

## Trace / Event / Result Observability Test

- Test: `H7 exposes invocation events, artifacts, result and trace records`
- Public observables checked:
  - returned record status is `completed`
  - returned record result is `{ ok: true }`
  - returned record has `1` artifact
  - event sequence is:
    - `invocation:start`
    - `invocation:progress`
    - `invocation:artifact`
    - `invocation:result`
    - `invocation:finish`
  - trace span kinds are:
    - `invocation`
    - `strategy_selection`
    - `artifact_emit`
    - `result_normalization`
  - trace debug view `spanCount` is `4`

## Runtime Code Change Statement

- Runtime code changed: `No`
- No runtime file under these forbidden areas was edited:
  - `server/src/mcp/core/invocations.ts`
  - `server/src/mcp/core/permissions.ts`
  - `server/src/mcp/workspace.ts`
  - `server/src/mcp/workspace-path-args.ts`
  - `server/src/harness/**` runtime code
  - `server/src/agent/**`
  - `desktop/**`
- This task only added one allowed blackbox test file and three report artifacts.

## Actual typecheck / test Execution Results

1. `pnpm --filter @ui-chat-mira/server test -- src/mcp src/harness`
   Result: passed
   Evidence:
   - `32` test files passed
   - `245` tests passed
   - raw log saved to `server/test-report/harness-blackbox-vitest.txt`

2. `pnpm --filter @ui-chat-mira/server typecheck`
   Result: passed
   Evidence:
   - `tsc --noEmit -p tsconfig.json` exited successfully
   - raw log saved to `server/test-report/harness-blackbox-typecheck.txt`

## Additional Note

- The test log contains one expected `400` validation-path log from `src/mcp/routes.test.ts`. The suite itself still completed successfully and did not produce a test failure.

## 评审结论

通过

## 阻断问题

无

## 按任务划分的独立整改提示词

无需整改
