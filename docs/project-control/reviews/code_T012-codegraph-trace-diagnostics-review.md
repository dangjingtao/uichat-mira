---
status: current
owner: runtime
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodeGraphTraceDiagnosticsReview
doc_type: review
canonical: true
related:
  - docs/project-control/tasks/code_T012-codegraph-trace-diagnostics.md
  - docs/project-control/tasks/code_T011-codegraph-verification-bridge.md
  - docs/project-control/project-control-ledger.md
---

# code_T012 CodeGraph Trace / Diagnostics Review

## Scope

本 review 只审查：

- CodeGraph explore trace
- verification trace
- diagnostics 字段完整性
- raw output / excerpt 不入 trace 的边界

不在本 review 范围内：

- Planner 暴露
- Agent Graph routing
- Evidence gate 调整
- Generate 行为

## What This Task Proves

1. `managed-codegraph` 现在不只是能查和核验，还能把关键诊断字段稳定产出为紧凑 trace。
2. ready / partial / degraded / failed 四类状态现在都能在 trace 里看清原因，而不是只能靠读代码猜。
3. trace 现在能覆盖 provider 版本、telemetry、scope、裁剪、fallback 和 verification 次数，同时仍然守住“不塞大段源码”的边界。

## What This Task Does Not Prove

1. Planner 已默认使用 CodeGraph。
2. Evidence gate 已放宽。
3. 前台 trace UI 已经接好。
4. 真实 CodeGraph provider 结果质量问题已经全部解决。

所以，T012 的结论是“trace / diagnostics 摘要已成立”，不是“主链调试面已经全部完工”。

## Review Findings

### 1. Trace 字段已经够支撑后续调试

当前 trace 已经能直接看出：

- 当前 capability / provider / runtimeShape
- workspaceHash、scope、query、internalCommand
- resultCount、truncated、limitations
- fallbackUsed、fallbackReason
- verificationRequired、verificationReadCount
- status、durationMs、indexStatus、telemetryStatus

这已经够支撑后续定位 “provider 没起来 / scope 选错 / broad explore 太噪 / verification 没跑完” 这几类问题。

### 2. Trace 没有越界变成第二份 Evidence

- 没有把 snippet 塞进 trace
- 没有把 minimalExcerpt 塞进 trace
- 没有把 raw provider payload 完整塞进 trace

这点很重要，因为它守住了 “Trace 是诊断摘要，不是原文证据容器” 的边界。

### 3. Verification trace 现在能反映计划与执行量

- wrapper trace 反映 planned follow-up read 数量
- verification trace 反映实际 follow-up read 数量
- partial / failed verification 也会留下状态和原因

这让后续诊断“为什么 Evidence 还不够”时，不需要再反推核验有没有发生。

### 4. 主链边界仍然成立

- 没有改 Planner 暴露面
- 没有放宽 Evidence gate
- 没有改 Generate 行为

## Remaining Gaps

1. 当前 trace 还在 `managed-codegraph` 隔离目录内，尚未接入统一前台 trace inspection。
2. provider 结果质量和 `.codegraph/` repo 污染风险仍然不是 T012 的解决范围。
3. 后续如果要把 trace 接进更大诊断面，仍需要单独评估前台暴露字段和隐私边界。

## Review Conclusion

结论：`通过`

理由：

- Trace / diagnostics 字段已经齐备
- 摘要边界守住了，没有把 trace 变成第二份 Evidence
- Planner 暴露面和 Evidence gate 都没有被放宽
