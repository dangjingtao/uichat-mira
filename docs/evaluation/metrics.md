---
status: current
owner: evaluation / runtime
last_verified: 2026-07-31
layer: metric
module: Evaluation
feature: EvaluationMetrics
doc_type: current-contract
canonical: true
related:
  - ../EVALUATION_CURRENT_TRUTH.md
  - README.md
  - workbench.md
  - package-format.md
  - runtime.md
---

# Evaluation 指标当前语义

## 1. 文档范围

本页定义 `EvaluationMetricSummary` 和 Sample 分数在当前代码中的真实计算。

当前指标名称借用了常见 RAG 术语，但实现是轻量本地启发式。它们不是标准 RAGAS、不是 LLM Judge，也不是研究基准。

## 2. 来源匹配基础

Gold source 和 Retrieved source 当前只按 documentName 匹配。

归一化：

```text
trim
→ lowercase
```

匹配条件：

```text
normalizedRetrievedDocumentName
===
normalizedGoldSource
```

当前不考虑：

- Chunk rank；
- Document ID；
- Chunk ID；
- 文件路径别名；
- 模糊名称；
- 语义等价；
- 来源内容一致性。

因此所有 Retrieval 指标的质量首先依赖 goldSources 是否填写了准确 documentName。

## 3. Attempt 级数据

每次 Attempt 先得到：

- retrieved chunks；
- optional answer；
- latency；
- normalized retrieved document names；
- matched gold source names。

定义：

```text
goldSet = unique(normalize(goldSources))
matched = retrievedNames.filter(name in goldSet)
```

## 4. Hit

Attempt：

```text
hit = matched.length > 0
```

Sample 多 Repeat：

```text
sample.hit = any(successfulAttempt.hit)
```

Aggregate `Hit@K`：

```text
number of samples with hit=true
/
number of sampleResults
```

### 边界

- 只要任意一个 gold source 命中就算 hit；
- 不检查命中在返回列表中的排名；
- 不检查命中 Chunk 是否真的回答了问题；
- 名称重复可能产生多个 matched entry，但 hit 仍只是 boolean。

## 5. Recall@K

Attempt：

```text
unique(matched gold source names).size
/
goldSet.size
```

若 goldSet 为空：

```text
recall = 0
```

Sample 多 Repeat：

```text
sample.recall = average(successfulAttempt.recall)
```

Aggregate：

```text
sum(sample.recall)
/
number of sampleResults
```

失败 Sample 以 0 进入分母。

### 边界

- 这是 document-name coverage；
- 不是 Chunk recall；
- 不是语义召回；
- goldSources 缺失时固定为 0，即使检索结果对用户问题有帮助。

## 6. MRR

当前字段名为 `mrr`，但代码**没有读取首个正确来源的实际排名**。

当前每条 Sample 的贡献：

```text
if hit:
  max(recall, 1 / 3)
else:
  0
```

Aggregate：

```text
average(sample contribution)
```

所以当前值更接近“命中 + Recall 的保底近似”，不是标准 Mean Reciprocal Rank。

### 不能这样解释

当前文档和报告不能再写：

> 取第一个正确来源排名的倒数。

因为 Runtime 没有执行这项计算。

### 当前适合的解释

> 一个保留在 `mrr` 字段中的历史近似分数；命中样本至少记 1/3，并按 Recall 提高。

在 Runtime 修正或字段迁移前，任何跨系统 MRR 对比都不可信。

## 7. Source Hit Rate

Attempt：

```text
sourceHit = hit
```

Sample：

```text
sample.sourceHit = any(successfulAttempt.sourceHit)
```

Aggregate：

```text
number of samples with sourceHit=true
/
number of sampleResults
```

因此当前：

```text
Source Hit Rate
≈ Hit@K
```

在正常聚合中两者实质同义，并不是“所有返回或引用来源中有多少比例属于 gold source”。

## 8. Faithfulness

只在 `retrieve-generate` 模式计算。

### 8.1 Answer basis

```text
answerBasis = answerText.trim() || expectedAnswer.trim()
```

这意味着若模型生成 answer 为空，但 Sample 有 expectedAnswer，当前代码会使用 expectedAnswer 参与 Faithfulness 计算。

### 8.2 Tokenization

```text
normalize whitespace
→ lowercase
→ split by non [a-z0-9 Chinese character]
→ unique token set
```

### 8.3 计算

```text
answer tokens that appear in any retrieved source content
/
all answerBasis tokens
```

特殊情况：

- answerBasis 为空：有 sources 则 1，否则 0；
- answer tokens 为空：有 sources 则 1，否则 0。

### 边界

该分数只能粗略表示词项重合，不能判断：

- 逻辑是否忠实；
- 数字是否正确；
- 否定关系是否被反转；
- 来源是否支持结论；
- 回答是否引用了错误段落；
- 幻觉是否存在。

## 9. Answer Relevance

只在 `retrieve-generate` 模式计算。

Token sets：

```text
questionTokens
answerTokens
expectedTokens
```

计算：

```text
questionScore = overlap(questionTokens, answerTokens) / questionTokens.size
expectedScore = overlap(expectedTokens, answerTokens) / expectedTokens.size

if expectedTokens empty:
  expectedScore = questionScore

answerRelevance = min(1, questionScore * 0.6 + expectedScore * 0.4)
```

### 边界

- 只看词项重合；
- 问题复述可能提高分数；
- 同义表达可能被低估；
- 回答包含关键词但答非所问仍可能得分；
- expectedAnswer 的质量直接影响结果。

## 10. Answer Completeness

只在 `retrieve-generate` 模式计算。

```text
expected answer tokens present in answer
/
all expected answer tokens
```

特殊情况：

- expectedAnswer 为空：answer 非空则 1，否则 0；
- expectedTokens 为空：answer 非空则 1，否则 0。

### 边界

- 是参考答案词项覆盖率；
- 不判断表达是否正确；
- 不判断多余或错误内容；
- 同义改写可能被低估；
- Reference Answer 不完整会限制该指标上限的意义。

## 11. Retrieve 模式的生成分数

`retrieve` 模式中：

```text
faithfulness = 0
answerRelevance = 0
answerCompleteness = 0
```

即使当前底层因实现漂移执行了 Generate，Evaluation 也会丢弃 answer 并把这些字段设为 0。

因此不要把 0 解释成生成质量差；在 retrieve 模式中它表示“不评估”。当前 schema 没有 null / not-applicable 状态。

## 12. Latency

Attempt latency：

```text
Date.now() after execution or error
-
startedAt
```

Sample 有成功 Attempt 时：

```text
average successful Attempt latency
```

Sample 全部失败时：

```text
latencyMs = configured timeoutSeconds * 1000
```

即使失败发生得更早，最终 Sample latency 也会使用完整 timeout budget。

Aggregate：

```text
sum(sample.latencyMs)
/
number of sampleResults
```

### 边界

当前 latency 包含：

- Query processing；
- Embedding；
- Retrieval；
- optional Rerank；
- 当前 retrieve-only 漂移中的 Generate；
- retrieve-generate 的 Generate。

它不是纯检索延迟，也没有节点拆分。

## 13. Failed Count

```text
count(sample.status === "failed")
```

Sample status 规则：

```text
any Repeat failed
→ Sample failed
```

所以 failedCount 既包括：

- 全部 Attempt 失败；
- 部分 Attempt 失败、部分成功。

它不能直接表示“完全没有结果的样本数”。

## 14. Aggregate 分母

多数检索指标使用：

```text
total = sampleResults.length || 1
```

生成指标只对 success Sample 求平均：

```text
successItems = sampleResults where status=success
successCount = successItems.length || 1
```

这会导致：

- 任何 Repeat 失败的 Sample 被排除在 aggregate 生成分数之外，即使它有成功 Attempt 和可用答案；
- 生成分数可能只代表完全无失败的 Sample 子集；
- failedCount 与生成分数需要一起读。

## 15. Markdown 报告的加权分数

桌面报告定义了指标权重：

| 指标 | 当前报告权重 |
| --- | ---: |
| Hit@K | 0.16 |
| Recall@K | 0.16 |
| MRR | 0.12 |
| Faithfulness | 0.16 |
| Answer Relevance | 0.12 |
| Answer Completeness | 0.14 |
| Source Hit Rate | 0.08 |
| Average Latency | 0.04 |
| Failed Count | 0.02 |

Latency 和 Failed Count 使用前端自定义归一化，再与其他指标加权。

该 weighted average：

- 只存在于 `exportMarkdown.ts`；
- 不属于 `EvaluationMetricSummary`；
- 不持久化；
- 没有版本；
- 不是 Runtime 成功标准；
- 由于 MRR 和 Source Hit Rate 的当前语义，存在重复计权和过度解释风险。

## 16. 当前报告文案偏差

截至本次核验，报告说明仍可能把：

- MRR 写成真实首个正确来源排名倒数；
- Source Hit Rate 写成返回来源与 gold 的比例；
- Faithfulness 写成“是否老实依据来源”；
- 加权平均写成整体得分。

这些文案强于当前算法。当前真相以本页代码公式为准。

## 17. 使用建议

当前指标更适合：

- 同一版本、同一 Knowledge Base、同一配置下做回归趋势；
- 定位 gold source 命名问题；
- 找出失败和慢样本；
- 粗略检查回答与来源、问题、参考答案的词项覆盖。

不适合：

- 与外部 RAGAS 数值直接比较；
- 宣称达到行业标准；
- 自动做上线 Gate；
- 判断医疗、法律或专业结论正确；
- 评价模型真正推理质量；
- 将 MRR 当标准 rank 指标；
- 将 Faithfulness 当幻觉检测器。

## 18. 结果阅读顺序

建议按以下顺序：

1. validation：数据集和 gold 是否可信；
2. failedCount / logs：有没有运行故障；
3. Sample details：具体问题、来源、回答；
4. Hit / Recall：document-name coverage；
5. Latency：整体耗时；
6. 三个生成启发式：只做辅助；
7. MRR / Source Hit Rate：了解当前近似和重复语义后再读；
8. Markdown weighted score：只作当前客户端视觉汇总。

## 19. 未来修正时的迁移要求

若代码改为标准指标，必须同时：

- 明确版本；
- 迁移字段或增加 algorithm id；
- 保留历史 Run 的旧算法说明；
- 更新 API schema、UI、报告和测试；
- 不用新公式静默重解释旧 Run；
- 为 MRR 保存真实 rank；
- 区分 not-applicable 与 0；
- 区分 partial failure 与 complete failure。
