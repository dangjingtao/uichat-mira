# UIChat Mira V1.6 server-side total evidence summary

- Current HEAD: `c6311cec46b5f849ae35346f187714a6fa503559`
- Evidence date: `2026-07-06`
- Initial `git status --short`:
  - `M docs/project-control/project-control-ledger.md`
  - `M docs/project-control/tasks/skill_T001-docs-only-foundation.md`
- Final `git status --short`:
  - `M .gitignore`
  - `M docs/project-control/project-control-ledger.md`
  - `M docs/project-control/tasks/skill_T001-docs-only-foundation.md`
  - `M server/package.json`
  - `M server/test-report/v16-total-review-summary.md`
  - `M server/test-report/v16-total-review-tests.txt`
  - `M server/test-report/v16-total-review-typecheck.txt`
  - `D server/tmp-integrations-route.sqlite-shm`
  - `D server/tmp-integrations-route.sqlite-wal`
  - `D server/tmp-wecom-route.sqlite-shm`
  - `D server/tmp-wecom-route.sqlite-wal`
  - `D server/tmp-wecom-route.sqlitex`
- Final `git diff --name-only`:
  - `.gitignore`
  - `docs/project-control/project-control-ledger.md`
  - `docs/project-control/tasks/skill_T001-docs-only-foundation.md`
  - `server/package.json`
  - `server/test-report/v16-total-review-summary.md`
  - `server/test-report/v16-total-review-tests.txt`
  - `server/test-report/v16-total-review-typecheck.txt`
- SQLite temp artifact cleanup:
  - removed tracked temp files from git index
  - added ignore rules for `server/tmp-*.sqlite`, `server/tmp-*.sqlite-shm`, `server/tmp-*.sqlite-wal`, `server/tmp-*.sqlitex`
  - verified no `server/tmp-*` worktree files remained after cleanup

## Command results

| Command | Result | Evidence |
| --- | --- | --- |
| `pnpm --filter @ui-chat-mira/server typecheck` | PASS | script now runs `node ./node_modules/typescript/bin/tsc --noEmit -p tsconfig.json` |
| `cd server && pnpm typecheck` | PASS | same script and same pass result |
| `pnpm --filter @ui-chat-mira/server test` | FAIL | `82` files passed, `3` files failed, `592` tests passed, `5` tests failed |
| Tool Exposure suite | PASS | `6` files passed, `97` tests passed |
| ToolCall Loop suite | PASS | `7` files passed, `97` tests passed |
| Sandbox suite | PASS | `3` files passed, `36` tests passed |
| Context / RAG / chat route suite | PASS | `8` files passed, `49` tests passed |
| `pnpm --filter @ui-chat-mira/server bench:sandbox:direct` | PASS | V1.6 gate `command` satisfied; `7` gate cases passed, `3` future profiles reported as `future_profile` |
| `pnpm --filter @ui-chat-mira/server bench:context:read` | PASS | `11/11` passed |

## Full test failure summary

- `src/agent/__tests__/routes.test.ts`
  - `returns and updates runs`
  - `approve is idempotent when run is not waiting approval`
  - `approve returns resumed run state from resume helper`
  - failure mode: timeout at `5000ms`
- `src/mcp/tools/read-locate.tool.test.ts`
  - `locates files by path pattern`
  - failure mode: timeout at `5000ms`
- `src/routes/role/roles.routes.test.ts`
  - `role routes support create list update delete`
  - failure mode: timeout at `5000ms`
- Targeted rerun evidence:
  - `pnpm --filter @ui-chat-mira/server test -- src/agent/__tests__/routes.test.ts src/mcp/tools/read-locate.tool.test.ts src/routes/role/roles.routes.test.ts`
  - PASS with `3` files passed and `9` tests passed
  - current evidence says the blocking issue is full-suite timeout behavior, not stable single-file functional failure

## Request context real chain

- Current request context resolver chain:
  - `role`
  - `summary`
  - `memory`
  - `agent`
- Verified consumer chain:
  - `src/services/shared-nodes/thread-request-context.node.ts`
  - `src/services/rag-nodes/generate.service.ts`
  - `src/services/rag-graph.ts`
  - `src/routes/proxy-provider/chat.routes.ts`
- `thread-request-context-web-search.resolver` is a deprecated path.
- It is not part of the current request context chain.
- It is no longer a coverage gap.
- `web_search` is now an independent tool capability, not part of `requestContextMessages` pre-injection.

## Sandbox profile statement

- V1.6 gate only commits to `command`.
- `read_only`, `workspace_write`, and `networked_command` are `future_profile`.
- Current bench output uses `future_profile` wording, not `not_implemented`.

## Remaining failures and coverage statement

- Remaining failing item:
  - full `pnpm --filter @ui-chat-mira/server test`
- Current uncovered-item statement:
  - no additional coverage gap was found in the current request context main chain within the scoped suites
  - the unresolved issue is full-suite timeout behavior, which is outside this evidence-only task scope

## Conclusion

V1.6 server-side total evidence: FAIL
