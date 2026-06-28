# 运行与维护模型

Status: Current
Owner: docs
Last verified: 2026-06-24
Layer: schema
Module: Docs
Feature: DocsSystem
Doc Type: current-contract

## 目的

定义当可视化层、索引层和 AI 接入层逐步落地后，这套知识系统应该如何被维护。

## 适合什么时候读

- 想明确长期维护责任
- 想保证 AI 读取到的知识长期可信
- 想避免 markdown、索引、图谱三层逐步漂移

## 当前事实

- 真正的信任来自 markdown 语料层，而不是派生索引。
- 所有派生层都必须可重建。
- 历史材料必须长期和当前契约保持清晰分隔。

## 归属模型

每篇活跃文档都应该声明：

- `Status`
- `Owner`
- `Last verified`
- `Layer`
- `Module`
- `Doc Type`

各 area 的 owner 需要周期性地把 current-contract 文档和代码核对一遍。

## 刷新模型

当活跃文档变化时，刷新顺序应是：

1. 先更新 markdown
2. 再刷新索引
3. 最后刷新图投影

任何派生系统都不应该反过来变成隐藏真相源。

## 治理规则

- 新增活跃文档应遵守 `DOCUMENTATION_STANDARDS.md`
- archive 文档不能悄悄重新进入默认 AI 上下文
- 概念页一旦成型，应尽量稳定并保持 canonical
- 文档失效后，要么归档，要么显式标记失效
- 缺少 `Layer / Module / Doc Type / Status` 的活跃文档，不算已完整纳入知识系统

## 质量信号

健康信号：

- 当前文档都带明确 status
- source path 和 code anchor 易于追踪
- AI 默认读取能避开 archive 噪音
- graph view 能反映当前文档结构

风险信号：

- planned 文档频繁混进实现回答
- 同一概念在多处被冲突定义
- graph view 充满孤点或重复节点
- owner 和 last-verified 长期无人维护
- 同一主题在多个文件里各自定义一版主模块

## Related Docs

- `DOCUMENTATION_STANDARDS.md`
- `AI_READING_SCOPE.md`
- `KNOWLEDGE_SYSTEM_FULL_PLAN.md`
