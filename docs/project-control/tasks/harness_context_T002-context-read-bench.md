---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-05
layer: project-control
module: Harness
feature: ContextReadBench
doc_type: task-card
canonical: true
related:
  - docs/harness/README.md
  - docs/tooling-runtime/read-skill-design.md
  - server/src/harness/context/bench/runner.ts
  - server/src/harness/context/bench/cases.test.ts
task_state: DONE
---

# harness_context_T002 Context Read Bench

## Target

为 `Harness Context System` 建立 `Context / Read` 能力压测。

问题本体：

- 当前 `Context Read Plan DSL` 只有 planner 级验证，缺少真实读取路径压测
- 编码、中文路径、大文件、二进制和预算边界还没有集中证据
- `inspect` 虽然已有 plan 语义，但还缺一组围绕 `maxFiles / maxChars` 的上下文构建压测

## Allowed Changes

- `server/src/harness/context/**`
- 与本任务直接相关的 `server` 测试
- 与本任务直接相关的当前项目台账文档

## Forbidden Changes

- `read_*` 生产实现语义
- terminal command bench
- cwd escape 测试
- LSP / tree-sitter 接入
- `desktop/`
- `electron/`
- `pnpm-lock.yaml`

## Acceptance Criteria

1. 新增 `Context / Read` bench runner 与结构化输出
2. bench 输出固定包含：
   - `caseId`
   - `operation`
   - `input`
   - `status`
   - `filesRead`
   - `charsRead`
   - `encoding`
   - `truncated`
   - `diagnostics`
3. bench 覆盖：
   - 中文目录名
   - 中文文件名
   - UTF-8 中文内容
   - UTF-8 with BOM
   - GBK 文件至少不崩，并标记 `encoding uncertain` 或 `decoded`
   - 二进制文件拒读或 `binaryDetected`
   - 大文件 `read_slice`
   - `locate -> open`
   - `list -> open README`
   - `inspect` 在预算内返回 context
   - `maxFiles` 生效
   - `maxChars` 生效
4. 不通过 terminal command 驱动 bench
5. 台账记录这次任务

## Verification

- `pnpm --filter @ui-chat-mira/server exec vitest run src/harness/context/bench/cases.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - result: passed (`1` file, `1` test)
- `pnpm --filter @ui-chat-mira/server bench:context:read`
  - workdir: `D:/workspace/rag-demo`
  - result: passed (`11` cases, `11 passed`, `0 failed`)
- `pnpm --filter @ui-chat-mira/server exec tsc --noEmit -p tsconfig.json`
  - workdir: `D:/workspace/rag-demo`
  - result: failed outside this task's modified scope
  - failure:
    - `src/mcp/terminal/runtime.ts(612-616)` 访问 `stdoutEncoding / stderrEncoding / truncated / binaryDetected / violations` 时与当前类型不对齐
- `pnpm check`
  - workdir: `D:/workspace/rag-demo`
  - result: failed outside this task's modified scope
  - failure:
    - `packages/docs-site` 的 `tsc --noEmit -p tsconfig.json` 进程退出 `3221225477`

## Evidence

- Changed files:
  - `server/package.json`
  - `server/src/harness/context/bench/contract.ts`
  - `server/src/harness/context/bench/fixtures.ts`
  - `server/src/harness/context/bench/cases.ts`
  - `server/src/harness/context/bench/cases.test.ts`
  - `server/src/harness/context/bench/runner.ts`
  - `server/src/harness/context/bench/README.md`
  - `docs/project-control/tasks/harness_context_T002-context-read-bench.md`
  - `docs/project-control/project-control-ledger.md`
- Current implementation evidence:
  - bench fixture 会生成中文目录、中文文件名、UTF-8 BOM、GBK、二进制和大文件样本，不依赖 terminal command
  - bench runner 输出固定字段：
    - `caseId`
    - `operation`
    - `input`
    - `status`
    - `filesRead`
    - `charsRead`
    - `encoding`
    - `truncated`
    - `diagnostics`
  - bench 已覆盖：
    - 中文目录名
    - 中文文件名
    - UTF-8 中文内容
    - UTF-8 with BOM
    - GBK 不崩并标记 `uncertain`
    - 二进制 `binaryDetected`
    - 大文件 `read_slice`
    - `locate -> open`
    - `list -> open README`
    - `inspect` 在预算内返回 context
    - `maxFiles` 生效
    - `maxChars` 生效
  - `inspect` bench 使用现有 planner + locate + open + slice 组合读取，不修改 `read_*` 生产语义
  - 定向 bench JSON summary 已验证：
    - `total=11`
    - `passed=11`
    - `failed=0`

## Unfinished / Risks

- 这次只建立 `Context / Read` bench，没有把 inspect context builder 正式接进 production runtime
- `server` typecheck 仍被 `src/mcp/terminal/runtime.ts(612-616)` 的既有类型问题阻断，不属于本任务允许改动范围
- `pnpm check` 仍被 `packages/docs-site` 的 typecheck 进程退出 `3221225477` 阻断，不属于本任务允许改动范围

## Review Outcome

- 评审结论：通过
- 当前状态：`DONE`
