---
status: current
owner: evaluation
last_verified: 2026-07-31
layer: wiki
module: Evaluation
feature: EvaluationDocsEntry
doc_type: overview
canonical: true
related:
  - ../EVALUATION_CURRENT_TRUTH.md
  - workbench.md
  - package-format.md
  - runtime.md
  - metrics.md
  - ../KNOWLEDGE_BASE_CURRENT_TRUTH.md
  - ../PROVIDER_CURRENT_TRUTH.md
  - ../archive/evaluation/README.md
---

# Evaluation 文档入口

本目录说明 Mira 当前评测工作台、评测包、Run、指标和报告的真实合同。

## 先读

1. [[EVALUATION_CURRENT_TRUTH]]：产品入口、对象链、运行语义、模型依赖和已知漂移；
2. [[evaluation/workbench]]：用户如何生成或上传评测包、启动 Run、查看结果；
3. [[evaluation/package-format]]：ZIP、manifest、evalset 与 documents 条目的格式；
4. [[evaluation/runtime]]：创建、执行、并发、Repeat、持久化与失败语义；
5. [[evaluation/metrics]]：每一个指标在当前代码里的真实算法。

## 当前对象链

```text
EvaluationPackage
→ EvaluationDataset
→ EvaluationRun
→ SampleResult
→ Attempt
→ MetricSummary
→ Markdown Report
```

## 阅读时必须区分

```text
Evaluation Model
!= Judge Model

Evaluation Package
!= Frozen Knowledge Base Snapshot

Run persisted
!= Run is durable and resumable

Metric label
!= Standard academic implementation

Markdown report
!= Versioned server artifact
```

## 当前产品入口

- 评测中心：历史 Run、搜索、详情、Markdown 导出和删除；
- 新建评测：包生成、ZIP 上传、校验、运行日志和结果；
- 模型设置：配置 `evaluation` role，用于生成评测样本；
- Knowledge Base：提供当前 Run 实际查询的数据源。

## 当前不属于本模块的内容

- Knowledge Base 入库与索引合同：[[KNOWLEDGE_BASE_CURRENT_TRUTH]]；
- Provider Connection 与模型调用：[[PROVIDER_CURRENT_TRUTH]]；
- RAG Graph 本身：[[knowledge-base/rag-runtime]]；
- Agent Evidence 与任务执行：[[AGENT_CURRENT_TRUTH]]。

## 历史

六月的薄总览、旧 Workbench 说明和旧 moved 页面保存在 [[archive/evaluation/README]]。它们用于追溯，不回答当前指标和生命周期。
