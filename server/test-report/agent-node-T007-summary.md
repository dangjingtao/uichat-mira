# agent_node_T007 acceptance report

- Branch: `main`
- Rerun workspace HEAD: `8110b0aaf921e79a4dc20022c31c5f41908d3afc`
- Scope:
  - `server/src/agent/graph.test.ts`
  - `server/src/agent/tool-call-normalize.test.ts`
  - `server/src/agent/tool-node.test.ts`
  - `server/src/agent/policy.test.ts`

## Commands

```bash
pnpm --filter @ui-chat-mira/server test -- src/agent/graph.test.ts src/agent/tool-call-normalize.test.ts src/agent/tool-node.test.ts src/agent/policy.test.ts
pnpm --filter @ui-chat-mira/server typecheck
```

## Reports

- Raw vitest JSON:
  - `server/test-report/agent-node-T007-vitest.json`
- Vitest timing metadata:
  - `server/test-report/agent-node-T007-vitest.meta.txt`
- Typecheck output:
  - `server/test-report/agent-node-T007-typecheck.txt`

## Results

- Vitest:
  - startedAt: `2026-07-04T02:34:18.4198368+08:00`
  - finishedAt: `2026-07-04T02:34:23.7801451+08:00`
  - durationMs: `5360`
  - suites: `4 passed / 0 failed`
  - tests: `46 passed / 0 failed`
- Typecheck:
  - startedAt: `2026-07-04T02:34:18.3796986+08:00`
  - finishedAt: `2026-07-04T02:34:22.1576552+08:00`
  - durationMs: `3778`
  - result: `passed`

## Note

This report replaces T007 references to the old `2026-07-03` server-wide failure reports. Those older reports are not used as acceptance evidence for this task.
