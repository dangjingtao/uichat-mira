# Harness Invocation Boundary Blackbox Summary

- Current HEAD: `68e11d7ce8157cf6f8ab73c66eeb289d264c5675`
- Runtime modified: `No`
- New test files:
  - `server/src/mcp/core/invocations.blackbox.test.ts`
- Report artifacts:
  - `server/test-report/harness-blackbox-vitest.txt`
  - `server/test-report/harness-blackbox-typecheck.txt`

## Coverage Matrix

| Case | Covered by | Evidence |
| --- | --- | --- |
| H1. Unapproved high-risk tool does not execute | `H1 blocks unapproved high-risk tools before execute` | `awaiting_approval`; `execute` not called; explicit approval reason asserted |
| H2. Exact `toolId + inputHash` approval executes | `H2 executes only after exact toolId + inputHash approval` | `completed`; `execute` called once |
| H3. Different args do not reuse approval | `H3 does not reuse approval when the args hash changes` | old hash supplied; `awaiting_approval`; `execute` not called |
| H4. `workspaceBoundary.argKeys` is the only boundary source | `H4 uses workspaceBoundary.argKeys as the only workspace boundary source` | only `targetPath` participates; reason names `targetPath`; no implicit `cwd` boundary |
| H5. Windows root-relative slash path is not misclassified outside workspace | `H5 allows Windows root-relative slash paths inside the workspace root` | workspace root `D:\CODEX_TEST_FOLDER_ALT`; `/ONLY_ALT_WORKSPACE.txt` completes; no outside-workspace approval |
| H6. External absolute and traversal paths stay blocked | `H6 blocks external path %s` | covered paths: `D:\outside.txt`, `C:\outside.txt`, `\\server\share\file.txt`, `../outside.txt`, `..\outside.txt`; all return `awaiting_approval`; no execute |
| H7. Trace / event / artifact are observable | `H7 exposes invocation events, artifacts, result and trace records` | asserts `invocation:start`, `invocation:artifact`, `invocation:result`, `invocation:finish`; artifact/result persisted; trace readable |
| H8. `capabilityId` cannot execute as a concrete `toolId` | `H8 rejects capabilityId-style invocation when no concrete tool is registered under that id` | `Tool not found: workspace_lookup`; no execution path entered |

## Commands And Results

1. `pnpm --filter @ui-chat-mira/server test -- src/mcp src/harness`
   Result: passed, `32` files / `245` tests.
   Raw output: `server/test-report/harness-blackbox-vitest.txt`
2. `pnpm --filter @ui-chat-mira/server typecheck`
   Result: passed.
   Raw output: `server/test-report/harness-blackbox-typecheck.txt`

## Notes

- The vitest log includes an expected `400` validation-path log from `src/mcp/routes.test.ts`; the suite still passed in full.
- This task intentionally did not change runtime files under `server/src/mcp/core/*.ts`, `server/src/mcp/workspace*.ts`, `server/src/harness/**` runtime code, `server/src/agent/**`, or `desktop/**`.
