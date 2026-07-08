---
status: planned
owner: docs
last_verified: 2026-07-08
layer: wiki
module: Tool
feature: CodebaseEngineBenchmark
doc_type: plan
canonical: true
related:
  - README.md
  - codebase-understanding-consensus.md
  - ../project-control/tasks/code_T002-codebase-engine-benchmark.md
  - ../project-control/reviews/codebase-understanding-docs-review-index.md
---

# Codebase Engine Benchmark

## Purpose

这页定义代码库理解引擎进入实现前的 benchmark 方案。

当前阶段只设计评测，不接入实现：

- 不安装 CodeGraph、`codebase-memory-mcp` 或 Serena。
- 不新增 MCP server。
- 不修改 Agent Runtime、Planner、Normalize、Policy、ToolNode、Evidence。
- 不修改 `server/src/**`、`desktop/src/**`、`electron/**`、`packages/**`。
- 不修改 `package.json` 或 `pnpm-lock.yaml`。

Benchmark 的目标不是看哪个工具 demo 更好看，而是验证候选引擎能否在 UIChat Mira 当前真实仓库里，稳定回答会影响 Agent 主链、工具运行时和证据链的问题。

## Candidates

### CodeGraph

CodeGraph 是默认核心候选。

重点验证它是否能稳定建立仓库图谱，并回答符号入口、调用链、引用关系、影响面和跨文件导航问题。它的结果必须包含可回到原文的文件路径和行号，不能只返回自然语言摘要。

### `codebase-memory-mcp`

`codebase-memory-mcp` 是强图谱对照候选。

重点验证它与 CodeGraph 在图谱粒度、查询表达、跨文件关系、索引更新、Windows 稳定性和 MCP 运行边界上的差异。它不默认进入第一阶段实现，只作为 benchmark 对照。

### Serena

Serena 是语义导航增强候选。

重点验证它能否改善局部代码阅读、符号跳转、引用查找和小范围修改前的上下文组织。它不能替代 Harness 的权限、Trace、Evidence 和降级职责。

## Baseline Tools

所有候选都必须和当前基础读取能力对照：

- `workspace_inventory`
- `search_text`
- `read_file_slice`
- `rg` + 人工读取

候选引擎只有在能降低 grep/read 成本，同时仍能回到原文位置时，才算对当前工具层有真实增益。

## Real Repository Question Set

以下问题集必须在 `D:\workspace\rag-demo` 的真实代码上运行。问题不能只看 `README.md`，也不能只跑候选工具自带 demo。

| ID | Question | Expected Evidence Target | Why It Matters |
| --- | --- | --- | --- |
| Q1 | `agentGraph.run` 的运行入口在哪里，HTTP 聊天和 resume 分别如何进入它？ | `server/src/agent/graph/index.ts`、`server/src/agent/index.ts`、`server/src/agent/resume.ts` | 验证候选能找到 Agent 主入口，而不是只找到测试里的调用。 |
| Q2 | Planner 到 Evidence 的主链路如何经过 Normalize、Policy、ToolNode，再回到 Evidence？ | `server/src/agent/graph/build-graph.ts`、`server/src/agent/graph/routes.ts`、`server/src/agent/nodes/tool-call-normalize.ts`、`server/src/agent/nodes/policy-node.ts`、`server/src/agent/nodes/tool-node.ts`、`server/src/agent/evidence.ts` | 验证跨节点链路理解和影响面追踪能力。 |
| Q3 | `selectedToolIds` 在哪里生成、写入、消费，为什么它不能绕过 Planner 直接触发 ToolNode？ | `server/src/agent/intent/task-capability-selector.ts`、`server/src/agent/intent/node.ts`、`server/src/agent/__tests__/graph.test.ts`、`server/src/agent/__tests__/toolcall-loop-regression.test.ts` | 验证旧工具选择信号与新 frozen tool call 合同的边界。 |
| Q4 | `answerReadiness.canAnswer` 在哪里生成，Planner 和 Generate 如何消费它？ | `server/src/agent/evidence.ts`、`server/src/agent/planner/prompt.ts`、`server/src/agent/planner/node.ts`、`server/src/agent/nodes/generate.ts` | 验证 Evidence 不是普通日志，而是影响停止规则和回答生成的合同。 |
| Q5 | ToolNode 调用 `executeHarnessInvocation` 的路径是什么，调用结果如何进入 Evidence？ | `server/src/agent/nodes/tool-node.ts`、`server/src/harness/invocations.ts`、`server/src/mcp/routes.ts`、`server/src/agent/evidence.ts` | 验证工具执行层、MCP 层和 Agent Evidence 的边界。 |
| Q6 | 修改 `policyNode` 的 allow/deny/approval 语义会影响哪些测试？ | `server/src/agent/nodes/policy-node.ts`、`server/src/agent/__tests__/policy.test.ts`、`server/src/agent/__tests__/graph.test.ts`、`server/src/routes/proxy-provider/chat-agent-approval.smoke.test.ts` | 验证影响测试定位能力，避免只返回实现文件。 |
| Q7 | `toolCallNormalizeNode` 的 schema failure 如何回到 Planner 重试，而不是直接执行工具？ | `server/src/agent/nodes/tool-call-normalize.ts`、`server/src/agent/graph/routes.ts`、`server/src/agent/planner/node.ts`、`server/src/agent/__tests__/tool-call-normalize.test.ts` | 验证失败路径和恢复路径是否能被图谱捕获。 |
| Q8 | 如果 `read_open` 的 Evidence 摘要字段变化，哪些生成或停止规则最可能受影响？ | `server/src/agent/evidence.ts`、`server/src/agent/nodes/generate.ts`、`server/src/agent/__tests__/nodes.test.ts`、`server/src/agent/__tests__/next-action-planner.test.ts` | 验证字段级影响面，而不是只找字符串。 |

## Required Evaluation Dimensions

每个候选都必须按以下维度评分：

| Dimension | What To Measure | Pass Signal |
| --- | --- | --- |
| Accuracy | 回答是否命中真实入口、真实调用链和真实测试影响面。 | 关键文件与核心关系无明显漏报或误报。 |
| Tool Call Count | 为回答每个问题需要多少次候选工具调用和补充 read 调用。 | 相比 `rg` + read 基线有稳定下降。 |
| Source Location | 是否返回 source path、line range 和可复核符号位置。 | 结果可直接回到原文，不只给摘要。 |
| Evidence Usability | 结果能否进入 Evidence 前的候选事实池，并顺利被原文核验。 | 每条关键结论都有可读原文位置。 |
| Windows Stability | 在 Windows 本地开发环境中索引、查询、重启是否稳定。 | 无路径分隔符、长路径、二进制或 watcher 阻断。 |
| Index Duration | 冷启动索引和增量索引耗时。 | 对本仓库可接受，并能给出进度或状态。 |
| Repeat Consistency | 同一问题重复运行是否返回稳定文件和关系。 | 结果顺序可有变化，但关键结论一致。 |
| Context Size | 返回内容体积是否可控，是否避免把大文件或无关摘要塞进上下文。 | 默认结果简洁，可按需展开。 |
| Grep/Read Reduction | 相比当前 `rg`、`search_text`、`read_file_slice` 的人工补查量下降多少。 | 对复杂链路问题有明确降幅。 |
| Failure Degradation | 索引缺失、权限不足、工具不可用、结果无行号时如何降级。 | 能回到基础读取能力，不产生静默错误。 |

## Scoring Template

每个候选按 0 到 3 分评分：

- `0`: 不可用，不能回答该维度，或结果无法核验。
- `1`: 可用但不稳定，需要大量人工补查。
- `2`: 基本可用，有少量漏报或需要补充读取。
- `3`: 稳定可用，输出可核验，且明显优于基础工具。

| Candidate | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 | Accuracy | Calls | Source | Evidence | Windows | Index | Repeat | Context | Reduction | Degrade | Total | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CodeGraph |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| `codebase-memory-mcp` |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |
| Serena |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |  |

## Benchmark Run Record Template

```text
Candidate:
Version / commit:
Host OS:
Node / runtime:
Workspace:
Index command:
Index duration:
Index size:
Question:
Tool calls:
Returned files:
Returned line ranges:
Required follow-up reads:
Correct findings:
Missed findings:
False positives:
Evidence-ready results:
Failure or degradation behavior:
Notes:
```

## Pass / Fail Rules

### Pass

候选可进入下一阶段设计，必须同时满足：

- 覆盖 Q1 到 Q8 的核心问题，不能只回答 README、目录树或候选工具 demo。
- 对 Q2、Q3、Q4、Q5、Q6 至少达到 `2` 分，因为这些问题直接影响 Agent 主链和工具执行合同。
- 至少 80% 的关键结论带 source path 和 line range，且能用原文读取核验。
- Windows 上冷启动索引、重复查询和重启后查询都可用。
- 失败时能明确暴露错误，并能降级到 `workspace_inventory`、`search_text`、`read_file_slice`。
- 相比 `rg` + read 基线，在跨文件链路问题上有明确工具调用或上下文体积下降。

### Fail

出现以下任一情况即不通过：

- 只能展示 README、目录树或 demo，不回答真实仓库问题。
- 返回大量无法定位到原文的摘要。
- 把未核验图谱结论伪装成 Evidence。
- Windows 上索引或查询不稳定，且没有可接受降级路径。
- 不能解释 `agentGraph.run`、Planner 到 Evidence、`selectedToolIds`、`answerReadiness.canAnswer`、`executeHarnessInvocation` 或 `policyNode` 影响测试中的任一核心链路。
- 需要修改运行时代码或安装依赖才能完成本 docs-only 任务阶段。

## Expected Output

Benchmark 完成后，应产出一份评测记录，至少包含：

- 三个候选的评分表。
- 每个问题的原文核验路径。
- 每个候选的失败样例和降级表现。
- 推荐是否进入 `code_T003` / `code_T004` 后续设计。
- 明确保留 `workspace_inventory`、`search_text`、`read_file_slice` 作为基础能力。
