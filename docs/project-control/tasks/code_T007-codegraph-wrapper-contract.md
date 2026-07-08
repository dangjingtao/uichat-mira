---
status: current
priority: P1
owner: docs
last_verified: 2026-07-08
layer: project-control
module: ProjectControl
feature: CodeGraphWrapperContract
doc_type: task-card
canonical: true
related:
  - docs/project-control/project-control-ledger.md
  - docs/tooling-runtime/README.md
  - docs/tooling-runtime/codegraph-wrapper-contract.md
  - docs/tooling-runtime/codebase-engine-abstraction.md
task_state: READY_FOR_REVIEW
---

# code_T007 CodeGraph Wrapper Contract

## Target

新增 CodeGraph wrapper 合同文档，明确 CodeGraph 进入 runtime 前必须经过受控 `codebase_explore` 包装层。

本任务是 docs-only 任务包，输出的是合同文档和台账更新，不接 runtime。

本任务目标文档：

- `docs/tooling-runtime/codegraph-wrapper-contract.md`

## Allowed Changes

- `docs/project-control/tasks/code_T007-codegraph-wrapper-contract.md`
- `docs/tooling-runtime/codegraph-wrapper-contract.md`
- `docs/tooling-runtime/README.md`
- `docs/project-control/project-control-ledger.md`

## Forbidden Changes

- `server/src/**`
- `desktop/src/**`
- `electron/**`
- `packages/**`
- `package.json`
- `pnpm-lock.yaml`
- 任何测试文件
- Agent Runtime / Planner / Normalize / Policy / ToolNode / Evidence 实现
- CodeGraph runtime 接入代码

## Acceptance Criteria

1. 新增 `docs/tooling-runtime/codegraph-wrapper-contract.md`
2. 文档明确第一阶段 Planner 只看到 `codebase_explore` 一个能力名
3. 文档明确 CodeGraph 原生命令 `query` / `explore` / `affected` 只能作为 wrapper 内部实现细节
4. 文档明确 `codebase_explore` 是探索工具，不是 Evidence 工具，不直接生成答案
5. 文档定义 scope：
   - `agent-runtime`
   - `harness-mcp`
   - `desktop-ui`
   - `microapps`
   - `docs`
   - `workspace-general`
6. 文档定义每个 scope 的 include paths
7. 文档定义默认 exclude paths：
   - `node_modules/**`
   - `.git/**`
   - `dist/**`
   - `build/**`
   - `coverage/**`
   - `release/**`
   - `.artifacts/**`
   - `.test-artifact/**`
8. 文档定义 query 自动加 path scope 的规则
9. 文档定义结果裁剪限制：
   - `maxFiles: 8`
   - `maxSnippets: 12`
   - `maxSnippetLines: 24`
   - `maxTotalLines: 160`
   - `maxRawChars: 16000`
10. 文档定义统一返回合同 `CodebaseExploreResult`
11. 文档定义 `CodebaseCandidate`，且必须包含：
    - `path`
    - `startLine`
    - `endLine`
    - `kind`
    - `summary`
    - `confidence`
    - `source.engine`
    - `source.command`
    - `verification.required`
    - `verification.status`
    - `limitations`
12. 文档明确所有 CodeGraph candidate 默认 `verification.required = true`
13. 文档明确进入 Evidence 前必须 `read_file_slice` 或做等价原文核验
14. 文档明确 broad explore 噪声压制规则
15. 文档明确失败降级链：
    - `CodeGraph`
    - scoped `search_text`
    - `workspace_inventory`
    - `read_file_slice`
16. 文档明确禁止：
    - CodeGraph 没查到就直接回答“没有”
    - CodeGraph 结果无 line range 直接进入 Evidence
    - broad explore 结果裸交给 Planner
    - Planner 直接调用 CodeGraph 原生命令
17. `docs/tooling-runtime/README.md` 已补入该文档索引
18. `docs/project-control/project-control-ledger.md` 已登记 `code_T007`
19. 明确本任务是 docs-only，不接 runtime

## Verification

- 内容核对：
  - 检查目标文档是否存在
  - 逐条核对 acceptance criteria
- 变更核对：
  - `git diff --name-only`
  - `git status --short`
- 自动化验证：
  - docs-only 任务包，不强制运行自动化命令

## Evidence Requirements

- Changed files
- Diff summary
- Acceptance criteria evidence
- 明确声明本任务 docs-only，未接 runtime
- 明确声明未修改 `server/src/**`、`desktop/src/**`、`electron/**`、`packages/**`、测试文件、`package.json`、`pnpm-lock.yaml`

## Completion Evidence

### Changed Files

本任务实际改动：

- `docs/project-control/tasks/code_T007-codegraph-wrapper-contract.md`
- `docs/tooling-runtime/codegraph-wrapper-contract.md`
- `docs/tooling-runtime/README.md`
- `docs/project-control/project-control-ledger.md`

### Diff Summary

- 新增 `docs/tooling-runtime/codegraph-wrapper-contract.md`，定义 CodeGraph 进入 runtime 前必须经过 `codebase_explore` wrapper 的受控合同。
- 文档明确第一阶段 Planner 只看到 `codebase_explore`，不直接暴露 CodeGraph `query` / `explore` / `affected`。
- 文档补齐 scope、include paths、默认 exclude paths、query 自动加 path scope 规则、broad explore 噪声压制和结果裁剪上限。
- 文档补齐 `CodebaseExploreResult` / `CodebaseCandidate` 统一返回合同、原文核验门槛和失败降级链。
- 更新 `docs/tooling-runtime/README.md` 索引与 `docs/project-control/project-control-ledger.md` 台账，明确 `code_T007` 是 docs-only，不接 runtime。

### Acceptance Criteria Evidence

- AC1：`docs/tooling-runtime/codegraph-wrapper-contract.md` 已新增。
- AC2-4：目标文档 `Purpose`、`Planner Exposure Rule`、`Evidence Boundary` 章节明确第一阶段只暴露 `codebase_explore`，原生命令只留在 wrapper 内部，且该能力不直接生成答案。
- AC5-6：目标文档 `Scope` 与 `Scope Include Paths` 章节定义六个 scope 及其 include paths。
- AC5-6：目标文档 `Scope` 与 `Scope Include Paths` 章节定义六个 scope 及其 include paths，并已按真实仓库路径核验 `desktop/src/features/Settings/pages/MicroApps/**`、`server/src/routes/microapps/**`、`electron/**` 等实际路径。
- AC7：目标文档 `Default Exclude Paths` 章节列出八个默认 exclude paths。
- AC8：目标文档 `Query Path Scope Rule` 章节定义 query 自动附加 path scope 的规则。
- AC9：目标文档 `Result Trimming Limits` 章节定义 `maxFiles: 8`、`maxSnippets: 12`、`maxSnippetLines: 24`、`maxTotalLines: 160`、`maxRawChars: 16000`。
- AC10-11：目标文档 `Unified Return Contract` 与 `CodebaseCandidate Contract` 章节定义 `CodebaseExploreResult` 至少包含字段，以及必填 candidate 字段。
- AC12-13：目标文档 `Verification Gate` 章节明确所有 CodeGraph candidate 默认 `verification.required = true`、`verification.status = pending`，且进入 Evidence 前必须 `read_file_slice` 或等价原文核验。
- AC14：目标文档 `Broad Explore Noise Control` 章节明确噪声压制规则。
- AC15：目标文档 `Failure Degradation Chain` 章节明确 `CodeGraph -> scoped search_text -> workspace_inventory -> read_file_slice`。
- AC16：目标文档 `Prohibitions` 章节明确四项禁止行为。
- AC17：`docs/tooling-runtime/README.md` 已补入该文档索引。
- AC18：`docs/project-control/project-control-ledger.md` 已登记 `code_T007`。
- AC19：目标文档 `Docs-Only Boundary` 与本任务卡 `Target` 章节明确本任务 docs-only，不接 runtime。

### Verification

- 内容核对：已按 acceptance criteria 逐条核对。
- 自动化验证：未运行自动化命令；原因是本任务仅修改 docs，不涉及 runtime、打包或测试实现。

## Review Outcome

- 当前状态：`READY_FOR_REVIEW`
- 待后续动作：按项目控制流程评审 `code_T007` 文档合同是否可作为后续 runtime 任务前置约束
- 明确未修改：runtime、依赖、测试文件、Agent Runtime 实现、CodeGraph runtime 接入代码
