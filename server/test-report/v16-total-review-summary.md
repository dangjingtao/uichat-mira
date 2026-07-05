# UIChat Mira V1.6 server-side total evidence summary

- Current HEAD: `c6311cec46b5f849ae35346f187714a6fa503559`
- Evidence date: `2026-07-06`
- Scope: fix the remaining full-suite timeout blocker in `@ui-chat-mira/server`

## Root cause

- `src/sandbox/executor.test.ts` left fake timers active after timeout-related cases. When the suite later reached `src/mcp/tools/read-locate.tool.test.ts`, the path-locate case ran under fake timers and stalled until Vitest hit the `5000ms` test timeout.
- Several integration and route tests changed `DATABASE_URL` or initialized sqlite-backed test databases without explicitly resetting the shared sqlite client between setup and cleanup. In the single-fork full run, that left cross-file database client state and file-handle pressure higher than targeted reruns.
- `src/logger.ts` registered `process.stdout` and `process.stderr` error listeners every time the module was re-evaluated in test isolation, and recreated file streams repeatedly. That produced `MaxListenersExceededWarning` during the full suite and added avoidable global runtime pressure.

## Modified files

- `server/src/sandbox/executor.test.ts`
- `server/src/logger.ts`
- `server/src/test-support/artifacts.ts`
- `server/src/bootstrap-env.test.ts`
- `server/src/harness/sandbox/index.test.ts`
- `server/src/agent/__tests__/persistence.test.ts`
- `server/src/agent/__tests__/tool-node.test.ts`
- `server/src/mcp/external-connect.test.ts`
- `server/src/mcp/routes.test.ts`
- `server/src/mcp/workspace.test.ts`
- `server/src/mcp/document-readers.test.ts`
- `server/src/mcp/resources/workspace-resource.test.ts`
- `server/src/mcp/tools/edit-file.tool.test.ts`
- `server/src/mcp/tools/read-extract.tool.test.ts`
- `server/src/mcp/tools/read-list.tool.test.ts`
- `server/src/mcp/tools/read-locate.tool.test.ts`
- `server/src/mcp/tools/read-open.tool.test.ts`
- `server/src/mcp/tools/read.tool.test.ts`
- `server/src/mcp/tools/terminal-session.tool.test.ts`
- `server/src/mcp/tools/workspace-mutation.tool.test.ts`
- `server/src/routes/integrations/index.test.ts`
- `server/src/routes/integrations/wecom.test.ts`
- `server/src/routes/proxy-provider/chat.routes.test.ts`
- `server/src/routes/proxy-provider/rag-message-metadata.test.ts`
- `server/src/routes/role/roles.routes.test.ts`
- `server/src/routes/thread/threads.routes.test.ts`
- `server/src/services/evaluation-package-generator.service.test.ts`
- `server/src/services/evaluation.service.test.ts`
- `server/src/services/local-model-runtime/resource-resolver.test.ts`
- `server/src/services/role.service.test.ts`
- `server/src/services/thread.service.test.ts`

## Test artifact placement

- All touched server tests now write sqlite files, temporary workspaces, and external-path fixtures under the repository root `.test-artifact/server/...`.
- Removed misplaced `rag-message-metadata` sqlite outputs that had been created under `server/`.

## Verification

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm --filter @ui-chat-mira/server test` | PASS | `85` files passed, `604` tests passed, duration `50.66s` |
| `pnpm --filter @ui-chat-mira/server typecheck` | PASS | `tsc --noEmit -p tsconfig.json` completed without errors |

## Targeted contention check

- Reproduced the `read_locate` timeout by running:
  - `pnpm vitest run src/agent/__tests__/routes.test.ts src/routes/logs.test.ts src/routes/role/roles.routes.test.ts src/sandbox/executor.test.ts src/mcp/tools/read-locate.tool.test.ts`
- After restoring real timers in `src/sandbox/executor.test.ts`, the same sequence passed.

## Conclusion

V1.6 server-side total evidence: PASS
