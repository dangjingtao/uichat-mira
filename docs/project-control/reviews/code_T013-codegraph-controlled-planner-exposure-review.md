---
status: current
owner: runtime
last_verified: 2026-07-09
layer: project-control
module: ProjectControl
feature: CodeGraphControlledPlannerExposureReview
doc_type: review
canonical: true
related:
  - docs/project-control/tasks/code_T013-codegraph-controlled-planner-exposure.md
  - docs/project-control/tasks/code_T012-codegraph-trace-diagnostics.md
  - docs/project-control/project-control-ledger.md
---

# code_T013 CodeGraph Controlled Planner Exposure Review

## Scope

本 review 只审：

- `codebase_explore` 是否受控暴露给 Planner
- 是否仍然走既有 Normalize / Policy / ToolNode 主链
- 是否守住 verified-only Evidence 边界
- provider blocked / broad explore 时是否诚实降级

不审：

- CodeGraph provider 质量总评
- 前台 trace UI
- 其它 `microapps` 或 `planner` 任务线

## What This Task Proves

1. `codebase_explore` 已经能作为一个最小受控工具进入 Planner 视野，但默认是关的。
2. 这次接入没有绕开 `normalize -> policy -> toolNode -> harness` 既有链路。
3. Evidence gate 仍然成立：只有 verification bridge 核验过的 chunk 才能进入 Retrieval Evidence。
4. provider unavailable、telemetry blocked、broad explore 噪声这些坏场景，当前都只会留下 partial / degraded / fallback 证据，不会假装“已经能回答”。

## What This Task Does Not Prove

1. CodeGraph 现在适合默认对所有 Agent 开启。
2. broad query 的候选质量已经足够稳定。
3. 前台已经有可视化 trace 面板。
4. 所有代码库理解问题都应该优先走 CodeGraph。

## Review Findings

### 1. 暴露面收住了

- flag 关闭时，Harness runtime 根本不注册 `codebase_explore`
- flag 打开时，只注册一个受控工具 `codebase_explore`
- 暴露给 Planner 的 schema 只有 `query`
- 没有把 `codegraph/query`、`codegraph/explore`、`codegraph/affected` 暴露成可选工具

### 2. 主链没有被绕开

- 本任务没有改 Planner 到 ToolNode 的主路由
- `use_tool` 仍然必须先冻结成 `pendingToolCall`
- Policy 仍然保留 deny / approval 判断
- ToolNode 仍然只执行 frozen planner call

所以这不是“给 Planner 偷开一个旁路”，而是“把 CodeGraph 包成一个普通受控工具”。

### 3. Evidence gate 还在

- `codebase_explore` 执行后不会直接把 provider candidate 塞进 Retrieval Evidence
- 只有 `verifiedEvidenceInput.chunkCount > 0` 时，ToolNode 才追加 Retrieval Evidence
- verified 为空时，只保留工具执行记录，不伪造 Retrieval Evidence

这点是 T013 最关键的边界，当前实现是成立的。

### 4. 正式 runtime 写盘边界也收住了

- 正式 runtime 默认不再落到 repo `.artifacts`
- 现在优先使用 `UI_CHAT_CODEGRAPH_APP_DATA_ROOT`
- 如果没有显式根目录，会继续尝试复用现有 `UI_CHAT_LOG_DIR / UI_CHAT_DATABASE_DIR` 的 app-data 父目录
- 如果 app-data root 仍然无法解析，provider 会明确停在 blocked，而不是偷偷写 repo

这解决了此前最危险的 repo 污染问题。

### 5. 坏场景是诚实的

- telemetry blocked / provider unavailable 时，结果是 `degraded`
- broad explore 噪声时，retrieval summary 会标成 `partial`
- 即使 verified chunk > 0，`answerReadiness.canAnswer` 也仍然是 `false`
- trace 里能看到 `exposureMode`、provider、verification、fallback

所以当前实现不会把“有点像答案的候选”伪装成“已经验证过的事实”。

## Remaining Risks

1. `codebase_explore` 打开后虽然是受控 schema，但候选质量仍然依赖 provider 输出和 query 命中质量。
2. 当前 partial 结果会继续推动 Planner 缩 scope 或读原文，这条链路是否足够稳，还需要后续 smoke / controlled rollout 继续看真实对话。
3. 这次只证明了后端链路受控，没有证明前台 trace 可读性。

## Review Conclusion

- 总结论：`通过`
- 阻断问题：无
- 非阻断建议：
  - 后续 controlled rollout 前，补 1~2 条真实 Agent smoke，确认 partial trace 下 Planner 不会提前收成 answer
  - 如果后续要长期保留该能力，建议补一个专门的前台 trace inspection 入口
- 最小整改补丁：本轮无需额外补丁
- 是否允许进入后续 smoke / controlled rollout：`允许`
