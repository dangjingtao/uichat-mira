---
status: current
owner: runtime
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodeGraphVerificationBridgeReview
doc_type: review
canonical: true
related:
  - docs/project-control/tasks/code_T011-codegraph-verification-bridge.md
  - docs/project-control/tasks/code_T010-codebase-explore-wrapper-runtime.md
  - docs/project-control/project-control-ledger.md
---

# code_T011 CodeGraph Verification Bridge Review

## Scope

本 review 只审查：

- `followUpReads` 计划
- candidate 原文核验
- mismatch 可见性
- verified evidence input 适配

不在本 review 范围内：

- Planner 暴露
- Agent Graph routing
- ToolNode 主链
- Generate 规则
- 普通 Agent 默认启用

## What This Bridge Proves

1. `codebase_explore` 候选现在不只是“建议去哪里看”，而是已经能在隔离目录内走完最小原文核验闭环。
2. verified / rejected / unverifiable 三类结果现在都有明确落点，不会把核验失败伪装成“仓库没有”或“可以直接当事实”。
3. verified 子集已经能整理成 `AgentRetrievalEvidence` 兼容输入，但这个桥接仍停留在受控输入层，没有越界改主链。

## What This Bridge Does Not Prove

1. Planner 已经默认能调用 CodeGraph。
2. verified input 已经接入现有 Evidence 主流程。
3. Generate 已经会消费这些 verified input。
4. 真实 CodeGraph provider 的 summary 质量已经稳定。

所以，T011 的结论是“verification bridge 成立”，不是“主链接入已经完成”。

## Review Findings

### 1. `followUpReads` 已经从 hint 变成受控计划

- wrapper 现在会为每个 candidate 产出 `followUpReads`
- 计划固定成 `read_file_slice` 语义
- broad scope、missing line range、常规 excerpt verification 会留下不同 reason

这意味着后续核验已经有稳定的调度输入，而不是继续靠上层猜。

### 2. mismatch 现在是显式缺陷，不再会被静默吞掉

- provider summary 和原文 excerpt 完全对不上时，结果进入 `rejected`
- mismatch notes 会保留下来
- verified evidence input 不会吸收这类 candidate

这一步很关键，因为它挡住了“图谱摘要看起来像，但原文并不支持”的假阳性。

### 3. 未核验 candidate 仍然过不了 Evidence gate

- `verifiedEvidenceInput` 只包含 verified 子集
- `rejected / unverifiable` 仍然保留在核验结果里
- 适配器输出的 `AgentRetrievalEvidence` 只按 verified chunk 构造

这满足了本卡最重要的边界：未核验 candidate 不得进入 Evidence。

### 4. 主链隔离边界仍然成立

- 没有改 Planner 暴露面
- 没有改 Generate 行为
- 没有改 `server/src/agent/evidence.ts` 主实现
- 没有把 broad explore 裸结果直接塞进 Evidence

## Remaining Gaps

1. 现在的桥接还是 managed-codegraph 内部能力，还没有接到现有 Agent retrieval/evidence 运行链。
2. 当前原文核验是最小等价读取实现，不是完整 tool-node `read_slice` 执行链。
3. `pnpm check` 仍被任务外 `microapps` websocket 类型错误阻断，不能把这组错误误报成 T011 缺陷。

## Recommended Next Steps

1. 后续任务只在 owner 明确批准后，再把 verified input 接入 Evidence 主线。
2. 如果要进主链，先补 trace / observability，而不是直接把 verified input 混入 generate。
3. 继续保留 `.codegraph/` repo 污染风险为 Phase 1 风险，直到真实 provider 验证完成。

## Review Conclusion

结论：`通过`

理由：

- Verification bridge 已成立
- verified / rejected / unverifiable 边界清楚
- 未核验 candidate 仍然被挡在 Evidence gate 之外
