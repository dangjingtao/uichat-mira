---
status: current
owner: docs
last_verified: 2026-07-08
layer: project-control
module: ProjectControl
feature: CodeGraphBenchmarkSpike
doc_type: review
canonical: true
related:
  - docs/project-control/tasks/code_T006-codegraph-benchmark-spike.md
  - docs/project-control/project-control-ledger.md
  - docs/tooling-runtime/codebase-engine-benchmark.md
  - docs/tooling-runtime/codegraph-managed-mcp-spike.md
---

# CodeGraph Benchmark Spike

## Scope

本 review 只记录一次本地 CodeGraph benchmark spike。

不在 scope 内：

- runtime 接入
- MCP server 接入
- `server/src/**`、`desktop/src/**`、`electron/**`、`packages/**` 改动
- `package.json`、`pnpm-lock.yaml` 改动
- 当前工作区里其他任务外脏文件

## Environment

- Host OS: Windows (`D:\workspace\rag-demo`)
- Date: `2026-07-08`
- Node: `v22.17.0`
- npm: `11.16.0`
- CodeGraph install command: `npm install -g @colbymchenry/codegraph`
- CodeGraph version: `1.3.0`
- Telemetry off command: `codegraph telemetry off`
- Telemetry status: `disabled`
- Telemetry config: `C:\Users\Administrator\.codegraph\telemetry.json`
- Workspace indexed: `D:\workspace\rag-demo`
- Temporary index path: `D:\workspace\rag-demo\.codegraph`

## Index Record

- Init command: `codegraph init .`
- Wall time: `9142 ms`
- CodeGraph reported index time: `5.5s`
- Indexed files: `970`
- Nodes: `12,957`
- Edges: `36,115`
- DB size: `37.79 MB`
- Backend: `node:sqlite - built-in (full WAL)`

## Run Summary

结论：`继续`

但这个“继续”只成立在下面这组前提下：

- CodeGraph 继续作为第一候选做受控接入设计，不直接裸露给 Planner。
- 图谱结果只能进入 Evidence 前候选事实池，不能跳过原文核验。
- 第一阶段必须有查询包装层，主动压制 `desktop`、`rag`、`microapp` 等无关域噪声。

不建议当前就把这次 spike 解读为“已经足够直接接入 runtime”。

## Q1-Q8 Record

| Q | Query Process | Returned files / lines | Follow-up read count | Hit / Miss / False positive | Verdict |
| --- | --- | --- | --- | --- | --- |
| Q1 | `codegraph query createAndRunAgent -p . -j`; `codegraph explore "agentGraph run resumeApprovedAgentRun createPersistedRun" -p .` | `server/src/agent/index.ts:17-104`; `server/src/routes/proxy-provider/chat.routes.ts:28`; `server/src/agent/graph/index.ts:10-29`; `server/src/agent/resume.ts:228-377`; `server/src/db/repositories/agent-run.repository.ts:153-211` | 1 | 命中 HTTP chat 入口、resume 入口、graph 入口；误把大量测试调用一并抬高排序 | `3` |
| Q2 | `codegraph explore "build graph routes tool call normalize policy node tool node evidence" -p .` | `server/src/agent/graph/build-graph.ts:38-105`; `server/src/agent/graph/routes.ts:63-157`; `server/src/agent/nodes/policy-node.ts:99-378`; `server/src/agent/nodes/tool-node.ts:244-690` | 1 | 命中主链 wiring，但混入 `scripts/* normalize`、`server/src/services/rag-graph.ts` 等无关结果；`evidence.ts` 没被直接拉成主答案 | `2` |
| Q3 | `codegraph query selectedToolIds -p . -j`; `codegraph explore "selectedToolIds task capability selector planner tool node" -p .` | `server/src/agent/intent/task-capability-selector.ts:488-590`; `server/src/agent/intent/node.ts:116-347`; `server/src/agent/types.ts:553-558`; `server/src/agent/nodes/tool-node.ts:278-318`; tests in `server/src/agent/__tests__/graph.test.ts:1840+` and `toolcall-loop-regression.test.ts:360+` via follow-up read | 2 | 命中生成、写入、消费主文件；“不能绕过 Planner” 需要靠测试名和类型注释补核验 | `2` |
| Q4 | `codegraph query answerReadiness -p . -j`; `codegraph explore "answerReadiness canAnswer evidence planner generate" -p .` | `server/src/agent/types.ts:179-183`; `server/src/agent/planner/node.ts:122,267`; `server/src/agent/planner/prompt.ts:251`; `server/src/agent/nodes/generate.ts:259-334,656-966`; `server/src/agent/evidence.ts:595-617,731-760,1551-1613` via follow-up read | 2 | 直接 query 只找到类型定义；broad explore 混入 `rag-nodes/generate.service.ts`；但补 1 次定向 grep 后可以完成合同核验 | `2` |
| Q5 | `codegraph query executeHarnessInvocation -p . -j`; `codegraph query appendToolExecutionEvidence -p . -j`; `codegraph explore "executeHarnessInvocation tool node evidence mcp routes" -p .` | `server/src/harness/invocations.ts:16-22`; `server/src/agent/nodes/tool-node.ts:382-389,449-456,566-573,660-667`; `server/src/agent/evidence.ts:1680-1725`; `server/src/mcp/routes.ts:843,878` | 1 | 主路径命中很准，source path / line range 充分；误报少 | `3` |
| Q6 | `codegraph query policyNode -p . -j`; `codegraph affected server/src/agent/nodes/policy-node.ts -p . -q` | `server/src/agent/nodes/policy-node.ts:99-378`; `server/src/agent/__tests__/policy.test.ts:156-404`; `server/src/agent/__tests__/graph.test.ts`; `server/src/routes/proxy-provider/chat-agent-approval.smoke.test.ts`; 但 `affected` 还返回了多批无关 desktop/server tests | 1 | required tests 都被覆盖到了，但 affected 集合偏宽，噪声高 | `2` |
| Q7 | `codegraph query toolCallNormalizeNode -p . -j`; `codegraph query routeAfterToolCallNormalize -p . -j`; `codegraph explore "toolCallNormalizeNode schema failure planner retry routes" -p .` | `server/src/agent/nodes/tool-call-normalize.ts:55-157,159-291`; `server/src/agent/graph/routes.ts:77-93`; `server/src/agent/planner/node.ts:391-403`; `server/src/agent/__tests__/tool-call-normalize.test.ts:768-816` | 1 | schema failure -> schemaReplanDiagnostics -> routeAfterToolCallNormalize -> planner retry 链路基本命中 | `3` |
| Q8 | `codegraph explore "read_open evidence summary generate stop rule" -p .` | `server/src/agent/types.ts:309-331`; `server/src/agent/evidence.ts:731-760,1551-1613`; `server/src/agent/nodes/generate.ts:135,259-334,656-966`; tests in `server/src/agent/__tests__/nodes.test.ts:210+,999+` and `next-action-planner.test.ts:650+` via follow-up read | 2 | broad explore 把 attachment/thread-summary 也混进来；但对 read_open summary、generate 消费、stop rule 仍能补到正确证据 | `2` |

## Score

### Question Scores

| Candidate | Q1 | Q2 | Q3 | Q4 | Q5 | Q6 | Q7 | Q8 | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| CodeGraph | 3 | 2 | 2 | 2 | 3 | 2 | 3 | 2 | `继续` |

### Dimension Scores

| Dimension | Score | Notes |
| --- | --- | --- |
| Accuracy | `2` | 主入口、执行路径、schema retry 命中不错；跨链路 broad explore 噪声明显。 |
| Tool Call Count | `2` | 复杂题通常 `1` 次 CodeGraph + `1` 次定向 grep/read 就能收敛；比纯 `rg + read` 少，但不是碾压。 |
| Source Location | `3` | `query` 和 `explore` 都能给出稳定文件路径与行号。 |
| Evidence Usability | `2` | 适合进入候选事实池；不适合直接当 Evidence。 |
| Windows Stability | `3` | 安装、关 telemetry、索引、查询都稳定完成。 |
| Index Duration | `3` | 当前仓库 970 文件，冷启动 9.1s / 内部索引 5.5s，可接受。 |
| Repeat Consistency | `2` | 精确 symbol query 稳定；broad explore 的排序和噪声需要包装层兜住。 |
| Context Size | `1` | `explore` 输出很长，容易把无关源码整段带进上下文。 |
| Grep/Read Reduction | `2` | 对 Q1/Q5/Q7 有明显减负；对 Q2/Q4/Q8 仍依赖补读。 |
| Failure Degradation | `2` | query miss 会显式返回 `not found`，可以退回 `rg + read`；不会静默假装成功。 |

## Baseline Comparison

相对当前 `rg + read` 基线，这次 spike 的真实收益主要在三类问题：

- 明确符号入口：`createAndRunAgent`、`executeHarnessInvocation`、`toolCallNormalizeNode`
- 路由跳转：`routeAfterToolCallNormalize`
- 影响测试：`affected server/src/agent/nodes/policy-node.ts`

收益不明显甚至会拖慢判断的场景：

- broad explore 问题词里同时出现 `generate`、`normalize`、`read` 这种高频词
- 需要严格限制在 `server/src/agent/**` 合同边界的问题
- 要求非常短上下文的 Planner 前置阶段

## Candidate Fact Pool Judgment

CodeGraph 输出可以进入 Evidence 前候选事实池，但必须满足：

- 至少带 `source path + line range`
- 进入候选池后必须再做原文核验
- broad explore 的跨域结果必须先过滤

当前不满足“直接写 Evidence”的原因：

- `explore` 会把 `desktop`、`rag service`、`microapp`、`scripts` 中的同名符号一并带进来
- 问题如果是字段级合同，例如 `answerReadiness.canAnswer`，原始结果容易先落到类型定义或 RAG generate，而不是 Agent 主链

## Noise And Misses

这次 spike 暴露的主要误报 / 漏报：

- Q1: `agentGraph.run` 直接 query 更容易先返回测试 helper，而不是生产入口。
- Q2: `normalize` 词会把 `scripts/eval-local-model-runtime.mjs`、`scripts/smoke-local-model-runtime.mjs` 拉进来。
- Q4: `generate` 词会把 `server/src/services/rag-nodes/generate.service.ts` 拉进来，掩盖 Agent generate。
- Q6: `affected` 能覆盖 required tests，但集合过宽，含多批无关 desktop/server tests。
- Q8: `read` / `summary` 词会把 attachment storage、thread summary 等旁支结果带进来。

## Recommendation

建议继续推进 CodeGraph 作为第一候选，但推进方式必须收敛为：

1. 只按 `code_T003` / `code_T004` 既有设计走 Managed MCP + abstraction，不直接进 runtime 主链。
2. 第一阶段只暴露受控 `codebase_explore` / `findSymbol` 一类能力，不给 Planner 原生 broad explore。
3. 包装层默认加路径域过滤，优先 `server/src/agent/**`、`server/src/harness/**`、`server/src/mcp/**`。
4. 结果合同必须保留 `path`、`startLine`、`endLine`、`limitations`，并强制原文核验。
5. `workspace_inventory`、`search_text`、`read_file_slice` 继续保留为降级底座。

如果后续接入阶段做不到上面 2-5 条，本结论应回退为 `暂缓`，而不是继续乐观推进。

## Verification Notes

- 本次只做本地 CLI spike，没有修改 runtime，没有新增正式 MCP server。
- 本次安装和索引只服务实验记录，不属于仓库正式运行时能力。
- 本次实验过程中产生的 `.codegraph/` 临时索引目录已在收尾前删除。
- 当前工作区存在任务外脏文件；这些变更不属于本 spike 审查范围。
