---
status: current
priority: P1
owner: runtime
last_verified: 2026-07-05
layer: project-control
module: Sandbox
feature: ArtifactOutputContract
doc_type: task-card
canonical: true
related:
  - docs/project-control/agent-workboard.md
  - docs/project-control/project-control-ledger.md
  - docs/harness/sandbox-module.md
  - docs/harness/harness-phase-1-implementation-checklist.md
  - docs/tooling-runtime/core-tool-rectification-ledger.md
  - server/src/harness/sandbox/contract.ts
  - server/src/harness/sandbox/index.ts
  - server/src/sandbox/executor.ts
task_state: READY_FOR_REVIEW
---

# T-013 Sandbox Artifact Output Contract

## Target

扩展 Sandbox 的产物和输出合同，让 Mira 能稳定交付本地产物，并把 stdout / stderr 的编码与二进制边界说清楚。

问题本体：

- 现有 `SandboxRunResult` 只有 `stdoutText / stderrText / truncated`
- 没有编码回传，调用方无法区分 `utf8 / gbk / utf16le / unknown`
- 二进制输出会被直接当文本处理，中文和二进制边界不够稳
- artifact 还是 MCP 通用形态，没有“本地产物”最小合同
- direct bench 还没有覆盖 artifact 注册能力

## Allowed Changes

- `server/src/sandbox/executor.ts`
- `server/src/sandbox/executor.test.ts`
- `server/src/harness/sandbox/**`
- `docs/harness/sandbox-module.md`
- `docs/harness/harness-phase-1-implementation-checklist.md`
- `docs/project-control/agent-workboard.md`
- `docs/project-control/project-control-ledger.md`
- `docs/tooling-runtime/core-tool-rectification-ledger.md`
- `docs/project-control/tasks/T-013-sandbox-artifact-output-contract.md`

## Forbidden Changes

- renderer / desktop UI
- Electron / Tauri 启动链路
- backend route path contract
- packaging scripts
- `pnpm-lock.yaml`
- 文件管理 UI
- PDF / DOCX 转换

## Acceptance Criteria

1. `SandboxRunResult` 支持 artifacts，并使用本地产物最小合同
2. 命令生成文件时允许显式注册 artifact
3. `stdoutText` / `stderrText` 分开回传
4. 输出超限必须 `truncated=true`
5. 二进制输出不得直接当文本，结果必须标记 `binaryDetected=true`
6. 中文 stdout / stderr 至少不崩；不能确定编码时标 `unknown`

## Verification

- `pnpm --filter @ui-chat-mira/server test -- src/sandbox/executor.test.ts src/harness/sandbox/index.test.ts`
  - workdir: `D:/workspace/rag-demo`
  - result: passed (`2` files, `31` tests)
- `pnpm --filter @ui-chat-mira/server bench:sandbox:direct D:\workspace\rag-demo`
  - workdir: `D:/workspace/rag-demo`
  - result: passed
- `pnpm --filter @ui-chat-mira/server exec tsc --noEmit -p tsconfig.json`
  - workdir: `D:/workspace/rag-demo`
  - result: passed
- `pnpm check`
  - workdir: `D:/workspace/rag-demo`
  - result: passed

## Evidence

- Changed files:
  - `server/src/harness/sandbox/contract.ts`
  - `server/src/harness/sandbox/index.ts`
  - `server/src/harness/sandbox/index.test.ts`
  - `server/src/harness/sandbox/bench/cases.ts`
  - `server/src/sandbox/executor.ts`
  - `server/src/sandbox/executor.test.ts`
  - `docs/harness/sandbox-module.md`
  - `docs/harness/harness-phase-1-implementation-checklist.md`
  - `docs/tooling-runtime/core-tool-rectification-ledger.md`
  - `docs/project-control/agent-workboard.md`
  - `docs/project-control/project-control-ledger.md`
  - `docs/project-control/tasks/T-013-sandbox-artifact-output-contract.md`

- Diff summary:
  - `SandboxRunResult` 新增 `stdoutEncoding`、`stderrEncoding`、`binaryDetected`，并把 artifact 改成本地产物合同
  - `SandboxRunRequest` 新增 `artifactRegistrations`，允许命令执行后显式登记 workspace 内文件或目录
  - `SandboxExecutor` 新增输出解码归一：优先按 shell profile 解码，Windows `utf16le` 配置与实际 `utf8` 字节流不一致时会自动回退到正确文本解码
  - `SandboxExecutor` 对二进制 chunk 做检测，命中后不再把内容当普通文本展开，而是返回占位文本并标记 `binaryDetected`
  - direct contract 与 direct bench 已回传 artifacts / 编码 / binary 状态，并补了 artifact 注册回归

## Unfinished / Risks

- 当前编码识别是桌面级启发式归一，不是完整 charset 探测器；遇到未知编码仍会回传 `unknown`
- artifact 只负责登记 workspace 内已存在的文件或目录，不负责文件管理 UI
- 当前只覆盖 direct sandbox contract，没有把 artifact preview viewer 一起带入这张卡

## Review Outcome

- 评审结论：待复评
- 当前状态：`READY_FOR_REVIEW`
