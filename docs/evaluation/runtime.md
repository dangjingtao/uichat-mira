---
status: current
owner: evaluation / runtime
last_verified: 2026-07-31
layer: runtime
module: Evaluation
feature: EvaluationRunRuntime
doc_type: current-contract
canonical: true
related:
  - ../EVALUATION_CURRENT_TRUTH.md
  - README.md
  - workbench.md
  - package-format.md
  - metrics.md
  - ../knowledge-base/rag-runtime.md
---

# Evaluation Runtime

## 1. 文档范围

本页定义当前 Dataset 持久化、Run 创建、调度、Sample 执行、Repeat、日志、完成和重启行为。

它不定义指标公式。指标见 [[evaluation/metrics]]。

## 2. HTTP 入口

当前路由：

```text
POST   /evaluation/packages/generate
POST   /evaluation/datasets/parse
GET    /evaluation/runs
GET    /evaluation/runs/:runId
POST   /evaluation/runs
DELETE /evaluation/runs/:runId
POST   /evaluation/runs/batch-delete
```

当前没有：

- Dataset list / detail / delete；
- Run cancel / retry / resume；
- Run compare；
- Server report artifact；
- Baseline / Experiment API。

## 3. Dataset 持久化

解析成功后：

```text
Dataset metadata
→ evaluation_datasets.dataset_json

Complete samples
→ evaluation_datasets.samples_json
```

Service 同时维护三个内存 Map：

```text
datasets
datasetSamples
datasetKnowledgeBaseIds
```

Backend 启动时会从 SQLite hydrate。

当前 Dataset 没有用户管理入口。每次解析都会生成新 Dataset ID 并持久化，即使 ZIP 内容相同。

## 4. 创建 Run

`POST /evaluation/runs` 只接收：

```json
{
  "datasetId": "dataset-...",
  "name": "optional name"
}
```

创建前检查：

1. Dataset 存在于 Service 内存；
2. 没有 validation error；
3. knowledgeBaseId 非空；
4. 当前 Knowledge Base 存在；
5. 至少一个可运行 Sample。

创建后：

```text
status = queued
startedAt = now
metrics = zero
logs = [created]
sampleResults = []
→ 写内存
→ upsert SQLite
→ queueMicrotask(executeRun)
```

Run 名未指定时由 Dataset 名和时间生成。

## 5. 调度模型

当前没有单独队列表或 Worker 进程。

`queueMicrotask` 只保证当前事件循环后启动 `executeRun`。因此：

```text
queued
!= 已进入 durable queue
```

多个 API 请求可以创建多个 Run，它们会在同一 backend 进程内并发执行，当前没有全局并发预算或资源调度器。

## 6. Run 执行

进入 `executeRun` 后：

```text
status = running
→ 持久化
→ 读取 repeat / concurrency / timeout
→ 创建 min(concurrency, sampleCount) 个 workers
→ 共享 nextIndex 领取 Sample
→ evaluateSample
→ push result
→ 重算 metrics
→ 排序 SampleResult
→ 持久化
→ 追加日志
```

每个 Worker 顺序领取 Sample。不同 Worker 可并行。

同一 Sample 的多个 Repeat 在 `evaluateSample` 内顺序执行，不并行。

## 7. 参数归一化

执行时：

```text
repeat = max(1, floor(value))
concurrency = max(1, floor(value))
timeoutSeconds = max(1, floor(value))
```

对上传的第三方 ZIP，当前执行层没有为这些字段设置明确上限。

自动包生成器会在写 ZIP 前使用更严格上限，但手工 ZIP 可以声明更大值。因此 Package Generator 的限制不等于 Parser / Run 的统一服务端限制。

## 8. `retrieve` 模式

当前调用：

```text
ragPipeline.retrieveOnly
→ ragGraph.retrieve
→ ragStateGraph.invoke
```

`ragGraph.retrieve` 当前仍运行完整图：

```text
rewrite
→ embed
→ retrieve
→ rerank / fallback
→ generate
```

然后仅返回 `rerankedChunks ?? retrievedChunks`。

因此当前模式名“retrieve”只表示 Evaluation 丢弃 answer 并把生成指标置 0，不代表底层没有 Generate。

目标语义应是纯检索，但本轮不修改 Runtime。

## 9. `retrieve-generate` 模式

调用：

```text
ragPipeline.run
```

返回：

- answer；
- sources。

Evaluation 只保留最终 sources，不保留完整 `retrievedChunks` / `rerankedChunks`、RAG node observations 或 Provider invocation trace 到 Run JSON。

因此当前报告不能完整解释：

- Vector 与 Lexical 各自命中；
- RRF 前后排名；
- Rerank applied / degraded；
- 具体模型调用身份；
- Token / Cost。

## 10. Timeout

每个 Attempt 使用：

```text
Promise.race([
  rag promise,
  timeout rejection
])
```

Timeout 到期会让 Attempt 失败，但没有把 AbortSignal 传给底层 RAG / Provider。

因此：

```text
Evaluation Attempt 已超时
!= 底层请求已经取消
```

底层调用可能继续执行和占用资源，只是结果不再被本 Attempt 等待。

## 11. Repeat 聚合

每条 Sample 会执行 `repeatCount` 次。

Successful Attempt 保存：

- hit / recall；
- latency；
- sourceHit；
- answer；
- 三个生成启发式分数；
- matchedGoldSources；
- source previews。

Failed Attempt 保存：

- actual elapsed latency；
- error；
- 其余分数为 0。

### 11.1 Sample 最终结果

有成功 Attempt 时：

- recall = 成功 Attempt 平均；
- latency = 成功 Attempt 平均；
- 三个生成分数 = 成功 Attempt 平均；
- hit / sourceHit = 任一成功 Attempt true；
- matchedGoldSources = 所有成功 Attempt 并集；
- answer / sources = 最佳 Attempt；
- 只要有一个 Repeat 失败，Sample status 仍为 failed。

最佳 Attempt 排序：

```text
更高 recall
→ hit=true 优先
→ 更低 latency
```

全部 Attempt 失败时：

- status = failed；
- latencyMs = `timeoutSeconds * 1000`，而不是 Attempts 实际耗时平均；
- errorMessage 合并所有 Attempt 错误。

## 12. Run 完成语义

所有 Worker 结束后：

```text
存在任一 failed Sample
→ Run failed

否则
→ Run completed
```

所以：

```text
Run failed
!= Run 没有任何可用结果
```

Run 可能同时拥有：

- 成功 Sample；
- 成功 Attempt；
- Aggregate Metrics；
- Sources；
- 少量失败或超时。

UI 和文档应同时查看 failedCount 与 Sample 详情，不只看 Run status。

当前执行结束时无论部分失败与否，都会追加一条 success level 的“批量评测完成，结果已汇总”。这与 failed Run 的状态语义不完全一致。

## 13. 实时读取

Workbench 在 Run 未结束时，每 1.5 秒：

```text
GET /evaluation/runs/:runId
```

Backend 每完成一条 Sample 或追加日志时都会 upsert 整份 Run JSON。

当前没有：

- SSE；
- WebSocket；
- 增量日志 API；
- 乐观锁或版本号。

## 14. 日志

日志结构：

```text
id
timestamp
level
text
```

当前最多保留 200 条。超过后删除最早日志，并持久化裁剪后的 Run。

日志是人类可读文本，不是稳定 machine-readable event contract。

## 15. SQLite

表：

```text
evaluation_datasets
evaluation_runs
```

Run 表持有：

- dataset_id foreign key；
- name / status / timestamps；
- 完整 `run_json`。

当前没有 `user_id`、tenant 或 owner 字段。

在现有本地单实例产品中，这意味着评测记录是实例级资源；若未来服务器多用户化，不能直接假定已有 schema 已提供数据隔离。

## 16. Backend 重启

启动时：

```text
initializeEvaluationDatabase
→ evaluationService.initializePersistence
→ hydrate datasets and runs
```

Hydrate 只恢复 JSON，不检查或修正状态。

### 当前结果

Backend 在 Run 期间退出时：

```text
SQLite status = queued / running
→ restart
→ Run 被加载为 queued / running
→ executeRun 不会重新调用
→ API 仍拒绝删除 queued / running
```

这会形成卡死记录。

当前没有：

- startup reconciliation；
- orphaned run 标记；
- failed-on-restart；
- resume checkpoint；
- admin force delete。

## 17. 删除

单条和批量删除都先检查：

```text
queued / running
→ reject
```

删除已结束 Run 时，只删除 `evaluation_runs` 行，不删除 Dataset。

Dataset 没有删除 API，因此会继续存在于 `evaluation_datasets` 和内存 Map。

## 18. 失败与错误传播

Sample 中异常通常被捕获为 Attempt failure，不会直接中断整个 Run。

只有 `executeRun` 外层未被 Sample 捕获的异常才：

- 直接将 Run failed；
- 设置 completedAt；
- 追加 error log。

Run API 当前不暴露独立结构化 `run.error` 字段。主要错误位于 logs 和 Sample errorMessage。

## 19. 当前不变量

- Dataset validation error 不能启动 Run；
- Run 必须绑定当前存在的 Knowledge Base；
- queued / running Run 不能删除；
- Sample Results 持续持久化；
- Aggregate Metrics 随结果重算；
- Run 与 Dataset 重启后可读取；
- Run 执行本身不具备重启恢复。

## 20. 已知运行时债务

优先级从高到低：

1. 重启 reconciliation / 恢复或失败收口；
2. 真正的 retrieve-only 路径；
3. Abort / cancel；
4. Dataset 生命周期管理；
5. 全局 Run concurrency 与资源预算；
6. 结构化 Trace、Provider、Token、Cost 和 RAG breakdown；
7. 分页与过滤；
8. 报告版本化。

这些是当前代码缺口，不自动等于下一版本承诺。
