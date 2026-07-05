# Task 01 Review Sheet: AgentGraph Mainline Blackbox

## Conclusion

Task 01 review material is complete.

- Blackbox entry uses `agentGraph.run(...)`
- Runtime implementation modified: No
- Coverage status: A1-A8 covered, `8/8`
- Required cases present: Yes
- Test result: Passed
- Typecheck result: Passed

## Change Diff

### Added files

- `server/src/agent/__tests__/agentgraph-mainline-blackbox.test.ts`
- `server/test-report/agentgraph-blackbox-summary.md`
- `server/test-report/agentgraph-blackbox-vitest.txt`
- `server/test-report/agentgraph-blackbox-typecheck.txt`
- `server/test-report/agentgraph-blackbox-diff.txt`
- `server/test-report/agentgraph-blackbox-review.md`

### Runtime change audit

- Planner runtime modified: No
- Normalize runtime modified: No
- Policy runtime modified: No
- ToolNode runtime modified: No
- Evidence runtime modified: No
- AgentGraph runtime modified: No

## Blackbox Test Entry

Test entry is the public runtime call:

```ts
agentGraph.run(...)
```

This review package does not use internal node direct invocation as the test entry.

## Coverage Matrix

| Case | Status | Test evidence |
| --- | --- | --- |
| A1 direct answer does not enter tool chain | Covered | `A1 direct answer completes without entering the tool chain` |
| A2 `use_tool` must pass Harness path | Covered | `A2 use_tool goes through normalize and executes one concrete Harness call` |
| A3 `selectedToolIds` must not bypass Planner / Normalize | Covered | `A3 selectedToolIds do not bypass planner or trigger ToolNode when planner answers` |
| A4 capability-like id must not execute | Covered | `A4 capability-like ids are rejected before Harness execution` |
| A5 repeated tool guard | Covered | `A5 repeated same tool call is guarded and does not execute twice` |
| A6 `.` and `/workspace` equivalent repeat fingerprint | Covered | `A6 "." and "/workspace" normalize to the same repeated fingerprint` |
| A7 `waiting_approval` stops and does not continue tool execution | Covered | `A7 waiting_approval stops the run before ToolNode executes` |
| A8 failed / maxIterations does not keep executing tools or fake success | Covered | `A8 failed tool does not continue with extra tool execution or fake success`, `A8 maxIterations does not issue a second tool execution` |

## Mandatory Review Points

- `selectedToolIds` does not bypass Planner / Normalize: Present
- `use_tool` must go through Harness: Present
- repeated tool guard: Present
- `waiting_approval` stops and does not continue executing tools: Present

## Verification Results

### Vitest

Command:

```bash
pnpm --filter @ui-chat-mira/server test -- src/agent/__tests__/agentgraph-mainline-blackbox.test.ts
```

Result:

- Passed
- `1` test file
- `9` tests

Command:

```bash
pnpm --filter @ui-chat-mira/server test -- src/agent
```

Result:

- Passed
- `17` test files
- `214` tests

### Typecheck

Command:

```bash
pnpm --filter @ui-chat-mira/server typecheck
```

Result:

- Passed

## Report Consistency Check

- Review conclusion matches blackbox test result: Yes
- Review conclusion matches agent test suite result: Yes
- Review conclusion matches typecheck result: Yes
- Runtime-not-modified conclusion matches changed files: Yes
