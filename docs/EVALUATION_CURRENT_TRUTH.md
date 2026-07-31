---
status: current
owner: evaluation / runtime
last_verified: 2026-07-31
layer: wiki
module: Evaluation
feature: EvaluationRuntimeTruth
doc_type: current-snapshot
canonical: true
related:
  - evaluation/README.md
  - evaluation/workbench.md
  - evaluation/package-format.md
  - evaluation/runtime.md
  - evaluation/metrics.md
  - KNOWLEDGE_BASE_CURRENT_TRUTH.md
  - PROVIDER_CURRENT_TRUTH.md
  - CURRENT_PRODUCT_TRUTH.md
  - archive/evaluation/README.md
---

# UIChat Mira Evaluation 当前真相

> 本页只记录 `dev` 当前可由代码和现有回归核对的评测工作台、评测包、运行、指标和报告事实。它不把启发式分数包装成标准学术指标，也不把评测结果包装成生产验收结论。

## 1. 结论先说

Mira 当前具备一套面向 Knowledge Base / RAG 的本地评测工作流：

```text
Knowledge Base
→ Generate or Prepare Evaluation ZIP
→ Parse and Validate Dataset
→ Create Evaluation Run
→ Execute Samples and Repeats
→ Persist Logs / Results / Metrics
→ Inspect in Evaluation Center
→ Export Markdown Report
```

当前核心对象链：

```text
EvaluationPackage
→ EvaluationDataset
→ EvaluationRun
→ EvaluationSampleResult
→ EvaluationSampleAttempt
→ EvaluationMetricSummary
→ Client-side Markdown Report
```

这些状态不能互相替代：

```text
评测包生成成功
!= 数据集已经通过校验

数据集可运行
!= 当前知识库内容与生成包时完全一致

Run completed
!= 所有指标具有学术标准含义

分数较高
!= 产品已经通过真实场景验收

报告已导出
!= 报告算法和解释已被冻结为版本化合同
```

## 2. 当前产品入口

### 2.1 评测工作台

路由：

```text
设置
→ 评测中心
→ 新建评测
```

当前职责：

- 从现有知识库生成评测 ZIP；
- 上传一个 `.zip` 评测包；
- 解析 manifest、evalset 和 documents 清单；
- 展示数据集摘要、前四条样本和校验结果；
- 创建评测 Run；
- 每 1.5 秒轮询 Run 状态；
- 展示当前日志、进度、指标和前几条结果。

### 2.2 评测中心

路由：

```text
设置
→ 评测中心
```

当前职责：

- 列出历史 Run；
- 按 Run 名、数据集名、Knowledge Base id / name 做客户端搜索；
- 刷新列表；
- 查看 Run 详情；
- 导出当前 Run 的 Markdown 报告；
- 删除单条或批量删除已结束 Run。

当前列表没有分页。API 支持 status 过滤，但当前桌面中心主要读取全部 Run 后在客户端搜索。

## 3. 当前核心对象

### 3.1 `EvaluationPackage`

当前评测包是一个 ZIP，主要包含：

```text
manifest.json
evalset.json
documents/*
```

它用于携带：

- 数据集名称；
- 目标 `knowledgeBaseId`；
- 运行参数；
- 问题、参考答案、gold sources 和 tags；
- documents 条目的名称和大小信息。

当前自动生成包中的 `documents/*` 只写入同名占位文本，并不保存知识库原文快照。因此它不是自包含、可移植、可独立复现的语料包。

### 3.2 `EvaluationDataset`

上传解析后，Dataset 保存：

- id；
- datasetName；
- knowledgeBaseId；
- 原 ZIP 文件名、大小和上传时间；
- 文档和样本计数；
- 是否包含 reference answers / gold sources；
- mode、topK、topN、repeat、concurrency、timeoutSeconds；
- documents 清单；
- 前四条 preview samples；
- validation report。

完整样本另行持久化在 `samples_json`。

### 3.3 `EvaluationRun`

Run 保存：

- id / name；
- Dataset 快照；
- `queued | running | completed | failed`；
- startedAt / completedAt；
- aggregate metrics；
- 最多 200 条日志；
- sampleResults。

Run 和 Dataset 使用 SQLite 持久化，但执行调度本身仍在当前 backend 进程内。

### 3.4 `EvaluationSampleResult`

每条样本记录：

- question；
- goldSources / matchedGoldSources；
- retrievedSources；
- answerText / referenceAnswer；
- success / failed；
- hit、recall、latency、sourceHit；
- faithfulness、answerRelevance、answerCompleteness；
- attempts；
- errorMessage。

### 3.5 `EvaluationSampleAttempt`

`repeat > 1` 时，同一条样本按顺序执行多次。每次 Attempt 记录独立耗时、命中、分数、来源、回答或错误。

## 4. 评测包生成

评测包生成器要求：

- 已配置 `evaluation` 模型角色；
- 选择存在的 Knowledge Base；
- Knowledge Base 至少有一个 `ready + enabled` 文档和可用 Chunk。

生成路径：

```text
选择 ready documents
→ 随机抽取 documents / chunks
→ evaluation role 为每个 chunk 生成 JSON 样本
→ 检查 question / expectedAnswer / duplicate
→ 写 manifest.json
→ 写 evalset.json
→ 写 documents 占位条目
→ 返回 ZIP
```

`evaluation` 模型当前只用于**生成评测样本**。当前 Run 的 Faithfulness、Relevance、Completeness 并不调用该模型做裁判，也没有 LLM-as-a-Judge。

生成器当前限制：

- sampleCount：1–100；
- chunksPerDocument：1–20；
- concurrency：1–10；
- timeoutSeconds：5–300；
- topK：1–50；
- topN：1–20；
- repeat：1–10。

服务端会对这些值做 clamp。当前桌面 `strict` preset 显示 600 秒超时，但服务端生成 manifest 时会 clamp 到 300 秒。这是一处 UI / Runtime 参数漂移。

生成器使用未固定 seed 的随机抽样。即使知识库不变，两次生成包也不保证选择相同文档、Chunk 或问题。

## 5. 上传与校验

当前上传合同：

- multipart/form-data；
- 只允许一个文件；
- 只允许 `.zip`；
- 完整 ZIP 先读入内存；
- 使用全局 100 MB 上传上限。

Parser 支持查找：

```text
manifest.json

evalset.json
或 evalset/evalset.json
或 dataset/evalset.json

documents/*
```

当前校验项：

| 校验 | Error 条件 | Warning 条件 |
| --- | --- | --- |
| 结构 | manifest、documents 或有效 sample 缺失 | manifest 缺失时同时会用默认值回填部分字段，但结构仍报错 |
| Reference Answer | 无可用 sample | 仅部分或全部样本缺少 reference answer |
| Gold Sources | 无可用 sample | 仅部分或全部样本缺少 gold sources |
| Knowledge Base | knowledgeBaseId 缺失或指向不存在 KB | 无 |

任何 `error` 会阻止启动 Run；`warning` 不阻止。

当前 parser 只读取 `documents/*` 的名称和大小，不导入其中的正文，也不核对这些文件与当前 Knowledge Base 的真实内容。

## 6. 运行时

创建 Run 后：

```text
status = queued
→ 保存 SQLite
→ queueMicrotask(executeRun)
→ status = running
→ 按 concurrency 启动 sample workers
→ 每条样本按 repeat 顺序执行
→ 持续写 sampleResults / metrics / logs
→ completed 或 failed
```

这不是 durable job queue：

- 没有独立 worker service；
- 没有 checkpoint；
- 没有 pause / cancel / resume；
- 没有 backend 重启后的自动续跑；
- 多个 Run 可以在同一 backend 进程中同时执行。

当前删除接口拒绝删除 `queued` 或 `running` Run。

## 7. 两种模式

### 7.1 `retrieve`

目标上用于只测检索：

```text
Question
→ Retrieve
→ Sources
→ Retrieval Metrics
```

但当前 `ragPipeline.retrieveOnly()` 最终调用 `ragGraph.retrieve()`，而后者仍执行完整 RAG Graph，包括 Generate，再丢弃 answer。

因此当前 retrieve 模式：

- 可能额外调用 `llm`；
- 可能产生额外延迟和模型成本；
- 并不是真正的纯检索 Runtime。

这是一处实现漂移，不是新的评测合同。

### 7.2 `retrieve-generate`

执行完整：

```text
rewrite
→ embedding
→ retrieve
→ optional rerank / fallback
→ generate
→ sources + answer
```

该模式计算检索分数以及当前词项重合型生成分数。

## 8. 模型角色

当前实际依赖需要拆开：

| role / Runtime | 当前用途 |
| --- | --- |
| `evaluation` | 生成评测包中的 question / expectedAnswer / tags |
| `embedding` | 查询向量化 |
| `rerank` | 可选候选重排；失败会降级 |
| `llm` | RAG Generate；当前 retrieve 模式也可能因实现漂移调用 |
| `task` | RAG Query Rewrite 只有在需要基于历史改写时使用；当前 Evaluation 没传对话历史，通常不会触发模型改写 |

当前不存在专门的 Judge Model 调用。把 `evaluation` 写成“评测裁判模型”会高估现状。

## 9. 指标语义

当前指标名称沿用常见 RAG 术语，但算法是本地启发式实现。详细合同见 [[evaluation/metrics]]。

| 指标名 | 当前真实计算 |
| --- | --- |
| Hit@K | 至少一个 returned document name 命中 goldSources 的样本比例 |
| Recall@K | 每条样本命中的唯一 gold source 数 / gold source 总数，再取平均 |
| MRR | 当前不是按首个正确来源真实 rank 计算；使用 `hit ? max(recall, 1/3) : 0` 的近似 |
| Faithfulness | answer tokens 与 retrieved source tokens 的重合比例；answer 为空时会使用 expectedAnswer 作为 basis |
| Answer Relevance | answer 与 question / expectedAnswer 的词项重合加权值 |
| Answer Completeness | expectedAnswer tokens 被 answer 覆盖的比例 |
| Source Hit Rate | 当前 `sourceHit = hit`，聚合结果实质上与 Hit@K 同义 |
| Average Latency | sample latency 平均；全失败样本使用配置 timeout 作为 latency |
| Failed Count | status=failed 的样本数量 |

当前没有：

- 标准 RAGAS；
- LLM Judge；
- 人工标签复核；
- embedding semantic judge；
- 真实 rank MRR；
- Token / Cost 指标；
- 置信区间和统计显著性。

## 10. Repeat 与失败语义

一条样本有多个 Repeat 时：

- successful attempts 的 recall、latency 和生成分数取平均；
- `hit` / `sourceHit` 只要任一成功 Attempt 命中即为 true；
- 展示的来源与回答选择“recall 更高、hit 更好、延迟更低”的最佳 Attempt；
- 任一 Attempt 失败，即使其他 Attempt 成功，最终 sample status 仍为 `failed`；
- 任一 sample failed，最终 Run status 为 `failed`。

因此 failed Run 不等于所有样本都没有结果。它仍可能包含大量成功 Attempt、指标和来源。

## 11. 持久化与恢复

SQLite 保存：

```text
evaluation_datasets
evaluation_runs
```

Dataset、samples 和 Run 使用 JSON 快照存储。Backend 启动时会重新加载它们到内存。

当前没有 `user_id` 字段。评测数据在当前本地实例中属于实例级数据，不是多租户隔离资源。

### 重启漂移

如果 backend 在 Run 为 `queued` 或 `running` 时退出：

- Run 状态会以原值留在 SQLite；
- 重启后会被 hydrate；
- 但不会重新排队或恢复执行；
- 删除接口又拒绝删除 running / queued Run。

结果是该记录可能永久卡住。这是当前最严重的 Evaluation 生命周期缺口之一，本轮只记录，不修改 Runtime。

Dataset 当前没有列表、详情或删除 API / UI。解析后的 Dataset 会持久化；删除 Run 不会删除 Dataset，可能形成孤立数据。

## 12. Markdown 报告

Markdown 报告由桌面端根据当前 Run JSON即时生成，不是服务器持久化 Artifact。

它可以包含：

- Run 摘要；
- 配置；
- 数据集校验；
- 指标解释；
- 样本概览与详情；
- Retrieved Sources；
- 风险建议；
- 日志；
- Mermaid 图。

报告还在客户端计算一套带硬编码权重和 latency / failed normalization 的“加权平均概览”。该分数：

- 不保存在 Run；
- 不是服务端指标合同；
- 没有版本字段；
- 可能随未来前端报告代码变化。

旧 Run 在未来重新导出时，会使用届时最新的报告代码和文案，而不是原运行时冻结的报告解释。

## 13. 当前已知偏差

| 严重度 | 偏差 | 影响 |
| --- | --- | --- |
| 高 | 重启后 queued / running Run 不恢复也不修复状态 | Run 可永久卡住且不能通过当前 API 删除 |
| 高 | 指标名称强于真实算法 | 用户可能把近似 MRR、词项重合分数误当标准评测 |
| 中 | retrieve 模式仍执行 Generate | 额外延迟、成本和模型依赖 |
| 中 | 自动生成 ZIP 不保存真实语料快照 | KB 变化后结果不可严格复现，包不能跨实例独立运行 |
| 中 | Dataset 无管理与清理入口 | 持久化数据可能持续积累 |
| 中 | timeout 只 Promise.race，不取消底层调用 | 超时后底层模型 / RAG 仍可能继续占用资源 |
| 中 | 任一 Repeat 失败会令 Sample / Run failed | 部分成功结果容易被总状态掩盖 |
| 低 | strict preset 600 秒被服务端 clamp 为 300 秒 | UI 展示与实际 manifest 不一致 |
| 低 | 完成但含失败时仍追加 success 级“批量评测完成”日志 | 日志语义不够精确 |
| 低 | Center 无分页，API status filter 未进入主要 UI | Run 数量增长后可用性下降 |

## 14. 当前非目标

Mira 当前 Evaluation 不承诺：

- 标准化研究基准；
- RAGAS 等外部框架兼容；
- LLM-as-a-Judge；
- 模型排行榜；
- Release Gate 或自动阻断发布；
- Experiment / Baseline / A-B Compare；
- 分布式或 durable evaluation workers；
- 重启恢复、取消或暂停；
- 评测包跨实例完全复现；
- 指标可直接证明专业结论正确；
- 评测模型承担 Run 裁判。

## 15. 代码锚点

主要实现：

- `desktop/src/app/routes/settingsRoutes.tsx`；
- `desktop/src/features/Settings/pages/Evaluation/`；
- `desktop/src/shared/api/evaluation.ts`；
- `server/src/routes/evaluation/`；
- `server/src/services/evaluation.service.ts`；
- `server/src/services/evaluation-package-generator.service.ts`；
- `server/src/db/evaluation.db.ts`；
- `server/src/services/rag-pipeline.ts`；
- `server/src/services/rag-graph.ts`。

现有主要回归：

- `server/src/services/evaluation.service.test.ts`；
- `server/src/services/evaluation-package-generator.service.test.ts`；
- `desktop/src/shared/api/__tests__/evaluation.test.ts`；
- `desktop/src/features/Settings/pages/Evaluation/components/__tests__/EvaluationWorkbenchConsole.test.tsx`；
- `desktop/src/features/Settings/pages/Evaluation/__tests__/Center.test.tsx`；
- `desktop/src/features/Settings/pages/Evaluation/__tests__/exportMarkdown.test.ts`。

当前回归主要保护页面、API、包生成基本错误和报告内容存在性，尚未充分锁定指标数学语义、重启恢复和 durable lifecycle。
