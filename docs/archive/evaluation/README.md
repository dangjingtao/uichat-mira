---
status: current
owner: docs / evaluation
last_verified: 2026-07-31
layer: historical
module: Evaluation
feature: EvaluationArchive
doc_type: archive
canonical: true
related:
  - ../../EVALUATION_CURRENT_TRUTH.md
  - ../../evaluation/README.md
  - ../../evaluation/workbench.md
  - ../../evaluation/package-format.md
  - ../../evaluation/runtime.md
  - ../../evaluation/metrics.md
---

# Evaluation 历史归档

本目录保存 Evaluation 当前真相建立前的原始文档。

归档不是删除，而是阻止六月的薄总览继续回答当前评测包、运行恢复和指标算法问题。

## 当前文档

请优先阅读：

- [[EVALUATION_CURRENT_TRUTH]]；
- [[evaluation/README]]；
- [[evaluation/workbench]]；
- [[evaluation/package-format]]；
- [[evaluation/runtime]]；
- [[evaluation/metrics]]。

## 历史快照

| 文件 | 原路径 | 日期 | 历史价值 |
| --- | --- | --- | --- |
| `evaluation-overview-20260626.md` | `docs/evaluation/README.md` | 2026-06-26 | 旧模块入口，只指向 Workbench |
| `workbench-20260626.md` | `docs/evaluation/workbench.md` | 2026-06-26 | 旧页面级职责摘要 |
| `evaluation-workbench-moved-20260626.md` | `docs/evaluation/evaluation-workbench.md` | 2026-06-26 | 旧 moved 兼容说明 |

以上文件按原 blob 保存，没有用当前结论重写历史。

## 历史文档不能回答

- `evaluation` role 当前是否承担 Judge；
- 自动 ZIP 是否保存真实语料；
- Run 是否支持重启恢复；
- retrieve 模式是否真正不生成；
- MRR、Faithfulness、Source Hit Rate 的真实公式；
- Markdown weighted score 是否属于 Runtime；
- Dataset 是否有生命周期管理。

这些问题必须使用当前真相和代码核验。
